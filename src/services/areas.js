/**
 * Which task lists are areas (P02; CODE_MAP rules 4 and 5; ADR 0005). Pure.
 * Stub: signatures only.
 */
import { notImplemented } from '../notImplemented.js'

/** The eight areas, by display name, in panel order. */
export const AREA_NAMES = Object.freeze(['Personal', 'The Channel', 'Van', 'Barnum', 'Cheltenham', 'DCIS', 'DPS', 'System'])

/**
 * True for a list that is never an area: shared by someone else, an agent queue
 * (URL contains `_shared_by_`), or a Deck board (URL contains `app-generated--deck--`).
 *
 * @param {import('./dav.js').TaskCalendar} calendar the list
 * @return {boolean}
 */
export function isExcluded(calendar) {
	return notImplemented('isExcluded', calendar)
}

/**
 * The areas found among the user's lists, in AREA_NAMES order; missing names are skipped.
 *
 * @param {import('./dav.js').TaskCalendar[]} calendars every task list
 * @return {{name: string, calendar: import('./dav.js').TaskCalendar}[]}
 */
export function pickAreas(calendars) {
	return notImplemented('pickAreas', calendars)
}
