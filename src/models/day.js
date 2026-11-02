import ICAL from 'ical.js'

/**
 * Get the local YYYY-MM-DD key for a date or ICAL.Time
 *
 * @param {Date|ICAL.Time|null|undefined} value
 * @return {string|null}
 */
export function dayKey(value) {
	if (value === null || value === undefined) {
		return null
	}

	if (value instanceof Date) {
		const year = value.getFullYear()
		const month = String(value.getMonth() + 1).padStart(2, '0')
		const day = String(value.getDate()).padStart(2, '0')
		return `${year}-${month}-${day}`
	}

	if (value.isDate) {
		return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`
	}

	// For ICAL.Time with time component, get the local day
	return dayKey(value.toJSDate())
}

/**
 * Add days to a date key
 *
 * @param {string} key - YYYY-MM-DD
 * @param {number} n - number of days to add
 * @return {string}
 */
export function addDays(key, n) {
	const [year, month, day] = key.split('-').map(Number)
	const date = new Date(year, month - 1, day + n)
	return dayKey(date)
}

/**
 * Get the due date key for a task
 *
 * @param {object} task
 * @return {string|null}
 */
export function dueKey(task) {
	return dayKey(task.due)
}

/**
 * Get the completed date key for a task
 *
 * @param {object} task
 * @return {string|null}
 */
export function completedKey(task) {
	const completed = task.propertyValue('completed')
	return dayKey(completed)
}

/**
 * Determine the due window for a task
 *
 * @param {object} task
 * @param {string} today - YYYY-MM-DD
 * @return {'overdue'|'today'|'week'|'later'|'none'}
 */
export function dueWindow(task, today) {
	const due = dueKey(task)
	if (due === null) {
		return 'none'
	}

	if (due < today) {
		return 'overdue'
	}

	if (due === today) {
		return 'today'
	}

	if (due <= addDays(today, 6)) {
		return 'week'
	}

	return 'later'
}

/**
 * Get the rescheduled date key for a task
 *
 * @param {string} kind - 'tomorrow', 'next-week' or YYYY-MM-DD
 * @param {string} today - YYYY-MM-DD
 * @return {string}
 */
export function rescheduleKey(kind, today) {
	if (kind === 'tomorrow') {
		return addDays(today, 1)
	}

	if (kind === 'next-week') {
		const [year, month, day] = today.split('-').map(Number)
		const date = new Date(year, month - 1, day)
		const weekday = date.getDay()
		return addDays(today, (8 - weekday) % 7 || 7)
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(kind)) {
		return kind
	}

	throw new TypeError(`Invalid reschedule key: ${kind}`)
}

/**
 * Get a new due date on a specific day
 *
 * @param {ICAL.Time|null} due - The original due date
 * @param {string} key - YYYY-MM-DD
 * @return {ICAL.Time}
 */
export function dueOnDay(due, key) {
	const [year, month, day] = key.split('-').map(Number)

	if (!due || due.isDate) {
		return ICAL.Time.fromData({ year, month, day, isDate: true })
	}

	if (due.zone === ICAL.Timezone.utcTimezone) {
		const local = due.toJSDate()
		const moved = new Date(year, month - 1, day, local.getHours(), local.getMinutes(), local.getSeconds())
		const time = ICAL.Time.fromJSDate(moved, true)
		time.zone = ICAL.Timezone.utcTimezone
		return time
	}

	const time = due.clone()
	time.year = year
	time.month = month
	time.day = day
	return time
}
