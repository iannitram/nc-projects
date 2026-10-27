/**
 * One VTODO, wrapped with `ical.js` (P03; CODE_MAP rules 1 and 2).
 * Keeps every property and parameter it does not edit, byte for byte where possible.
 * Stub: signatures only.
 */
import { notImplemented } from '../notImplemented.js'

export class Task {
	/**
	 * @param {string} ics raw iCalendar text
	 * @param {object} where where it is stored
	 * @param {string} where.url the task's URL ('' before it is created)
	 * @param {string} where.etag its etag ('' before it is created)
	 * @param {string} where.calendarUrl the list it lives on
	 * @return {Task}
	 */
	static fromIcs(ics, where) {
		return notImplemented('Task.fromIcs', ics, where)
	}

	/**
	 * A new open task, shaped like Tasks creates them (random UID, CREATED, DTSTAMP).
	 *
	 * @param {object} fields the new task's fields
	 * @param {string} fields.summary title
	 * @param {string} fields.calendarUrl the list it will live on
	 * @param {string} [fields.parentUid] bare RELATED-TO target
	 * @param {string[]} [fields.categories] e.g. ['project']
	 * @return {Task}
	 */
	static create(fields) {
		return notImplemented('Task.create', fields)
	}

	/**
	 * Serialize, keeping everything this class did not change.
	 *
	 * @return {string}
	 */
	toIcs() {
		return notImplemented('Task.toIcs')
	}
}

// Fields P03 adds as getters (and setters where marked): uid, summary (set), status,
// completed (set: true writes STATUS:COMPLETED + COMPLETED + PERCENT-COMPLETE:100; false clears them),
// closed (completed or CANCELLED), due (set), priority (set), categories (set), isProject,
// parentUid (set; bare RELATED-TO), sortOrder (set; X-APPLE-SORT-ORDER, null when absent),
// created, url, etag, calendarUrl.
