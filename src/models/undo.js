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
