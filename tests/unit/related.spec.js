import { describe, expect, it } from 'vitest'
import { placeOf, projectOf, relatedTasks } from '../../src/models/related.js'
import { Task } from '../../src/models/Task.js'

function task(uid, { parent, project, location, status } = {}) {
	const ics = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'BEGIN:VTODO',
		`UID:${uid}`,
		`SUMMARY:${uid}`,
		status ? `STATUS:${status}` : null,
		status === 'COMPLETED' ? 'COMPLETED:20261031T120000Z' : null,
		project ? 'CATEGORIES:project' : null,
		parent ? `RELATED-TO:${parent}` : null,
		location ? `LOCATION:${location}` : null,
		'END:VTODO',
		'END:VCALENDAR',
		'',
	].filter((line) => line !== null).join('\r\n')
	return Task.fromIcs(ics, { url: `/a/${uid}.ics`, etag: '"e"', calendarUrl: '/a/' })
}

const byUid = (...tasks) => Object.freeze(Object.fromEntries(tasks.map((item) => [item.uid, item])))

describe('projectOf', () => {
	it('finds the nearest project above a task, or the project itself', () => {
		const tasks = byUid(task('P', { project: true }), task('A', { parent: 'P' }), task('A1', { parent: 'A' }))

		expect(projectOf(tasks, 'A1')).toBe('P')
		expect(projectOf(tasks, 'A')).toBe('P')
		expect(projectOf(tasks, 'P')).toBe('P')
	})

	it('is null for a loose task, an unknown uid, a missing parent and a parent loop', () => {
		const tasks = byUid(task('L'), task('M', { parent: 'gone' }), task('X', { parent: 'Y' }), task('Y', { parent: 'X' }))

		expect(projectOf(tasks, 'L')).toBeNull()
		expect(projectOf(tasks, 'nope')).toBeNull()
		expect(projectOf(tasks, 'M')).toBeNull()
		expect(projectOf(tasks, 'X')).toBeNull()
	})
})

describe('placeOf', () => {
	it('reads LOCATION trimmed and lower-cased, and empty for none', () => {
		expect(placeOf(task('A', { location: '  Room 12 ' }))).toBe('room 12')
		expect(placeOf(task('B'))).toBe('')
	})
})

describe('relatedTasks', () => {
	it('lists the open tasks under the same project, at any level, in map order', () => {
		const tasks = byUid(
			task('P', { project: true }),
			task('A', { parent: 'P' }),
			task('B', { parent: 'P', status: 'COMPLETED' }),
			task('C', { parent: 'P', status: 'CANCELLED' }),
			task('A1', { parent: 'A' }),
			task('Q', { project: true }),
			task('Q1', { parent: 'Q' }),
		)

		expect(relatedTasks(tasks, 'A', [])).toEqual(['A1'])
		expect(relatedTasks(tasks, 'A1', [])).toEqual(['A'])
	})

	it('lists the open tasks at the same location, ignoring case and spaces', () => {
		const tasks = byUid(
			task('A', { location: 'Room 12' }),
			task('B', { location: 'room 12 ' }),
			task('C', { location: 'Room 13' }),
			task('D'),
			task('E', { location: 'ROOM 12', status: 'COMPLETED' }),
		)

		expect(relatedTasks(tasks, 'A', [])).toEqual(['B'])
		expect(relatedTasks(tasks, 'D', [])).toEqual([])
	})

	it('joins both: the same project or the same location', () => {
		const tasks = byUid(
			task('P', { project: true, location: 'Lab' }),
			task('A', { parent: 'P', location: 'Lab' }),
			task('B', { parent: 'P' }),
			task('L', { location: 'lab' }),
			task('Z'),
		)

		expect(relatedTasks(tasks, 'A', [])).toEqual(['B', 'L'])
	})

	it('never lists the picked task, a project, or a task already acted on', () => {
		const tasks = byUid(task('P', { project: true }), task('A', { parent: 'P' }), task('B', { parent: 'P' }), task('C', { parent: 'P' }))

		expect(relatedTasks(tasks, 'A', Object.freeze(['B']))).toEqual(['C'])
	})

	it('treats leftOut as optional, and lists nothing for an unknown uid', () => {
		const tasks = byUid(task('P', { project: true }), task('A', { parent: 'P' }), task('B', { parent: 'P' }))

		expect(relatedTasks(tasks, 'A')).toEqual(['B'])
		expect(relatedTasks(tasks, 'nope')).toEqual([])
	})
})
