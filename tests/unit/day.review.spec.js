import ICAL from 'ical.js'
import { describe, expect, it } from 'vitest'
import { addDays, dayKey, dueKey, dueWindow } from '../../src/models/day.js'
import { Task } from '../../src/models/Task.js'

// Reviewer probes for #154 (P19): the edge cases the locked tests in day.spec.js do not reach.

function task(lines) {
	const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VTODO', 'UID:t', 'SUMMARY:t', ...lines, 'END:VTODO', 'END:VCALENDAR', ''].join('\r\n')
	return Task.fromIcs(ics, Object.freeze({ url: '/a/t.ics', etag: '"e"', calendarUrl: '/a/' }))
}

function localKey(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

describe('dayKey and dueKey on a UTC date-time', () => {
	it('reads an ICAL.Time in UTC as the local day of the instant', () => {
		const value = ICAL.Time.fromDateTimeString('2026-10-31T23:30:00')
		value.zone = ICAL.Timezone.utcTimezone
		expect(dayKey(value)).toBe(localKey(value.toJSDate()))
	})

	it('reads a DUE with a Z suffix as the local day of the instant', () => {
		expect(dueKey(task(['DUE:20261031T233000Z']))).toBe(localKey(new Date('2026-10-31T23:30:00Z')))
	})
})

describe('addDays at leap days, year ends and clock changes', () => {
	it('crosses a leap day and a year end', () => {
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
		expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
		expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
		expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
		expect(addDays('2026-12-31', 365)).toBe('2027-12-31')
	})

	it('crosses the clock changes of 2026 in both directions', () => {
		expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
		expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
		expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
		expect(addDays('2026-03-01', 40)).toBe('2026-04-10')
	})
})

describe('dueWindow at a year end and a leap day', () => {
	it('counts the next six days across New Year', () => {
		expect(dueWindow(task(['DUE;VALUE=DATE:20270102']), '2026-12-28')).toBe('week')
		expect(dueWindow(task(['DUE;VALUE=DATE:20270103']), '2026-12-28')).toBe('week')
		expect(dueWindow(task(['DUE;VALUE=DATE:20270104']), '2026-12-28')).toBe('later')
		expect(dueWindow(task(['DUE;VALUE=DATE:20261231']), '2026-12-31')).toBe('today')
		expect(dueWindow(task(['DUE;VALUE=DATE:20261230']), '2027-01-01')).toBe('overdue')
	})

	it('counts the next six days across a leap day', () => {
		expect(dueWindow(task(['DUE;VALUE=DATE:20280304']), '2028-02-27')).toBe('week')
		expect(dueWindow(task(['DUE;VALUE=DATE:20280305']), '2028-02-27')).toBe('later')
	})
})
