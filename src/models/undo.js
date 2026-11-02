/**
 * One stored copy of a task around a change
 *
 * @typedef {object} UndoItem
 * @property {string} uid - The task uid
 * @property {{ics: string, url: string, calendarUrl: string}} before - The stored copy before the write
 * @property {{url: string, etag: string}} after - Where the task is stored after the write, with its new etag
 */

/**
 * One undoable change: a label and the tasks it wrote
 *
 * @typedef {object} UndoEntry
 * @property {string} label - What the change was
 * @property {UndoItem[]} items - The tasks the change wrote
 */

/**
 * Maximum number of undo entries to keep
 *
 * @type {number}
 */
export const UNDO_MAX = 10

/**
 * Pushes a new entry onto the undo stack, keeping at most `max` entries
 *
 * @param {UndoEntry[]} stack - The current undo stack
 * @param {UndoEntry} entry - The entry to add
 * @param {number} [max] - Maximum entries to keep
 * @return {UndoEntry[]} A new array with the entry added and oldest entries removed if necessary
 */
export function pushUndo(stack, entry, max = UNDO_MAX) {
	const next = [...stack, entry]
	return next.slice(Math.max(0, next.length - max))
}

/**
 * Gets the newest entry from the undo stack or null if empty
 *
 * @param {UndoEntry[]} stack - The current undo stack
 * @return {UndoEntry|null} The newest entry or null if empty
 */
export function topUndo(stack) {
	return stack.length > 0 ? stack[stack.length - 1] : null
}

/**
 * Removes the newest entry from the undo stack
 *
 * @param {UndoEntry[]} stack - The current undo stack
 * @return {UndoEntry[]} A new array with the newest entry removed
 */
export function popUndo(stack) {
	return stack.slice(0, -1)
}

/**
 * Removes all entries containing a specific task uid and drops empty entries
 *
 * @param {UndoEntry[]} stack - The current undo stack
 * @param {string} uid - The task uid to remove
 * @return {UndoEntry[]} A new array with entries containing the uid removed and empty entries dropped
 */
export function dropUndoFor(stack, uid) {
	const result = stack.map((entry) => ({
		...entry,
		items: entry.items.filter((item) => item.uid !== uid),
	})).filter((entry) => entry.items.length > 0)

	return result
}

/**
 * Plans the CalDAV writes to restore the tasks in an undo entry
 *
 * @param {UndoEntry} entry - The undo entry to plan
 * @param {Record<string, {url: string, etag: string, calendarUrl: string}>} tasksByUid - Current task data by uid
 * @return {{steps: ({op: 'move', uid, url, toCalendarUrl, etag} | {op: 'put', uid, url, ics, etag: string|null})[], conflicts: string[]}} The steps to perform and any conflicts
 */
export function planUndo(entry, tasksByUid) {
	// Get items in reverse order (newest first)
	const items = [...entry.items].reverse()

	// Check for conflicts
	const conflicts = []
	for (const item of items) {
		const current = tasksByUid[item.uid]
		if (!current
			|| current.etag !== item.after.etag
			|| current.url !== item.after.url) {
			conflicts.push(item.uid)
		}
	}

	// If there are conflicts, return empty steps and the list of conflicting uids
	if (conflicts.length > 0) {
		return { steps: [], conflicts }
	}

	// Build the steps
	const steps = []
	for (const item of items) {
		const current = tasksByUid[item.uid]
		const moved = current.calendarUrl !== item.before.calendarUrl

		// If the task was moved, we need to move it back first
		if (moved) {
			steps.push({
				op: 'move',
				uid: item.uid,
				url: current.url,
				toCalendarUrl: item.before.calendarUrl,
				etag: current.etag,
			})
		}

		// Then put the old copy back
		steps.push({
			op: 'put',
			uid: item.uid,
			url: item.before.url,
			ics: item.before.ics,
			etag: moved ? null : current.etag,
		})
	}

	return { steps, conflicts: [] }
}
