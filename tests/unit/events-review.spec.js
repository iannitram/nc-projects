import { describe, expect, it } from 'vitest'
import { eventsForDay } from '../../src/models/events.js'

function ics(...events) {
	const body = events.flatMap((lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'])
	return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...body, 'END:VCALENDAR', ''].join('\r\n')
}

const object = (calendarUrl, ...events) => Object.freeze({ ics: ics(...events), calendarUrl })
const DAY = '2026-10-31'

describe('eventsForDay, behaviour the locked tests do not cover', () => {
	it('clips a repeat that began the day before into the day', () => {
		const objects = [object('/cal/', ['UID:r', 'SUMMARY:Night', 'DTSTART:20261030T230000', 'DTEND:20261031T010000', 'RRULE:FREQ=DAILY;COUNT=10'])]

		expect(eventsForDay(objects, DAY).map((e) => [e.start, e.end])).toEqual([[0, 60], [1380, 1440]])
	})

	it('finds a daily repeat that started years before the day', () => {
		const objects = [object('/cal/', ['UID:d', 'SUMMARY:Old daily', 'DTSTART:20240101T080000', 'DTEND:20240101T083000', 'RRULE:FREQ=DAILY'])]

		expect(eventsForDay(objects, DAY)).toEqual([{ uid: 'd', title: 'Old daily', start: 480, end: 510, allDay: false, calendarUrl: '/cal/' }])
	})

	it('reads an object that carries a VTIMEZONE without throwing', () => {
		const text = [
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//test//EN',
			'BEGIN:VTIMEZONE',
			'TZID:Test/Fixed',
			'BEGIN:STANDARD',
			'DTSTART:19700101T000000',
			'TZOFFSETFROM:+0200',
			'TZOFFSETTO:+0200',
			'END:STANDARD',
			'END:VTIMEZONE',
			'BEGIN:VEVENT',
			'UID:z',
			'SUMMARY:Zoned',
			'DTSTART;TZID=Test/Fixed:20261031T100000',
			'DTEND;TZID=Test/Fixed:20261031T110000',
			'END:VEVENT',
			'END:VCALENDAR',
			'',
		].join('\r\n')

		const events = eventsForDay([Object.freeze({ ics: text, calendarUrl: '/cal/' })], DAY)

		expect(events).toHaveLength(1)
		expect(events[0].end - events[0].start).toBe(60)
	})
})
