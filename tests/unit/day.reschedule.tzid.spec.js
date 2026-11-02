import ICAL from 'ical.js'
import { describe, expect, it } from 'vitest'
import { dueOnDay } from '../../src/models/day.js'

// A fixed UTC-5 zone, so the test does not depend on the machine's clock zone or on DST.
function dueWithTzid(tzid, value) {
	const ics = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//test//EN',
		'BEGIN:VTIMEZONE',
		`TZID:${tzid}`,
		'BEGIN:STANDARD',
		'DTSTART:19700101T000000',
		'TZOFFSETFROM:-0500',
		'TZOFFSETTO:-0500',
		'END:STANDARD',
		'END:VTIMEZONE',
		'BEGIN:VTODO',
		`DUE;TZID=${tzid}:${value}`,
		'END:VTODO',
		'END:VCALENDAR',
	].join('\r\n')

	return new ICAL.Component(ICAL.parse(ics)).getFirstSubcomponent('vtodo').getFirstPropertyValue('due')
}

describe('dueOnDay with a TZID date-time', () => {
	it('keeps the clock time and the TZID zone, and leaves the old DUE unchanged', () => {
		const due = dueWithTzid('Test/Fixed', '20261030T144500')
		const time = dueOnDay(due, '2026-11-03')

		expect(time.isDate).toBe(false)
		expect(time.toString()).toBe('2026-11-03T14:45:00')
		expect(time.zone.tzid).toBe('Test/Fixed')
		expect(due.toString()).toBe('2026-10-30T14:45:00')
	})
})
