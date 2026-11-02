import { dueWindow } from './day.js'

/**
 * The priority cutoff that includes all priorities
 */
export const PRIORITY_ALL = 10

/**
 * The weight for tasks without a priority
 */
export const NO_PRIORITY_WEIGHT = 5

/**
 * The factor to multiply overdue task weights by
 */
export const OVERDUE_FACTOR = 2

/**
 * Calculate the weight of a task for the wheel
 *
 * @param {object} task
 * @param {string} today - YYYY-MM-DD
 * @return {number}
 */
export function wheelWeight(task, today) {
	const p = task.priority
	const base = (p >= 1 && p <= 9) ? 11 - p : NO_PRIORITY_WEIGHT
	const dueWin = dueWindow(task, today)
	return dueWin === 'overdue' ? base * OVERDUE_FACTOR : base
}

/**
 * Get the tasks that pass the filters for the wheel
 *
 * @param {object[]} tasks
 * @param {object} filters
 * @param {number} filters.priorityCutoff
 * @param {string[]} filters.calendarUrls
 * @param {string[]} filters.windows
 * @param {string} today - YYYY-MM-DD
 * @param {string[]} leftOut
 * @return {{pool: {uid: string, weight: number}[], filteredOut: {area: number, window: number, priority: number}}}
 */
export function wheelPool(tasks, filters, today, leftOut = []) {
	const pool = []
	const filteredOut = { area: 0, window: 0, priority: 0 }

	for (const task of tasks) {
		// Skip closed tasks, projects, and tasks already acted on
		if (task.closed || task.isProject || leftOut.includes(task.uid)) {
			continue
		}

		// Check area filter
		if (!filters.calendarUrls.includes(task.calendarUrl)) {
			filteredOut.area++
			continue
		}

		// Check window filter
		const dueWin = dueWindow(task, today)
		if (!filters.windows.includes(dueWin)) {
			filteredOut.window++
			continue
		}

		// Check priority cutoff
		if (filters.priorityCutoff < PRIORITY_ALL) {
			if (task.priority === null || task.priority === 0) {
				filteredOut.priority++
				continue
			}
			if (task.priority > filters.priorityCutoff) {
				filteredOut.priority++
				continue
			}
		}

		// Task passes all filters, add to pool
		pool.push({
			uid: task.uid,
			weight: wheelWeight(task, today),
		})
	}

	return { pool, filteredOut }
}
