import { describe, expect, it } from 'vitest'
import { planCompletion } from '../../src/models/completion.js'
import { Task } from '../../src/models/Task.js'

function task(uid, { parent, categories, status } = {}) {
	const ics = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'BEGIN:VTODO',
		`UID:${uid}`,
		`SUMMARY:${uid}`,
		`STATUS:${status ?? 'NEEDS-ACTION'}`,
		status === 'COMPLETED' ? 'COMPLETED:20260101T000000Z' : null,
		categories ? `CATEGORIES:${categories}` : null,
		parent ? `RELATED-TO:${parent}` : null,
		'END:VTODO',
		'END:VCALENDAR',
		'',
	].filter((line) => line !== null).join('\r\n')
	return Task.fromIcs(ics, { url: `/list-b/${uid}.ics`, etag: '"e"', calendarUrl: '/list-b/' })
}

// The map is frozen; the Tasks inside are not (ical.js caches on its own objects when read).
const byUid = (...tasks) => Object.freeze(Object.fromEntries(tasks.map((item) => [item.uid, item])))
const DONE = 'COMPLETED'

describe('planCompletion: checking off', () => {
	it('lists the task, then its open descendants breadth-first, skipping closed ones and everything else', () => {
		const tasks = byUid(
			task('P', { categories: 'project' }),
			task('A', { parent: 'P' }),
			task('A1', { parent: 'A' }),
			task('A2', { parent: 'A', status: DONE }),
			task('A3', { parent: 'A', status: 'CANCELLED' }),
			task('A4', { parent: 'A' }),
			task('A1a', { parent: 'A1' }),
			task('B', { parent: 'P' }),
			task('X'),
		)

		expect(planCompletion(tasks, 'A', true)).toEqual(['A', 'A1', 'A4', 'A1a'])
	})

	it('lists just the task for a leaf, and never an ancestor', () => {
		const tasks = byUid(task('P', { categories: 'project' }), task('A', { parent: 'P' }))

		expect(planCompletion(tasks, 'A', true)).toEqual(['A'])
	})

	it('lists every open task under a project when the project is checked off', () => {
		const tasks = byUid(task('P', { categories: 'project' }), task('A', { parent: 'P' }), task('A1', { parent: 'A' }), task('B', { parent: 'P' }))

		expect(planCompletion(tasks, 'P', true)).toEqual(['P', 'A', 'B', 'A1'])
	})

	it('lists nothing when the task is already closed', () => {
		const tasks = byUid(task('A', { status: DONE }), task('C', { status: 'CANCELLED' }))

		expect(planCompletion(tasks, 'A', true)).toEqual([])
		expect(planCompletion(tasks, 'C', true)).toEqual([])
	})

	it('lists nothing for an unknown uid, and ends on a parent loop', () => {
		const tasks = byUid(task('X', { parent: 'Y' }), task('Y', { parent: 'X' }))

		expect(planCompletion(tasks, 'nope', true)).toEqual([])
		expect(planCompletion(tasks, 'X', true)).toEqual(['X', 'Y'])
	})

	it('reaches open tasks below a closed child', () => {
		const tasks = byUid(task('A'), task('A1', { parent: 'A', status: DONE }), task('A1a', { parent: 'A1' }))

		expect(planCompletion(tasks, 'A', true)).toEqual(['A', 'A1a'])
	})
})

describe('planCompletion: reopening', () => {
	it('lists the task, then each closed ancestor nearest first, up to and including the project', () => {
		const tasks = byUid(
			task('Z', { status: DONE }),
			task('P', { categories: 'project', status: DONE, parent: 'Z' }),
			task('A', { parent: 'P', status: DONE }),
			task('A1', { parent: 'A', status: DONE }),
			task('A1a', { parent: 'A1', status: DONE }),
			task('B', { parent: 'P', status: DONE }),
		)

		expect(planCompletion(tasks, 'A1', false)).toEqual(['A1', 'A', 'P'])
	})

	it('skips an ancestor that is still open', () => {
		const tasks = byUid(
			task('P', { categories: 'project', status: DONE }),
			task('A', { parent: 'P' }),
			task('A1', { parent: 'A', status: DONE }),
		)

		expect(planCompletion(tasks, 'A1', false)).toEqual(['A1', 'P'])
	})

	it('lists nothing when the task is already open', () => {
		const tasks = byUid(task('P', { categories: 'project', status: DONE }), task('A', { parent: 'P' }))

		expect(planCompletion(tasks, 'A', false)).toEqual([])
	})

	it('does not change any task', () => {
		const tasks = byUid(task('P', { categories: 'project' }), task('A', { parent: 'P' }), task('A1', { parent: 'A' }))

		planCompletion(tasks, 'A', true)

		expect(Object.values(tasks).map((item) => item.completed)).toEqual([false, false, false])
	})

	it('skips an open project', () => {
		const tasks = byUid(task('P', { categories: 'project' }), task('A', { parent: 'P', status: DONE }))

		expect(planCompletion(tasks, 'A', false)).toEqual(['A'])
	})
})
