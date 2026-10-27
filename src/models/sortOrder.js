/**
 * Order math, a copy of Tasks 0.18.1's rule (P08, P09; CODE_MAP §Facts and rule 6). Pure.
 * Stub: signatures only.
 */
import { notImplemented } from '../notImplemented.js'

/** 2001-01-01T00:00:00Z in ms: the zero point of Apple's sort order. */
export const APPLE_EPOCH_MS = Date.UTC(2001, 0, 1)

/**
 * The order a task sorts by: X-APPLE-SORT-ORDER, else seconds from APPLE_EPOCH to CREATED, else 0.
 *
 * @param {{sortOrder: (number|null), created: (Date|null)}} task the task
 * @return {number}
 */
export function effectiveSortOrder(task) {
	return notImplemented('effectiveSortOrder', task)
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
	return notImplemented('placeMoved', siblings, movedUid, newIndex)
}
