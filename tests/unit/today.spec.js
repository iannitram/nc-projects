import { describe, expect, it } from 'vitest'
import { Task } from '../../src/models/Task.js'
import { selectToday } from '../../src/models/today.js'

function task(uid, list, lines = []) {
	const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VTODO', `UID:${uid}`, `SUMMARY:${uid}`, ...lines, 'END:VTODO', 'END:VCALENDAR', ''].join('\r\n')
	return Task.fromIcs(ics, { url: `${list}${uid}.ics`, etag: '"e"', calendarUrl: list })
}

const TODAY = '2026-10-31'
const AREAS = Object.freeze([
	Object.freeze({ name: 'Area A', calendarUrl: '/a/' }),
	Object.freeze({ name: 'Area B', calendarUrl: '/b/' }),
	Object.freeze({ name: 'Area C', calendarUrl: '/c/' }),
])
const due = (day) => `DUE;VALUE=DATE:${day}`
const done = (at) => ['STATUS:COMPLETED', `COMPLETED:${at}`]

describe('selectToday', () => {
	it('lists open tasks due today and overdue, grouped by area in area order', () => {
		const tasks = Object.freeze([
			task('b1', '/b/', [due('20261031')]),
			task('a1', '/a/', [due('20261029')]),
			task('a2', '/a/', ['DUE:20261031T150000']),
			task('c1', '/c/', [due('20261101')]),
			task('c2', '/c/', []),
		])

		expect(selectToday(tasks, AREAS, TODAY).groups).toEqual([
			{ name: 'Area A', calendarUrl: '/a/', uids: ['a1', 'a2'] },
			{ name: 'Area B', calendarUrl: '/b/', uids: ['b1'] },
		])
	})

	it('leaves out cancelled tasks and tasks on other lists', () => {
		const tasks = [
			task('a1', '/a/', [due('20261031'), 'STATUS:CANCELLED']),
			task('x1', '/shared/', [due('20261031')]),
		]

		expect(selectToday(tasks, AREAS, TODAY)).toEqual({ groups: [], done: 0, total: 0 })
	})

	it('keeps a task completed today, in its place, and counts it as done', () => {
		const tasks = [
			task('a1', '/a/', [due('20261030'), ...done('20261031T120000Z')]),
			task('a2', '/a/', [due('20261031')]),
			task('b1', '/b/', [due('20261031')]),
		]

		expect(selectToday(tasks, AREAS, TODAY)).toEqual({
			groups: [
				{ name: 'Area A', calendarUrl: '/a/', uids: ['a1', 'a2'] },
				{ name: 'Area B', calendarUrl: '/b/', uids: ['b1'] },
			],
			done: 1,
			total: 3,
		})
	})

	it('drops a task completed on an earlier day (the day-end rule)', () => {
		const tasks = [task('a1', '/a/', [due('20261030'), ...done('20261030T120000Z')])]

		expect(selectToday(tasks, AREAS, TODAY).groups).toEqual([])
		expect(selectToday(tasks, AREAS, '2026-10-30').groups).toEqual([{ name: 'Area A', calendarUrl: '/a/', uids: ['a1'] }])
	})

	it('drops a task once it is re-dated past today', () => {
		const tasks = [task('a1', '/a/', [due('20261101')])]

		expect(selectToday(tasks, AREAS, TODAY).total).toBe(0)
	})

	it('orders a group by due day, then priority (none last), then title', () => {
		const tasks = [
			task('m', '/a/', [due('20261031'), 'PRIORITY:5']),
			task('n', '/a/', [due('20261031')]),
			task('k', '/a/', [due('20261031'), 'PRIORITY:1']),
			task('z', '/a/', [due('20261020'), 'PRIORITY:9']),
			task('b', '/a/', [due('20261031'), 'PRIORITY:5']),
			task('a', '/a/', [due('20261031')]),
		]

		expect(selectToday(tasks, AREAS, TODAY).groups[0].uids).toEqual(['z', 'k', 'b', 'm', 'a', 'n'])
	})

	it('does not reorder or change the tasks it is given', () => {
		const tasks = [task('a2', '/a/', [due('20261031')]), task('a1', '/a/', [due('20261030')])]
		const before = tasks.map((item) => item.toIcs())

		selectToday(tasks, AREAS, TODAY)

		expect(tasks.map((item) => item.uid)).toEqual(['a2', 'a1'])
		expect(tasks.map((item) => item.toIcs())).toEqual(before)
	})
})
