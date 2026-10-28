import { describe, expect, it } from 'vitest'
import { reactive, toRaw } from 'vue'
import { Task } from '../../src/models/Task.js'

const ICS = [
	'BEGIN:VCALENDAR',
	'VERSION:2.0',
	'BEGIN:VTODO',
	'UID:reactive-001',
	'SUMMARY:Original title',
	'STATUS:NEEDS-ACTION',
	'DUE:20300304T000000Z',
	'PRIORITY:5',
	'DTSTAMP:20260101T000000Z',
	'LAST-MODIFIED:20260101T000000Z',
	'END:VTODO',
	'END:VCALENDAR',
	'',
].join('\r\n')

const where = {
	url: '/remote.php/dav/calendars/fixture/tasks/reactive-001.ics',
	etag: '"reactive-etag"',
	calendarUrl: '/remote.php/dav/calendars/fixture/tasks/',
}

function reactiveTask() {
	return reactive(Task.fromIcs(ICS, where))
}

function lines(ics) {
	return ics.split(/\r?\n/)
}

function count(ics, name) {
	return lines(ics).filter((line) => line.startsWith(`${name}:`) || line.startsWith(`${name};`)).length
}

describe('Task through a reactive proxy', () => {
	it.each([
		['summary', (task) => { task.summary = 'Renamed' }, 'SUMMARY', 'SUMMARY:Renamed'],
		['due', (task) => { task.due = new Date('2031-04-05T06:07:08Z') }, 'DUE', 'DUE:20310405T060708Z'],
		['priority', (task) => { task.priority = 1 }, 'PRIORITY', 'PRIORITY:1'],
		['completed', (task) => { task.completed = true }, 'COMPLETED', null],
	])('setting %s keeps one DTSTAMP, one LAST-MODIFIED and one changed property', (_name, edit, changed, expectedLine) => {
		const task = reactiveTask()

		edit(task)

		const ics = toRaw(task).toIcs()
		expect(count(ics, 'DTSTAMP')).toBe(1)
		expect(count(ics, 'LAST-MODIFIED')).toBe(1)
		expect(count(ics, changed)).toBe(1)
		if (expectedLine) {
			expect(lines(ics)).toContain(expectedLine)
		}

		if (changed === 'SUMMARY') {
			expect(lines(ics)).not.toContain('SUMMARY:Original title')
		}
	})
})
