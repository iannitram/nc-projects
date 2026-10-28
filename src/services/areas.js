/**
 * Which task lists are areas (P02; CODE_MAP rules 4 and 5; ADR 0005). Pure.
 */

/** The eight areas, by display name, in panel order. */
export const AREA_NAMES = Object.freeze(['Personal', 'Channel', 'Project A', 'Project B', 'School 1', 'School 2', 'Home', 'System'])

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
 * The areas found among the user's lists, in AREA_NAMES order; missing names are skipped.
 *
 * @param {import('./dav.js').TaskCalendar[]} calendars every task list
 * @return {{name: string, calendar: import('./dav.js').TaskCalendar}[]}
 */
export function pickAreas(calendars) {
	// First filter out excluded calendars
	const validCalendars = calendars.filter((calendar) => !isExcluded(calendar))

	// Then find the first occurrence of each area name in order
	const result = []
	const seenNames = new Set()

	for (const calendar of validCalendars) {
		if (seenNames.has(calendar.displayName)) {
			continue
		}

		const indexInAreaNames = AREA_NAMES.indexOf(calendar.displayName)
		if (indexInAreaNames !== -1) {
			result.push({ name: calendar.displayName, calendar })
			seenNames.add(calendar.displayName)
		}
	}

	// Sort by the order in AREA_NAMES
	return result.sort((a, b) => {
		return AREA_NAMES.indexOf(a.name) - AREA_NAMES.indexOf(b.name)
	})
}
