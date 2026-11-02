import { completedKey, dueKey } from './day.js'

/**
 * Priority rank: 1-9 as given, anything else (none, 0, or out of range) last at 10.
 *
 * @param {object} task
 * @return {number}
 */
function rank(task) {
	const p = task.priority
	return Number.isInteger(p) && p >= 1 && p <= 9 ? p : 10
}

/**
 * Select today's tasks: open tasks due today or overdue on the areas,
 * plus those completed today (the day-end rule), grouped by area in area order.
 *
 * @param {object[]} tasks
 * @param {object[]} areas
 * @param {string} today - YYYY-MM-DD
 * @return {{groups: {name: string, calendarUrl: string, uids: string[]}[], done: number, total: number}}
 */
export function selectToday(tasks, areas, today) {
	// Filter tasks that are due today or before, not cancelled, and either open or completed today
	const picked = tasks.filter((task) => {
		const due = dueKey(task)
		const completed = completedKey(task)
		return due !== null
			&& due <= today
			&& task.status !== 'CANCELLED'
			&& (!task.completed || completed === today)
	})

	// Sort the picked tasks by due date, then priority (1 first, none last), then title
	const sorted = [...picked].sort((a, b) => {
		const dueA = dueKey(a)
		const dueB = dueKey(b)

		// Compare due dates
		if (dueA !== dueB) {
			return dueA < dueB ? -1 : 1
		}

		// Compare priorities (1 first, then 2, 3, ..., none last)
		const priorityA = rank(a)
		const priorityB = rank(b)
		if (priorityA !== priorityB) {
			return priorityA < priorityB ? -1 : 1
		}

		// Compare titles
		const titleA = a.summary ?? ''
		const titleB = b.summary ?? ''
		return titleA < titleB ? -1 : (titleA > titleB ? 1 : 0)
	})

	// Group tasks by area
	const groups = []
	const done = []
	let total = 0

	for (const area of areas) {
		const areaTasks = sorted.filter((task) => task.calendarUrl === area.calendarUrl)

		if (areaTasks.length > 0) {
			const uids = areaTasks.map((task) => task.uid)
			groups.push({
				name: area.name,
				calendarUrl: area.calendarUrl,
				uids,
			})

			// Count completed tasks in this group
			const groupDone = areaTasks.filter((task) => task.completed).length
			done.push(groupDone)

			total += areaTasks.length
		}
	}

	return {
		groups,
		done: done.reduce((sum, count) => sum + count, 0),
		total,
	}
}
