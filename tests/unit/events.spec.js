import { describe, expect, it } from 'vitest'
import { eventsForDay } from '../../src/models/events.js'

function ics(...events) {
	const body = events.flatMap((lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'])
	return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...body, 'END:VCALENDAR', ''].join('\r\n')
}

const object = (calendarUrl, ...events) => Object.freeze({ ics: ics(...events), calendarUrl })
const DAY = '2026-10-31'

describe('eventsForDay', () => {
	it('reads a timed event as minutes from local midnight, with its calendar', () => {
		const objects = Object.freeze([object('/cal/', ['UID:e1', 'SUMMARY:Stand-up', 'DTSTART:20261031T091500', 'DTEND:20261031T094500'])])

		expect(eventsForDay(objects, DAY)).toEqual([
			{ uid: 'e1', title: 'Stand-up', start: 555, end: 585, allDay: false, calendarUrl: '/cal/' },
		])
	})

	it('reads DURATION when there is no DTEND', () => {
		const objects = [object('/cal/', ['UID:e1', 'SUMMARY:Call', 'DTSTART:20261031T140000', 'DURATION:PT1H30M'])]

		expect(eventsForDay(objects, DAY)[0]).toMatchObject({ start: 840, end: 930 })
	})

	it('reads an all-day event as the whole day', () => {
		const objects = [object('/cal/', ['UID:e1', 'SUMMARY:Holiday', 'DTSTART;VALUE=DATE:20261031', 'DTEND;VALUE=DATE:20261101'])]

		expect(eventsForDay(objects, DAY)).toEqual([
			{ uid: 'e1', title: 'Holiday', start: 0, end: 1440, allDay: true, calendarUrl: '/cal/' },
		])
	})

	it('leaves out events on other days and cancelled events', () => {
		const objects = [
			object('/cal/', ['UID:y', 'SUMMARY:Yesterday', 'DTSTART:20261030T100000', 'DTEND:20261030T110000']),
			object('/cal/', ['UID:t', 'SUMMARY:Tomorrow', 'DTSTART;VALUE=DATE:20261101', 'DTEND;VALUE=DATE:20261102']),
			object('/cal/', ['UID:c', 'SUMMARY:Off', 'STATUS:CANCELLED', 'DTSTART:20261031T100000', 'DTEND:20261031T110000']),
		]

		expect(eventsForDay(objects, DAY)).toEqual([])
	})

	it('clips an event that crosses midnight to the day', () => {
		const objects = [
			object('/cal/', ['UID:late', 'SUMMARY:Late', 'DTSTART:20261031T230000', 'DTEND:20261101T010000']),
			object('/cal/', ['UID:early', 'SUMMARY:Early', 'DTSTART:20261030T230000', 'DTEND:20261031T010000']),
		]

		expect(eventsForDay(objects, DAY).map((e) => [e.uid, e.start, e.end])).toEqual([['early', 0, 60], ['late', 1380, 1440]])
	})

	it('expands a repeating event onto the day', () => {
		const objects = [object('/cal/', ['UID:r', 'SUMMARY:Daily', 'DTSTART:20261026T080000', 'DTEND:20261026T083000', 'RRULE:FREQ=DAILY;COUNT=10'])]

		expect(eventsForDay(objects, DAY)).toEqual([{ uid: 'r', title: 'Daily', start: 480, end: 510, allDay: false, calendarUrl: '/cal/' }])
		expect(eventsForDay(objects, '2026-11-05')).toEqual([])
	})

	it('skips a repeat excluded with EXDATE', () => {
		const objects = [object('/cal/', ['UID:r', 'SUMMARY:Daily', 'DTSTART:20261026T080000', 'DTEND:20261026T083000', 'RRULE:FREQ=DAILY', 'EXDATE:20261031T080000'])]

		expect(eventsForDay(objects, DAY)).toEqual([])
		expect(eventsForDay(objects, '2026-11-01')).toHaveLength(1)
	})

	it('sorts by start, then title, across objects and calendars', () => {
		const objects = [
			object('/b/', ['UID:3', 'SUMMARY:Lunch', 'DTSTART:20261031T120000', 'DTEND:20261031T130000']),
			object('/a/', ['UID:2', 'SUMMARY:Beta', 'DTSTART:20261031T090000', 'DTEND:20261031T100000'], ['UID:1', 'SUMMARY:Alpha', 'DTSTART:20261031T090000', 'DTEND:20261031T093000']),
			object('/a/', ['UID:0', 'DTSTART;VALUE=DATE:20261031']),
		]

		expect(eventsForDay(objects, DAY).map((e) => [e.uid, e.title, e.calendarUrl])).toEqual([
			['0', '', '/a/'],
			['1', 'Alpha', '/a/'],
			['2', 'Beta', '/a/'],
			['3', 'Lunch', '/b/'],
		])
	})
})
