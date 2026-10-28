import ICAL from 'ical.js'

/**
 * Order math, a copy of Tasks 0.18.1's rule (P08, P09; CODE_MAP §Facts and rule 6). Pure.
 */
/** 2001-01-01T00:00:00Z in ms: the zero point of Apple's sort order. */
export const APPLE_EPOCH_MS = Date.UTC(2001, 0, 1)

/**
 * The order a task sorts by: X-APPLE-SORT-ORDER, else seconds from APPLE_EPOCH to CREATED, else 0.
 *
 * @param {{sortOrder: (number|null), created: (Date|import('ical.js').default.Time|null)}} task the task
 * @return {number}
 */
export function effectiveSortOrder(task) {
	if (typeof task.sortOrder === 'number') {
		return task.sortOrder
	}

	if (task.created) {
		let ms
		if (task.created instanceof Date) {
			ms = task.created.getTime()
		} else if (typeof task.created.year === 'number') {
			ms = createdMilliseconds(task, task.created)
		} else if (typeof task.created.toUnixTime === 'function') {
			try {
				ms = task.created.toUnixTime() * 1000
			} catch {
				ms = Number(task.created)
			}
		} else {
			ms = Number(task.created)
		}

		if (Number.isFinite(ms)) {
			return Math.floor((ms - APPLE_EPOCH_MS) / 1000)
		}
	}

	return 0
}

/**
 * Resolve CREATED without mutating its Time or registering a global timezone.
 * The property parameter survives even when ical.js resolves an unknown TZID as floating.
 *
 * @param {object} task the task and its original calendar resource
 * @param {object} created date/time fields (possibly reactive)
 * @return {number} milliseconds since the Unix epoch
 */
function createdMilliseconds(task, created) {
	const fields = {
		year: created.year,
		month: created.month || 1,
		day: created.day || 1,
		hour: created.hour || 0,
		minute: created.minute || 0,
		second: created.second || 0,
	}
	const wall = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second)
	const tzid = task.vtodo?.getFirstProperty('created')?.getParameter('tzid') || created.zone?.tzid
	if (!tzid || ['UTC', 'Z', 'floating'].includes(tzid)) {
		return wall
	}

	// Construct a private zone: its transition expansion cannot change the resource or global service.
	const component = task.component?.getAllSubcomponents('vtimezone')
		.find((zone) => zone.getFirstPropertyValue('tzid') === tzid)
	if (component) {
		const zone = new ICAL.Timezone({ component: new ICAL.Component(component.toJSON()), tzid })
		return new ICAL.Time(fields, zone).toUnixTime() * 1000
	}

	try {
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: tzid,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23',
		})
		let instant = wall
		// Re-evaluate at the candidate instant so offsets near a transition use the local date.
		for (let attempt = 0; attempt < 4; attempt++) {
			const parts = Object.fromEntries(formatter.formatToParts(instant)
				.map(({ type, value }) => [type, value]))
			const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
			const next = instant + wall - local
			if (next === instant) {
				return instant
			}
			instant = next
		}
		return instant
	} catch {
		// Unknown, resource-less TZIDs retain the previous floating-time behavior.
		return wall
	}
}

/**
 * Where a dragged task lands and which later siblings Tasks' rule bumps.
 *
 * @param {{uid: string, sortOrder: (number|null), created: (Date|null)}[]} siblings in display order, before the move
 * @param {string} movedUid the dragged task
 * @param {number} newIndex its index after the move
 * @return {{uid: string, sortOrder: number}[]} only the tasks to write: the moved one, then any bumped
 */
export function placeMoved(siblings, movedUid, newIndex) {
	// Find the moved task and remove it from the siblings array
	const movedTaskIndex = siblings.findIndex((sibling) => sibling.uid === movedUid)
	if (movedTaskIndex === -1) {
		return []
	}

	// Create a copy of the siblings array to avoid modifying original
	const newSiblings = siblings.map((sibling) => ({ ...sibling }))
	const movedTask = newSiblings.splice(movedTaskIndex, 1)[0]

	// Insert the moved task at its new index
	newSiblings.splice(newIndex, 0, movedTask)

	// Find neighbors in effective order
	let prev, next
	if (newIndex > 0) {
		prev = newSiblings[newIndex - 1]
	}
	if (newIndex < newSiblings.length - 1) {
		next = newSiblings[newIndex + 1]
	}

	// Calculate the moved task's new sort order value based on its neighbors
	let movedValue

	if (next && (!prev || effectiveSortOrder(next) - 1 > effectiveSortOrder(prev))) {
		movedValue = effectiveSortOrder(next) - 1
	} else if (prev) {
		movedValue = effectiveSortOrder(prev) + 1
	} else {
		// If there are no neighbors, keep the moved task's effective value
		movedValue = effectiveSortOrder(movedTask)
	}

	// Floor at 0 if needed
	movedValue = Math.max(0, movedValue)

	// Store the calculated value on the copied task, never on the caller's object
	movedTask.sortOrder = movedValue

	// Walk the siblings after the moved task and bump any that are colliding
	const result = [{ uid: movedUid, sortOrder: movedValue }]
	let currentValue = movedValue

	for (let i = newIndex + 1; i < newSiblings.length; i++) {
		const sibling = newSiblings[i]
		if (effectiveSortOrder(sibling) <= currentValue) {
			currentValue++
			sibling.sortOrder = currentValue
			result.push({ uid: sibling.uid, sortOrder: currentValue })
		} else {
			break
		}
	}

	return result
}
