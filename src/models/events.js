import ICAL from 'ical.js'

// Stops an endless rule. Daily repeats from years back need about a thousand steps to reach today.
const MAX_OCCURRENCES = 100000

const DAY_MS = 24 * 60 * 60 * 1000

// Repeat periods that are always the same length on the wall clock, in seconds.
const FIXED_PERIODS = { SECONDLY: 1, MINUTELY: 60, HOURLY: 3600, DAILY: 86400, WEEKLY: 604800 }

/**
 * A later start for walking a simple repeat, so an hourly repeat from decades ago does not
 * step through every past hour (#181). ical.js has no fast-forward, so for a rule that is only
 * FREQ (and INTERVAL, UNTIL) the start moves forward by whole repeat periods: it lands on a
 * real occurrence, and the ones after it are the same as from the first start.
 * Rules with COUNT or BY parts keep the first start, since skipping would change them.
 *
 * @param {ICAL.Event} event a repeating event
 * @param {number} beforeMs the new start stays at least this far before the day
 * @return {ICAL.Time|null} the start to walk from, or null to walk from the first start
 */
function fastForwardStart(event, beforeMs) {
	const rules = event.component.getAllProperties('rrule')
	if (rules.length !== 1) {
		return null
	}
	const rule = rules[0].getFirstValue()
	const period = FIXED_PERIODS[rule.freq]
	if (!period || rule.count || Object.keys(rule.parts).length > 0) {
		return null
	}
	const interval = rule.interval || 1
	const periodMs = period * interval * 1000
	const first = event.startDate
	// Two days of slack cover time zones and clock changes.
	const steps = Math.floor((beforeMs - 2 * DAY_MS - first.toJSDate().getTime()) / periodMs)
	if (steps <= 0) {
		return null
	}
	const start = first.clone()
	const amount = steps * interval
	if (rule.freq === 'WEEKLY') {
		start.adjust(amount * 7, 0, 0, 0)
	} else if (rule.freq === 'DAILY') {
		start.adjust(amount, 0, 0, 0)
	} else if (rule.freq === 'HOURLY') {
		start.adjust(0, amount, 0, 0)
	} else if (rule.freq === 'MINUTELY') {
		start.adjust(0, 0, amount, 0)
	} else {
		start.adjust(0, 0, 0, amount)
	}
	if (rule.until && start.compare(rule.until) > 0) {
		return null
	}
	return start
}

/**
 * Convert stored calendar objects into events for a specific day
 *
 * @param {Array<{ics: string, calendarUrl: string}>} objects - The calendar objects to process
 * @param {string} key - The date string in YYYY-MM-DD format
 * @return {Array<{uid: string, title: string, start: number, end: number, allDay: boolean, calendarUrl: string}>} Events for the day
 */
export function eventsForDay(objects, key) {
	// Parse the key to get the local midnight of that day in milliseconds
	const [year, month, day] = key.split('-').map(Number)
	const dayStart = new Date(year, month - 1, day)
	const dayEnd = new Date(year, month - 1, day)
	dayEnd.setDate(dayEnd.getDate() + 1)

	// Convert to milliseconds for comparison
	const dayStartMs = dayStart.getTime()
	const dayEndMs = dayEnd.getTime()

	const events = []

	for (const object of objects) {
		const component = ICAL.Component.fromString(object.ics)

		// Register timezones if present
		const vtimezones = component.getAllSubcomponents('vtimezone')
		for (const vtimezone of vtimezones) {
			const timezone = new ICAL.Timezone(vtimezone)
			if (!ICAL.TimezoneService.has(timezone.tzid)) {
				ICAL.TimezoneService.register(timezone)
			}
		}

		// Process each VEVENT in the component
		const vevents = component.getAllSubcomponents('vevent')
		for (const vevent of vevents) {
			// Skip cancelled events
			const status = vevent.getFirstPropertyValue('status')
			if (status === 'CANCELLED') {
				continue
			}

			const event = new ICAL.Event(vevent)

			// Handle recurring events
			const starts = []
			if (event.isRecurring()) {
				// Keep every start before the day's end, not only those on the day:
				// an occurrence that began the day before can still run into this day.
				// The overlap check below drops the rest.
				const durationMs = event.duration.toSeconds() * 1000
				const iterator = event.iterator(fastForwardStart(event, dayStartMs - durationMs) ?? undefined)
				for (let count = 0; count < MAX_OCCURRENCES; count++) {
					const next = iterator.next()
					if (!next || next.toJSDate().getTime() >= dayEndMs) {
						break
					}
					starts.push(next)
				}
			} else {
				starts.push(event.startDate)
			}

			// Process each start time
			for (const start of starts) {
				const allDay = start.isDate
				const from = start.toJSDate().getTime()
				const duration = event.duration.toSeconds() * 1000
				let to

				if (allDay && duration === 0) {
					// All-day events without a specified duration are assumed to be one day
					to = from + 24 * 60 * 60 * 1000
				} else {
					to = from + duration
				}

				// Skip if event doesn't overlap with the day
				if (to <= dayStartMs || from >= dayEndMs) {
					continue
				}

				// Calculate start and end minutes from local midnight
				const startMinutes = allDay ? 0 : Math.max(0, Math.round((from - dayStartMs) / 60000))
				const endMinutes = allDay ? 1440 : Math.min(1440, Math.round((to - dayStartMs) / 60000))

				events.push({
					uid: event.uid,
					title: event.summary || '',
					start: startMinutes,
					end: endMinutes,
					allDay,
					calendarUrl: object.calendarUrl,
				})
			}
		}
	}

	// Sort by start time, then by title
	events.sort((a, b) => {
		if (a.start !== b.start) {
			return a.start - b.start
		}
		if (a.title < b.title) {
			return -1
		}
		return a.title > b.title ? 1 : 0
	})

	return events
}
