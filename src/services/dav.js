/**
 * CalDAV client over `@nextcloud/cdav-library` (P02, P07, P10, P12; CODE_MAP §Data layer).
 * The only module that talks to the server. Every write sends If-Match (CODE_MAP rule 3).
 * Stub: signatures only.
 */
import { getRequestToken } from '@nextcloud/auth'
import DavClient from '@nextcloud/cdav-library'
import { generateUrl } from '@nextcloud/router'
import { notImplemented } from '../notImplemented.js'

const CALDAV_ROOT = '/remote.php/dav/'
const CALENDAR_SERVER_NAMESPACE = 'http://calendarserver.org/ns/'

/**
 * Connect a CalDAV client for this request. The request token is read when the
 * client is made so a token refreshed by Nextcloud is used on the next read.
 *
 * @return {Promise<DavClient>}
 */
async function getClient() {
	const client = new DavClient({
		rootUrl: generateUrl(CALDAV_ROOT),
		defaultHeaders: {
			requesttoken: getRequestToken(),
		},
	})
	await client.connect({ enableCalDAV: true })
	return client
}

/**
 * Discover the CalDAV calendars available to the current user.
 *
 * @param {DavClient} client a connected client
 * @return {Promise<object[]>}
 */
async function findCalendars(client) {
	const grouped = await Promise.all(client.calendarHomes.map((home) => home.findAllCalDAVCollectionsGrouped()))
	return grouped.flatMap((collections) => collections.calendars)
}

/**
 * Find the calendar that contains a task URL.
 *
 * @param {DavClient} client a connected client
 * @param {string} url the task URL
 * @return {Promise<object>}
 */
async function findCalendarForTodo(client, url) {
	const calendar = (await findCalendars(client)).find((candidate) => url.startsWith(candidate.url))
	if (!calendar) {
		throw new Error(`No calendar found for ${url}`)
	}
	return calendar
}

/**
 * Convert a library VObject into the data layer's stable shape.
 *
 * @param {object} todo a cdav-library VObject
 * @param {string} calendarUrl the containing calendar URL
 * @return {StoredTodo}
 */
function storedTodo(todo, calendarUrl) {
	return {
		url: todo.url,
		etag: todo.etag,
		ics: todo.data,
		calendarUrl,
	}
}

/** Thrown when a write gets HTTP 412: someone else changed the task. Reload; never retry blind. */
export class ConflictError extends Error {
	/**
	 * @param {string} url the task's URL
	 */
	constructor(url) {
		super(`Conflict writing ${url}`)
		this.name = 'ConflictError'
		this.url = url
	}
}

/**
 * @typedef {object} TaskCalendar
 * @property {string} url collection URL
 * @property {string} displayName shown name; areas match on this, never on the URL (rule 4)
 * @property {boolean} ownedByMe false for lists shared with the user by someone else
 * @property {boolean} writable false for read-only lists
 * @property {string} ctag collection tag, for cheap refresh
 */

/**
 * @typedef {object} StoredTodo
 * @property {string} url the task's .ics URL
 * @property {string} etag its etag
 * @property {string} ics its raw iCalendar text
 * @property {string} calendarUrl the list it lives on
 */

/**
 * Connect and list the user's calendars that hold tasks (VTODO).
 *
 * @return {Promise<TaskCalendar[]>}
 */
export async function listTaskCalendars() {
	const client = await getClient()
	return (await findCalendars(client))
		.filter((calendar) => calendar.components.includes('VTODO'))
		.map((calendar) => ({
			url: calendar.url,
			displayName: calendar.displayname,
			ownedByMe: calendar.owner === client.currentUserPrincipal.url,
			writable: calendar.isWriteable(),
			ctag: calendar.ctag ?? calendar._props[`{${CALENDAR_SERVER_NAMESPACE}}getctag`],
		}))
}

/**
 * Every VTODO on one list, open and done.
 *
 * @param {TaskCalendar} calendar the list
 * @return {Promise<StoredTodo[]>}
 */
export async function fetchTodos(calendar) {
	const client = await getClient()
	const foundCalendar = await findCalendarForTodo(client, calendar.url)
	const todos = await foundCalendar.findByType('VTODO')
	return todos.map((todo) => storedTodo(todo, foundCalendar.url))
}

/**
 * Re-read one task.
 *
 * @param {string} url the task's URL
 * @return {Promise<StoredTodo>}
 */
export async function fetchTodo(url) {
	const client = await getClient()
	const calendar = await findCalendarForTodo(client, url)
	const todo = await calendar.find(url.slice(calendar.url.length))
	return storedTodo(todo, calendar.url)
}

/**
 * Replace a task's iCalendar text, guarded by If-Match.
 *
 * @param {string} url the task's URL
 * @param {string} ics new iCalendar text
 * @param {string} etag the etag the change was made against
 * @return {Promise<{etag: string}>} the new etag
 * @throws {ConflictError} on HTTP 412
 */
export async function putTodo(url, ics, etag) {
	const client = await getClient()
	const calendar = await findCalendarForTodo(client, url)
	const todo = await calendar.find(url.slice(calendar.url.length))
	todo.data = ics
	todo.etag = etag
	try {
		await todo.update()
	} catch (error) {
		if (error.status === 412) {
			throw new ConflictError(url)
		}
		throw error
	}
	return { etag: todo.etag }
}

/**
 * Create a task on a list (file name: random UUID + .ics, as Tasks does).
 *
 * @param {TaskCalendar} calendar the list
 * @param {string} ics iCalendar text
 * @return {Promise<StoredTodo>}
 */
export async function createTodo(calendar, ics) {
	const client = await getClient()
	const foundCalendar = await findCalendarForTodo(client, calendar.url)
	const fileName = `${crypto.randomUUID()}.ics`
	let todo
	try {
		todo = await foundCalendar.createObject(fileName, { 'Content-Type': 'text/calendar; charset=utf-8' }, ics)
	} catch (error) {
		if (error.status === 412) {
			throw new ConflictError(`${foundCalendar.url}${fileName}`)
		}
		throw error
	}
	return storedTodo(todo, foundCalendar.url)
}

/**
 * MOVE a task to another list with If-Match, then re-read it (the library keeps a stale etag).
 *
 * @param {string} url the task's URL
 * @param {string} etag its current etag
 * @param {TaskCalendar} target the list to move to
 * @return {Promise<StoredTodo>} the task as stored after the move
 * @throws {ConflictError} on HTTP 412
 */
export async function moveTodo(url, etag, target) {
	return notImplemented('moveTodo', url, etag, target)
}
