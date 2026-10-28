import { describe, expect, it } from 'vitest'
import { effectiveSortOrder } from '../../src/models/sortOrder.js'
import { Task } from '../../src/models/Task.js'
import { buildTree } from '../../src/models/tree.js'

function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value)
		Object.values(value).forEach(deepFreeze)
	}
	return value
}

const calendarUrl = '/remote.php/dav/calendars/owner/list-a/'

function ics(uid, lines = []) {
	return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VTODO', `UID:${uid}`, `SUMMARY:${uid}`, 'STATUS:NEEDS-ACTION', ...lines, 'END:VTODO', 'END:VCALENDAR', ''].join('\r\n')
}

function task(uid, lines = []) {
	return Task.fromIcs(ics(uid, lines), { url: `${calendarUrl}${uid}.ics`, etag: 'e', calendarUrl })
}

describe('effectiveSortOrder on tasks parsed from ICS', () => {
	it('is 100 for CREATED 100 seconds after 2001-01-01 and no sort order', () => {
		const order = effectiveSortOrder(task('t1', ['CREATED:20010101T000140Z']))
		expect(Number.isFinite(order)).toBe(true)
		expect(order).toBe(100)
	})

	it('is 794048460 for CREATED 2026-03-01T09:01:00Z and no sort order', () => {
		const order = effectiveSortOrder(task('t2', ['CREATED:20260301T090100Z']))
		expect(Number.isFinite(order)).toBe(true)
		expect(order).toBe(794048460)
	})
})

describe('buildTree with ordered and unordered siblings from ICS', () => {
	it('sorts a (order 10), c (created +100 s), b (created 2026-03-01), d (order 900000000)', () => {
		const areas = deepFreeze([{ name: 'Home', calendar: { url: calendarUrl } }])
		const tasks = Object.freeze([
			task('d', ['RELATED-TO:p', 'X-APPLE-SORT-ORDER:900000000']),
			task('b', ['RELATED-TO:p', 'CREATED:20260301T090100Z']),
			task('p', ['CATEGORIES:project']),
			task('c', ['RELATED-TO:p', 'CREATED:20010101T000140Z']),
			task('a', ['RELATED-TO:p', 'X-APPLE-SORT-ORDER:10']),
		])

		const result = buildTree(areas, tasks)

		expect(result.areas[0].projects[0].children.map((node) => node.task.uid)).toEqual(['a', 'c', 'b', 'd'])
		expect(tasks.map((item) => item.uid)).toEqual(['d', 'b', 'p', 'c', 'a'])
	})
})
