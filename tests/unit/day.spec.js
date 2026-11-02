import ICAL from 'ical.js'
import { describe, expect, it } from 'vitest'
import { addDays, completedKey, dayKey, dueKey, dueWindow } from '../../src/models/day.js'
import { Task } from '../../src/models/Task.js'

function task(lines) {
	const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VTODO', 'UID:t', 'SUMMARY:t', ...lines, 'END:VTODO', 'END:VCALENDAR', ''].join('\r\n')
	return Task.fromIcs(ics, Object.freeze({ url: '/a/t.ics', etag: '"e"', calendarUrl: '/a/' }))
}

const TODAY = '2026-10-31'

describe('dayKey', () => {
	it('reads a date-only ICAL.Time as its own day', () => {
		expect(dayKey(ICAL.Time.fromDateString('2026-03-05'))).toBe('2026-03-05')
	})

	it('reads a floating date-time as its local day', () => {
		expect(dayKey(ICAL.Time.fromDateTimeString('2026-10-31T23:30:00'))).toBe('2026-10-31')
	})

	it('reads a Date as its local day, with zero padding', () => {
		expect(dayKey(new Date(2026, 0, 9, 8, 0))).toBe('2026-01-09')
	})

	it('returns null for no value', () => {
		expect(dayKey(null)).toBeNull()
		expect(dayKey(undefined)).toBeNull()
	})
})

describe('addDays', () => {
	it('adds and subtracts days across months and years', () => {
		expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
		expect(addDays('2026-10-31', 0)).toBe('2026-10-31')
	})

	it('is not thrown off by a clock change', () => {
		expect(addDays('2026-03-07', 2)).toBe('2026-03-09')
		expect(addDays('2026-10-24', 8)).toBe('2026-11-01')
	})
})

describe('dueKey and completedKey', () => {
	it('reads DUE as a date or a date-time', () => {
		expect(dueKey(task(['DUE;VALUE=DATE:20261030']))).toBe('2026-10-30')
		expect(dueKey(task(['DUE:20261031T090000']))).toBe('2026-10-31')
	})

	it('is null without DUE or COMPLETED', () => {
		expect(dueKey(task([]))).toBeNull()
		expect(completedKey(task([]))).toBeNull()
	})

	it('reads COMPLETED (UTC) as a local day', () => {
		expect(completedKey(task(['STATUS:COMPLETED', 'COMPLETED:20261031T120000Z']))).toBe('2026-10-31')
	})
})

describe('dueWindow', () => {
	it('sorts a task into overdue, today, week, later or none', () => {
		expect(dueWindow(task(['DUE;VALUE=DATE:20261030']), TODAY)).toBe('overdue')
		expect(dueWindow(task(['DUE;VALUE=DATE:20250101']), TODAY)).toBe('overdue')
		expect(dueWindow(task(['DUE;VALUE=DATE:20261031']), TODAY)).toBe('today')
		expect(dueWindow(task(['DUE:20261031T235900']), TODAY)).toBe('today')
		expect(dueWindow(task(['DUE;VALUE=DATE:20261101']), TODAY)).toBe('week')
		expect(dueWindow(task(['DUE;VALUE=DATE:20261106']), TODAY)).toBe('week')
		expect(dueWindow(task(['DUE;VALUE=DATE:20261107']), TODAY)).toBe('later')
		expect(dueWindow(task([]), TODAY)).toBe('none')
	})
})
