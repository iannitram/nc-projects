export const DAY_MIN = 360
export const DAY_MAX = 1320
export const PX_PER_MIN = 34 / 60
export const MIN_EVENT_PX = 14

/**
 *
 * @param events
 * @param nowMin
 */
export function fitRange(events, nowMin) {
	let first = 420
	let last = 960

	for (const e of events) {
		if (!e.allDay) {
			first = Math.min(first, e.start)
			last = Math.max(last, e.end)
		}
	}

	if (nowMin >= DAY_MIN && nowMin <= DAY_MAX) {
		first = Math.min(first, nowMin)
		last = Math.max(last, nowMin)
	}

	return {
		start: Math.max(DAY_MIN, Math.floor(first / 60) * 60),
		end: Math.min(DAY_MAX, Math.ceil(last / 60) * 60 + 60),
	}
}

/**
 *
 * @param range
 */
export function hourMarks(range) {
	const marks = []
	for (let h = range.start; h <= range.end; h += 60) {
		marks.push(h)
	}
	return marks
}

/**
 *
 * @param events
 * @param range
 * @param nowMin
 * @param pxPerMin
 */
export function layoutEvents(events, range, nowMin, pxPerMin = PX_PER_MIN) {
	// Filter and clip events
	const clippedEvents = events
		.filter((e) => !e.allDay && e.end > range.start && e.start < range.end)
		.map((e) => ({
			...e,
			start: Math.max(e.start, range.start),
			end: Math.min(e.end, range.end),
		}))

	// Sort by start time, then by end time (longer first)
	clippedEvents.sort((a, b) => {
		if (a.start !== b.start) {
			return a.start - b.start
		}
		return b.end - a.end
	})

	// Layout events
	const result = []
	const columnEnds = [] // Each column's latest end time
	let clusterEnd = 0 // Latest end time in current cluster
	let clusterStart = 0 // Start time of current cluster

	for (const event of clippedEvents) {
		// If this event starts after the cluster ends, close the cluster
		if (event.start >= clusterEnd) {
			const clusterColumns = columnEnds.length
			// Assign columns to events in the previous cluster
			for (let i = clusterStart; i < result.length; i++) {
				result[i].columns = clusterColumns
			}
			columnEnds.length = 0 // Reset columns
			clusterStart = result.length // Start new cluster at current position
		}

		clusterEnd = Math.max(clusterEnd, event.end)

		// Find first column that can fit this event
		let column = -1
		for (let i = 0; i < columnEnds.length; i++) {
			if (columnEnds[i] <= event.start) {
				column = i
				break
			}
		}

		// If no suitable column found, create a new one
		if (column === -1) {
			column = columnEnds.length
		}

		// Update the end time of this column
		if (column >= columnEnds.length) {
			columnEnds.push(event.end)
		} else {
			columnEnds[column] = event.end
		}

		// Add event to result
		result.push({
			uid: event.uid,
			top: (event.start - range.start) * pxPerMin,
			height: Math.max((event.end - event.start) * pxPerMin - 2, MIN_EVENT_PX),
			column,
			columns: 0, // Will be set when cluster closes
			past: event.end <= nowMin,
		})
	}

	// Close the final cluster
	if (result.length > clusterStart) {
		const finalColumns = columnEnds.length
		for (let i = clusterStart; i < result.length; i++) {
			result[i].columns = finalColumns
		}
	}

	return result
}

/**
 *
 * @param nowMin
 * @param range
 * @param pxPerMin
 */
export function nowTop(nowMin, range, pxPerMin = PX_PER_MIN) {
	if (nowMin < range.start || nowMin > range.end) {
		return null
	}
	return (nowMin - range.start) * pxPerMin
}
