import { describe, expect, it } from 'vitest'
import { appendNote } from '../../src/models/note.js'
import { Task } from '../../src/models/Task.js'

const ICS = Object.freeze([
	'BEGIN:VCALENDAR',
	'VERSION:2.0',
	'BEGIN:VTODO',
	'UID:t1',
	'SUMMARY:Swap the projector bulb',
	'DESCRIPTION:First line\\nSecond line',
	'LOCATION:Room 12',
	'X-CC-NOTE;X-KEEP=yes:agent field',
	'END:VTODO',
	'END:VCALENDAR',
	'',
].join('\r\n'))
const BARE = ICS.replace('DESCRIPTION:First line\\nSecond line\r\n', '').replace('LOCATION:Room 12\r\n', '')
const where = () => ({ url: '/a/t1.ics', etag: '"e"', calendarUrl: '/a/' })
const reread = (task) => Task.fromIcs(task.toIcs(), where())

describe('Task description and location', () => {
	it('reads DESCRIPTION with its line breaks, and LOCATION', () => {
		const task = Task.fromIcs(ICS, where())

		expect(task.description).toBe('First line\nSecond line')
		expect(task.location).toBe('Room 12')
	})

	it('reads null when either is missing', () => {
		const task = Task.fromIcs(BARE, where())

		expect(task.description).toBeNull()
		expect(task.location).toBeNull()
	})

	it('writes a new description that survives a round trip, keeping everything else', () => {
		const task = Task.fromIcs(ICS, where())
		task.description = 'One\nTwo'
		const again = reread(task)

		expect(again.description).toBe('One\nTwo')
		expect(again.location).toBe('Room 12')
		expect(again.summary).toBe('Swap the projector bulb')
		expect(task.toIcs()).toContain('X-CC-NOTE;X-KEEP=yes:agent field')
		expect(task.toIcs()).toMatch(/LAST-MODIFIED:/)
	})

	it('adds a description to a task that had none', () => {
		const task = Task.fromIcs(BARE, where())
		task.description = 'Fresh'

		expect(reread(task).description).toBe('Fresh')
	})

	it('removes the property for null or an empty string', () => {
		const task = Task.fromIcs(ICS, where())
		task.description = null
		task.location = ''

		expect(task.toIcs()).not.toMatch(/DESCRIPTION/)
		expect(task.toIcs()).not.toMatch(/LOCATION/)
		expect(reread(task).description).toBeNull()
	})

	it('writes a new location', () => {
		const task = Task.fromIcs(BARE, where())
		task.location = 'Lab 3'

		expect(reread(task).location).toBe('Lab 3')
	})

	it('leaves the stored text alone until something is set', () => {
		const task = Task.fromIcs(ICS, where())
		void task.description
		void task.location

		expect(task.toIcs()).toBe(ICS)
	})
})

describe('appendNote', () => {
	it('adds the note as a dated line after the description', () => {
		expect(appendNote('First line', 'Bulb swapped', '2026-10-31')).toBe('First line\n- 2026-10-31 Bulb swapped')
	})

	it('starts the description when there is none', () => {
		expect(appendNote(null, 'Done early', '2026-10-31')).toBe('- 2026-10-31 Done early')
		expect(appendNote('', 'Done early', '2026-10-31')).toBe('- 2026-10-31 Done early')
	})

	it('trims the note and the description\'s trailing space', () => {
		expect(appendNote('Line\n\n  ', '  spaced  ', '2026-10-31')).toBe('Line\n- 2026-10-31 spaced')
	})

	it('changes nothing for an empty or blank note', () => {
		expect(appendNote('Kept', '', '2026-10-31')).toBe('Kept')
		expect(appendNote('Kept', '   ', '2026-10-31')).toBe('Kept')
		expect(appendNote(null, '', '2026-10-31')).toBeNull()
		expect(appendNote('Kept', undefined, '2026-10-31')).toBe('Kept')
	})
})
