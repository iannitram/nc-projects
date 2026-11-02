/**
 * Titles for free time windows
 */
export const FREE_TITLES = Object.freeze({
	none: 'No events today',
	before: 'Before the day',
	open: 'Open window',
	after: 'Day complete',
})

/**
 * Get the card content for the "now" section
 *
 * @param {object} params - The parameters
 * @param {Array} params.events - Array of events with uid, title, start, end, allDay
 * @param {number} params.nowMin - Current time in minutes from midnight
 * @param {object | null} params.task - The task to do now, or null
 * @return {object} The card content with kind, window, title, uid, minutesLeft, next
 */
export function nowCard({ events, nowMin, task = null }) {
	// Create a copy of events and filter out all-day events
	const timed = events
		.filter((event) => !event.allDay)
		.slice()
		.sort((a, b) => {
			if (a.start !== b.start) {
				return a.start - b.start
			}
			return a.end - b.end
		})

	// Find the current running event (starts before or at nowMin and ends after nowMin)
	let current = null
	for (const event of timed) {
		if (event.start <= nowMin && nowMin < event.end) {
			if (!current || event.start > current.start) {
				current = event
			}
		}
	}

	// Find the next upcoming event (starts after nowMin)
	let upcoming = null
	for (const event of timed) {
		if (event.start > nowMin) {
			if (!upcoming || event.start < upcoming.start) {
				upcoming = event
			}
		}
	}

	// Determine what comes next
	const next = upcoming ? { title: upcoming.title, start: upcoming.start } : null

	if (current) {
		// There is a running event
		return {
			kind: 'event',
			window: 'event',
			title: current.title,
			uid: current.uid,
			minutesLeft: current.end - nowMin,
			next,
		}
	}

	// No running event, determine the window type
	let windowType = 'none'
	if (timed.length > 0) {
		if (nowMin < timed[0].start) {
			windowType = 'before'
		} else {
			// Find the latest end time among all events
			const latestEnd = Math.max(...timed.map((event) => event.end))
			if (nowMin < latestEnd) {
				windowType = 'open'
			} else {
				windowType = 'after'
			}
		}
	}

	// Calculate minutes left to next event or null if none
	const minutesLeft = next ? next.start - nowMin : null

	// Return either a task or free time card
	if (task) {
		return {
			kind: 'task',
			window: windowType,
			title: task.summary,
			uid: task.uid,
			minutesLeft,
			next,
		}
	} else {
		return {
			kind: 'free',
			window: windowType,
			title: FREE_TITLES[windowType],
			uid: null,
			minutesLeft,
			next,
		}
	}
}
