import ICAL from 'ical.js'
import { describe, expect, it } from 'vitest'
import { dayKey, dueOnDay, rescheduleKey } from '../../src/models/day.js'

describe('rescheduleKey', () => {
	it('moves to tomorrow', () => {
		expect(rescheduleKey('tomorrow', '2026-10-31')).toBe('2026-11-01')
		expect(rescheduleKey('tomorrow', '2026-12-31')).toBe('2027-01-01')
	})

	it('moves to the next Monday, a full week on from a Monday', () => {
		expect(rescheduleKey('next-week', '2026-10-31')).toBe('2026-11-02') // Saturday
		expect(rescheduleKey('next-week', '2026-11-01')).toBe('2026-11-02') // Sunday
		expect(rescheduleKey('next-week', '2026-11-02')).toBe('2026-11-09') // Monday
		expect(rescheduleKey('next-week', '2026-11-06')).toBe('2026-11-09') // Friday
	})

	it('takes a picked day as it is', () => {
		expect(rescheduleKey('2026-12-24', '2026-10-31')).toBe('2026-12-24')
	})

	it('refuses anything else', () => {
		expect(() => rescheduleKey('someday', '2026-10-31')).toThrow(TypeError)
		expect(() => rescheduleKey('2026-1-5', '2026-10-31')).toThrow(TypeError)
	})
})

describe('dueOnDay', () => {
	it('gives a date-only time when the task has no due date', () => {
		const time = dueOnDay(null, '2026-11-03')

		expect(time.isDate).toBe(true)
		expect(time.toString()).toBe('2026-11-03')
	})

	it('keeps a date-only due date date-only', () => {
		const due = ICAL.Time.fromDateString('2026-10-30') // ical.js caches inside a Time, so it cannot be frozen: the last line checks it is unchanged
		const time = dueOnDay(due, '2026-11-03')

		expect(time.isDate).toBe(true)
		expect(time.toString()).toBe('2026-11-03')
		expect(due.toString()).toBe('2026-10-30')
	})

	it('keeps the clock time of a floating date-time', () => {
		const due = ICAL.Time.fromDateTimeString('2026-10-30T14:45:00')
		const time = dueOnDay(due, '2026-11-03')

		expect(time.isDate).toBe(false)
		expect(time.toString()).toBe('2026-11-03T14:45:00')
		expect(due.toString()).toBe('2026-10-30T14:45:00')
	})

	it('keeps the local clock time of a UTC date-time and stays UTC', () => {
		const due = ICAL.Time.fromDateTimeString('2026-10-30T12:00:00Z')
		const before = due.toJSDate()
		const time = dueOnDay(due, '2026-11-03')
		const after = time.toJSDate()

		expect(time.zone).toBe(ICAL.Timezone.utcTimezone)
		expect(dayKey(time)).toBe('2026-11-03')
		expect([after.getHours(), after.getMinutes()]).toEqual([before.getHours(), before.getMinutes()])
	})
})
