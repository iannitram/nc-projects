import { describe, expect, it } from 'vitest'
import { Task } from '../../src/models/Task.js'
import { NO_PRIORITY_WEIGHT, OVERDUE_FACTOR, PRIORITY_ALL, wheelPool, wheelWeight } from '../../src/models/wheel.js'

function task(uid, list, lines = []) {
	const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VTODO', `UID:${uid}`, `SUMMARY:${uid}`, ...lines, 'END:VTODO', 'END:VCALENDAR', ''].join('\r\n')
	return Task.fromIcs(ics, { url: `${list}${uid}.ics`, etag: '"e"', calendarUrl: list })
}

const TODAY = '2026-10-31'
const ALL = Object.freeze({
	priorityCutoff: PRIORITY_ALL,
	calendarUrls: Object.freeze(['/a/', '/b/']),
	windows: Object.freeze(['overdue', 'today', 'week', 'none']),
})
const filters = (changes) => Object.freeze({ ...ALL, ...changes })

describe('wheelWeight', () => {
	it('has the constants the brief names', () => {
		expect([PRIORITY_ALL, NO_PRIORITY_WEIGHT, OVERDUE_FACTOR]).toEqual([10, 5, 2])
	})

	it('weighs priority 1 to 9 as 10 down to 2, and no priority as 5', () => {
		const weights = [1, 2, 5, 9].map((p) => wheelWeight(task('t', '/a/', [`PRIORITY:${p}`]), TODAY))

		expect(weights).toEqual([10, 9, 6, 2])
		expect(wheelWeight(task('t', '/a/'), TODAY)).toBe(5)
		expect(wheelWeight(task('t', '/a/', ['PRIORITY:0']), TODAY)).toBe(5)
	})

	it('doubles the weight of an overdue task, and only an overdue one', () => {
		expect(wheelWeight(task('t', '/a/', ['PRIORITY:1', 'DUE;VALUE=DATE:20261030']), TODAY)).toBe(20)
		expect(wheelWeight(task('t', '/a/', ['DUE;VALUE=DATE:20261001']), TODAY)).toBe(10)
		expect(wheelWeight(task('t', '/a/', ['PRIORITY:1', 'DUE;VALUE=DATE:20261031']), TODAY)).toBe(10)
	})
})

describe('wheelPool', () => {
	const tasks = Object.freeze([
		task('open', '/a/', ['PRIORITY:3']),
		task('done', '/a/', ['STATUS:COMPLETED', 'COMPLETED:20261031T120000Z']),
		task('cancelled', '/a/', ['STATUS:CANCELLED']),
		task('project', '/a/', ['CATEGORIES:project']),
		task('late', '/b/', ['DUE;VALUE=DATE:20261020']),
		task('later', '/b/', ['DUE;VALUE=DATE:20261201', 'PRIORITY:1']),
		task('other', '/c/', []),
	])

	it('holds open, non-project tasks that pass every filter, in the order given, with their weights', () => {
		expect(wheelPool(tasks, ALL, TODAY)).toEqual({
			pool: [{ uid: 'open', weight: 8 }, { uid: 'late', weight: 10 }],
			filteredOut: { area: 1, window: 1, priority: 0 },
		})
	})

	it('leaves out the tasks already acted on', () => {
		expect(wheelPool(tasks, ALL, TODAY, Object.freeze(['open'])).pool).toEqual([{ uid: 'late', weight: 10 }])
	})

	it('keeps only the areas switched on', () => {
		const result = wheelPool(tasks, filters({ calendarUrls: ['/b/'] }), TODAY)

		expect(result.pool.map((item) => item.uid)).toEqual(['late'])
		expect(result.filteredOut.area).toBe(2)
	})

	it('keeps only the due windows switched on', () => {
		const result = wheelPool(tasks, filters({ windows: ['overdue', 'week'] }), TODAY)

		expect(result.pool.map((item) => item.uid)).toEqual(['late'])
		expect(result.filteredOut).toEqual({ area: 1, window: 2, priority: 0 })
		expect(wheelPool(tasks, filters({ windows: ['none'] }), TODAY).pool.map((item) => item.uid)).toEqual(['open'])
	})

	it('keeps priorities 1 to the cutoff, and no task without a priority below All', () => {
		const result = wheelPool(tasks, filters({ priorityCutoff: 3 }), TODAY)

		expect(result.pool.map((item) => item.uid)).toEqual(['open'])
		expect(result.filteredOut.priority).toBe(1)
		expect(wheelPool(tasks, filters({ priorityCutoff: 2 }), TODAY).pool).toEqual([])
	})

	it('counts a task against the first filter it fails: area, then window, then priority', () => {
		const result = wheelPool(tasks, filters({ calendarUrls: ['/a/'], windows: ['today'], priorityCutoff: 1 }), TODAY)

		expect(result).toEqual({ pool: [], filteredOut: { area: 3, window: 1, priority: 0 } })
	})
})
