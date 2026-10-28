/**
 * Which task lists may be selected as areas. Pure.
 */

/**
 * True for a list that is never an area: shared by someone else, an agent queue
 * (URL contains `_shared_by_`), or a Deck board (URL contains `app-generated--deck--`).
 *
 * @param {import('./dav.js').TaskCalendar} calendar the list
 * @return {boolean}
 */
export function isExcluded(calendar) {
	return calendar.ownedByMe === false || calendar.url.includes('_shared_by_') || calendar.url.includes('app-generated--deck--')
}

/**
 * The task lists the user may choose, in display order.
 *
 * @param {import('./dav.js').TaskCalendar[]} calendars every task list
 * @return {import('./dav.js').TaskCalendar[]}
 */
export function candidateLists(calendars) {
	return calendars.filter((calendar) => !isExcluded(calendar))
}

/**
 * Resolve saved calendar URLs to their current calendars, in the saved order.
 *
 * @param {import('./dav.js').TaskCalendar[]} calendars every task list
 * @param {string[]} areaLists selected calendar URLs
 * @return {{name: string, calendar: import('./dav.js').TaskCalendar}[]}
 */
export function pickAreas(calendars, areaLists) {
	return areaLists.flatMap((url) => {
		const calendar = calendars.find((candidate) => candidate.url === url && !isExcluded(candidate))
		return calendar ? [{ name: calendar.displayName, calendar }] : []
	})
}
