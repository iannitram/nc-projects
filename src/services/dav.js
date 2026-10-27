/**
 * CalDAV client over `@nextcloud/cdav-library` (P02, P07, P10, P12; CODE_MAP §Data layer).
 * The only module that talks to the server. Every write sends If-Match (CODE_MAP rule 3).
 * Stub: signatures only.
 */
import { notImplemented } from '../notImplemented.js'

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
	return notImplemented('listTaskCalendars')
}

/**
 * Every VTODO on one list, open and done.
 *
 * @param {TaskCalendar} calendar the list
 * @return {Promise<StoredTodo[]>}
 */
export async function fetchTodos(calendar) {
	return notImplemented('fetchTodos', calendar)
}

/**
 * Re-read one task.
 *
 * @param {string} url the task's URL
 * @return {Promise<StoredTodo>}
 */
export async function fetchTodo(url) {
	return notImplemented('fetchTodo', url)
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
	return notImplemented('putTodo', url, ics, etag)
}

/**
 * Create a task on a list (file name: random UUID + .ics, as Tasks does).
 *
 * @param {TaskCalendar} calendar the list
 * @param {string} ics iCalendar text
 * @return {Promise<StoredTodo>}
 */
export async function createTodo(calendar, ics) {
	return notImplemented('createTodo', calendar, ics)
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
