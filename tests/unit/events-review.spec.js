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

describe('eventsForDay, repeats that started long ago (#181)', () => {
	it('finds an hourly repeat that started in 1990', () => {
		const objects = [object('/cal/', ['UID:h', 'SUMMARY:Hourly', 'DTSTART:19900101T000000', 'DTEND:19900101T001500', 'RRULE:FREQ=HOURLY'])]

		const events = eventsForDay(objects, DAY)

		expect(events).toHaveLength(24)
		expect(events[0]).toEqual({ uid: 'h', title: 'Hourly', start: 0, end: 15, allDay: false, calendarUrl: '/cal/' })
		expect(events[23].start).toBe(23 * 60)
	})

	it('keeps the INTERVAL phase when it jumps ahead', () => {
		const objects = [object('/cal/', ['UID:i', 'SUMMARY:Every 7 hours', 'DTSTART:19900101T030000', 'DTEND:19900101T033000', 'RRULE:FREQ=HOURLY;INTERVAL=7'])]
		// The same rule walked from its first start, for a day it can reach well inside the guard.
		const near = [object('/cal/', ['UID:i', 'SUMMARY:Every 7 hours', 'DTSTART:20260901T070000', 'DTEND:20260901T073000', 'RRULE:FREQ=HOURLY;INTERVAL=7'])]
		const hoursApart = (Date.UTC(2026, 8, 1, 7) - Date.UTC(1990, 0, 1, 3)) / 3600000
		expect(hoursApart % 7).toBe(0)

		expect(eventsForDay(objects, DAY)).toEqual(eventsForDay(near, DAY))
	})

	it('finds a minutely repeat from 2000 and an every-other-week repeat from 1980', () => {
		const minutely = [object('/cal/', ['UID:m', 'SUMMARY:Tick', 'DTSTART:20000101T000000', 'DURATION:PT1M', 'RRULE:FREQ=MINUTELY;INTERVAL=30'])]
		const fortnightly = [object('/cal/', ['UID:w', 'SUMMARY:Fortnight', 'DTSTART:19800105T090000', 'DTEND:19800105T100000', 'RRULE:FREQ=WEEKLY;INTERVAL=2'])]

		expect(eventsForDay(minutely, DAY)).toHaveLength(48)
		// 1980-01-05 and 2026-10-31 are both Saturdays, 2443 weeks apart: an odd count, so no event.
		expect(eventsForDay(fortnightly, DAY)).toEqual([])
		expect(eventsForDay(fortnightly, '2026-10-24')).toHaveLength(1)
	})

	it('still honours EXDATE and UNTIL after jumping ahead', () => {
		const objects = [object('/cal/', [
			'UID:x',
			'SUMMARY:Hourly',
			'DTSTART:19900101T000000',
			'DTEND:19900101T001500',
			'RRULE:FREQ=HOURLY;UNTIL=20261031T055959',
			'EXDATE:20261031T020000',
		])]

		expect(eventsForDay(objects, DAY).map((e) => e.start)).toEqual([0, 60, 180, 240, 300])
	})

	it('shows nothing for a repeat that ended before the day', () => {
		const objects = [object('/cal/', ['UID:e', 'SUMMARY:Ended', 'DTSTART:19900101T000000', 'DTEND:19900101T001500', 'RRULE:FREQ=HOURLY;UNTIL=19950101T000000'])]

		expect(eventsForDay(objects, DAY)).toEqual([])
	})

	it('keeps a long event that began before the jump target', () => {
		const objects = [object('/cal/', ['UID:l', 'SUMMARY:Long', 'DTSTART:19900101T120000', 'DURATION:P3D', 'RRULE:FREQ=WEEKLY'])]
		// 1990-01-01 is a Monday: the 2026-10-26 occurrence runs Monday noon to Thursday noon, over all of Wednesday.
		expect(eventsForDay(objects, '2026-10-28')).toEqual([{ uid: 'l', title: 'Long', start: 0, end: 1440, allDay: false, calendarUrl: '/cal/' }])
	})

	it('keeps a daily repeat from 1970 under 200 ms', () => {
		const objects = [object('/cal/', ['UID:d', 'SUMMARY:Daily', 'DTSTART:19700101T080000', 'DTEND:19700101T083000', 'RRULE:FREQ=DAILY'])]
		const started = performance.now()
		expect(eventsForDay(objects, DAY)).toHaveLength(1)
		expect(performance.now() - started).toBeLessThan(200)
	})

	it('walks a rule with COUNT from its first start, as before', () => {
		const objects = [object('/cal/', ['UID:c', 'SUMMARY:Counted', 'DTSTART:20261001T080000', 'DTEND:20261001T090000', 'RRULE:FREQ=DAILY;COUNT=31'])]

		expect(eventsForDay(objects, DAY)).toHaveLength(1)
		expect(eventsForDay(objects, '2026-11-01')).toEqual([])
	})
})
