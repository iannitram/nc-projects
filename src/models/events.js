import ICAL from 'ical.js'

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
			if (!ICAL.TimezoneService.hasTimezone(timezone.tzid)) {
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
				const iterator = event.iterator()
				let next
				let count = 0
				while ((next = iterator.next()) && count < 1000) {
					if (next.toJSDate().getTime() >= dayEndMs) {
						break
					}
					if (next.toJSDate().getTime() >= dayStartMs) {
						starts.push(next)
					}
					count++
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
		return a.title.localeCompare(b.title)
	})

	return events
}
