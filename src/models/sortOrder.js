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
			const tzid = task.created.zone?.tzid
			if (tzid === 'UTC' || tzid === 'Z' || !task.created.zone) {
				ms = Date.UTC(
					task.created.year,
					(task.created.month || 1) - 1,
					task.created.day || 1,
					task.created.hour || 0,
					task.created.minute || 0,
					task.created.second || 0,
				)
			} else {
				try {
					ms = task.created.toUnixTime() * 1000
				} catch {
					ms = Date.UTC(
						task.created.year,
						(task.created.month || 1) - 1,
						task.created.day || 1,
						task.created.hour || 0,
						task.created.minute || 0,
						task.created.second || 0,
					)
				}
			}
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
