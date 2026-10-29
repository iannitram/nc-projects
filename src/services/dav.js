/**
 * CalDAV client over `@nextcloud/cdav-library` (P02, P07, P10, P12; CODE_MAP §Data layer).
 * The only module that talks to the server. Every write sends If-Match (CODE_MAP rule 3).
 */
import { getRequestToken } from '@nextcloud/auth'
import DavClient from '@nextcloud/cdav-library'
import { generateRemoteUrl } from '@nextcloud/router'

const CALENDAR_SERVER_NAMESPACE = 'http://calendarserver.org/ns/'

/**
 * Connect a CalDAV client for the page session.
 *
 * @return {Promise<DavClient>}
 */
async function createClient() {
	const client = new DavClient({
		rootUrl: generateRemoteUrl('dav'),
		defaultHeaders: {
			requesttoken: getRequestToken(),
		},
	})
	await client.connect({ enableCalDAV: true })
	return client
}

/** Keep the connected client and discovered calendar handles for the page. */
export function createDavSession() {
	let clientPromise
	let calendarsPromise
	const connect = () => {
		if (!clientPromise) {
			const pending = createClient()
			clientPromise = pending
			pending.catch(() => {
				if (clientPromise === pending) {
					clientPromise = undefined
				}
			})
		}
		return clientPromise
	}
	const calendars = async (refresh = false) => {
		if (refresh || !calendarsPromise) {
			const pending = connect().then(findCalendars)
			calendarsPromise = pending
			pending.catch(() => {
				if (calendarsPromise === pending) {
					calendarsPromise = undefined
				}
			})
		}
		return calendarsPromise
	}
	const reset = () => {
		clientPromise = undefined
		calendarsPromise = undefined
	}
	return {
		client: connect,
		calendars,
		reset,
	}
}

let pageSession

/** The page's shared DAV session, created on first use. */
export function getDavSession() {
	pageSession ??= createDavSession()
	return pageSession
}

/**
 * @param {Error & {status?: number}} error the failed DAV request
 */
function shouldReconnect(error) {
	return error?.status === 401 || error?.status === -1
}

/**
 * @param {ReturnType<typeof createDavSession>} session the shared session
 * @param {() => Promise<unknown>} operation the DAV operation to run
 */
async function withReconnect(session, operation) {
	for (let attempt = 0; ; attempt++) {
		try {
			return await operation()
		} catch (error) {
			if (attempt > 0 || !shouldReconnect(error)) {
				throw error
			}
			session.reset()
		}
	}
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
 * @param {ReturnType<typeof createDavSession>} session the shared session
 * @param {string} url the task URL
 * @return {Promise<object>}
 */
async function findCalendarForTodo(session, url) {
	const calendar = (await session.calendars()).find((candidate) => url.startsWith(candidate.url))
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
 * @property {string} [color] collection colour
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
 * @param {ReturnType<typeof createDavSession>} [session] the shared session
 * @return {Promise<TaskCalendar[]>}
 */
export async function listTaskCalendars(session = getDavSession()) {
	return withReconnect(session, async () => {
		const client = await session.client()
		return (await session.calendars(true))
			.filter((calendar) => calendar.components.includes('VTODO'))
			.map((calendar) => {
				const color = calendar.color ?? calendar._props?.['{http://apple.com/ns/ical/}calendar-color']
				return {
					url: calendar.url,
					displayName: calendar.displayname,
					ownedByMe: calendar.owner === client.currentUserPrincipal.url,
					writable: calendar.isWriteable(),
					ctag: calendar.ctag ?? calendar._props[`{${CALENDAR_SERVER_NAMESPACE}}getctag`],
					...(color !== undefined ? { color } : {}),
				}
			})
	})
}

/**
 * Every VTODO on one list, open and done.
 *
 * @param {TaskCalendar} calendar the list
 * @param {ReturnType<typeof createDavSession>} [session] the shared session
 * @return {Promise<StoredTodo[]>}
 */
export async function fetchTodos(calendar, session = getDavSession()) {
	return withReconnect(session, async () => {
		const foundCalendar = await findCalendarForTodo(session, calendar.url)
		const todos = await foundCalendar.findByType('VTODO')
		return todos.map((todo) => storedTodo(todo, foundCalendar.url))
	})
}

/**
 * Re-read one task.
 *
 * @param {string} url the task's URL
 * @param {ReturnType<typeof createDavSession>} [session] the shared session
 * @return {Promise<StoredTodo>}
 */
export async function fetchTodo(url, session = getDavSession()) {
	return withReconnect(session, async () => {
		const calendar = await findCalendarForTodo(session, url)
		const todo = await calendar.find(url.slice(calendar.url.length))
		return storedTodo(todo, calendar.url)
	})
}

/**
 * The library reports every HTTP error (412 too) as status -1, so a failed
 * write is checked by re-reading the etag it was guarded by.
 *
 * @param {object} calendar the containing calendar
 * @param {string} path the task's path relative to the calendar
 * @param {string} etag the etag the write was made against
 * @return {Promise<boolean>}
 */
async function etagChanged(calendar, path, etag) {
	try {
		const current = await calendar.find(path)
		if (current.etag === undefined || current.etag === null) {
			return false
		}
		return current.etag !== etag
	} catch {
		return false
	}
}

/**
 * Replace a task's iCalendar text, guarded by If-Match.
 *
 * @param {string} url the task's URL
 * @param {string} ics new iCalendar text
 * @param {string} etag the etag the change was made against
 * @param {ReturnType<typeof createDavSession>} [session] the shared session
 * @return {Promise<{etag: string}>} the new etag
 * @throws {ConflictError} on HTTP 412
 */
export async function putTodo(url, ics, etag, session = getDavSession()) {
	return withReconnect(session, async () => {
		const calendar = await findCalendarForTodo(session, url)
		const path = url.slice(calendar.url.length)
		const todo = await calendar.find(path)
		todo.data = ics
		todo.etag = etag
		try {
			await todo.update()
		} catch (error) {
			if (error.status === 412 || (error.status === -1 && await etagChanged(calendar, path, etag))) {
				throw new ConflictError(url)
			}
			throw error
		}
		return { etag: todo.etag }
	})
}

/**
 * Create a task on a list (file name: random UUID + .ics, as Tasks does).
 *
 * @param {TaskCalendar} calendar the list
 * @param {string} ics iCalendar text
 * @param {ReturnType<typeof createDavSession>} [session] the shared session
 * @return {Promise<StoredTodo>}
 */
export async function createTodo(calendar, ics, session = getDavSession()) {
	return withReconnect(session, async () => {
		const foundCalendar = await findCalendarForTodo(session, calendar.url)
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
	})
}

/**
 * Why a MOVE failed: `exists` (the target list already has that file; 412 with Overwrite: F),
 * `target-missing` (the target list is gone), `failed` (anything else, the move may or may not have landed).
 * A changed or vanished source is a ConflictError instead.
 */
export class MoveError extends Error {
	/**
	 * @param {string} url the task's URL
	 * @param {number} status the HTTP status, -1 when no response came back
	 * @param {'exists'|'target-missing'|'failed'} reason why it failed
	 */
	constructor(url, status, reason) {
		super(`Could not move ${url}: HTTP ${status}`)
		this.name = 'MoveError'
		this.url = url
		this.status = status
		this.reason = reason
	}
}

/**
 * Re-read a task after a refused MOVE.
 *
 * @param {ReturnType<typeof createDavSession>} session the shared session
 * @param {string} url the task's URL
 * @param {string} etag the etag the MOVE was guarded by
 * @return {Promise<'same'|'changed'|'gone'|'unknown'>}
 */
async function sourceState(session, url, etag) {
	try {
		const calendar = await findCalendarForTodo(session, url)
		const current = await calendar.find(url.slice(calendar.url.length))
		if (current?.etag === undefined || current?.etag === null) {
			return 'unknown'
		}
		return current.etag === etag ? 'same' : 'changed'
	} catch (error) {
		return error?.status === 404 ? 'gone' : 'unknown'
	}
}

/**
 * Whether a list is still among the user's calendars (re-discovers them).
 *
 * @param {ReturnType<typeof createDavSession>} session the shared session
 * @param {string} calendarUrl the list's URL
 * @return {Promise<boolean>} true when it is there or cannot be checked
 */
async function calendarExists(session, calendarUrl) {
	try {
		const strip = (value) => value.replace(/\/+$/, '')
		return (await session.calendars(true)).some((calendar) => strip(calendar.url) === strip(calendarUrl))
	} catch {
		return true
	}
}

/**
 * CalDAV MOVE of one task to another list, keeping its file name:
 * `Destination: <target list>/<same file name>`, `Overwrite: F`, `If-Match: <etag>`.
 * Sent directly rather than through cdav-library, which reports every HTTP error as
 * status -1 and so cannot tell a changed task from a taken file name or a missing list.
 * The etag after a MOVE is not known: re-read the new URL (`fetchTodo`).
 *
 * @param {string} url the task's URL
 * @param {string} targetCalendarUrl the list to move it to
 * @param {string} etag the etag the move is made against
 * @param {ReturnType<typeof createDavSession>} [session] the shared session
 * @return {Promise<string>} the task's new URL
 * @throws {ConflictError} when the task changed or vanished (412, 404 or 409 with the target list present)
 * @throws {MoveError} otherwise
 */
export async function moveTodo(url, targetCalendarUrl, etag, session = getDavSession()) {
	const fileName = url.split('/').pop()
	const destination = `${targetCalendarUrl.replace(/\/+$/, '')}/${fileName}`
	const root = generateRemoteUrl('dav')
	let response
	try {
		response = await fetch(new URL(url, root).href, {
			method: 'MOVE',
			credentials: 'same-origin',
			headers: {
				Destination: new URL(destination, root).href,
				Overwrite: 'F',
				'If-Match': etag,
				requesttoken: getRequestToken(),
			},
		})
	} catch {
		throw new MoveError(url, -1, 'failed')
	}
	if (response.ok) {
		return destination
	}
	const status = response.status
	if (status === 412) {
		const state = await sourceState(session, url, etag)
		if (state === 'changed' || state === 'gone') {
			throw new ConflictError(url)
		}
		throw new MoveError(url, status, state === 'same' ? 'exists' : 'failed')
	}
	if (status === 404 || status === 409) {
		if (!await calendarExists(session, targetCalendarUrl)) {
			throw new MoveError(url, status, 'target-missing')
		}
		throw new ConflictError(url)
	}
	throw new MoveError(url, status, 'failed')
}
