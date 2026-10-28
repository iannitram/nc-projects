import ICAL from 'ical.js'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { effectiveSortOrder } from '../../src/models/sortOrder.js'
import { Task } from '../../src/models/Task.js'

function timezone(tzid, standard, daylight, start, end) {
	return [
		'BEGIN:VTIMEZONE',
		`TZID:${tzid}`,
		'BEGIN:DAYLIGHT',
		'DTSTART:19700329T020000',
		`RRULE:FREQ=YEARLY;${start}`,
		`TZOFFSETFROM:${standard}`,
		`TZOFFSETTO:${daylight}`,
		'END:DAYLIGHT',
		'BEGIN:STANDARD',
		'DTSTART:19701025T020000',
		`RRULE:FREQ=YEARLY;${end}`,
		`TZOFFSETFROM:${daylight}`,
		`TZOFFSETTO:${standard}`,
		'END:STANDARD',
		'END:VTIMEZONE',
	]
}

const zones = [
	['Europe/London', '+0000', '+0100', 'BYMONTH=3;BYDAY=-1SU', 'BYMONTH=10;BYDAY=-1SU', '080100', '090100'],
	['America/Denver', '-0700', '-0600', 'BYMONTH=3;BYDAY=2SU', 'BYMONTH=11;BYDAY=1SU', '150100', '160100'],
]

function parse(created, block = []) {
	return Task.fromIcs([
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		...block,
		'BEGIN:VTODO',
		'UID:timezone-test',
		created,
		'END:VTODO',
		'END:VCALENDAR',
		'',
	].join('\r\n'), { url: '', etag: '', calendarUrl: '' })
}

describe('CREATED timezone sort order', () => {
	for (const wrap of [(value) => value, reactive]) {
		for (const withBlock of [false, true]) {
			for (const [tzid, standard, daylight, start, end, summer, winter] of zones) {
				for (const [date, utc] of [['20260727', summer], ['20261227', winter]]) {
					it(`${tzid} ${date}, VTIMEZONE=${withBlock}, reactive=${wrap === reactive}`, () => {
						const before = ICAL.TimezoneService.get(tzid)
						const block = withBlock ? timezone(tzid, standard, daylight, start, end) : []
						const task = wrap(parse(`CREATED;TZID=${tzid}:${date}T090100`, block))
						const original = task.toIcs()
						const expected = effectiveSortOrder(parse(`CREATED:${date}T${utc}Z`))
						expect(effectiveSortOrder(task)).toBe(expected)
						expect(effectiveSortOrder(task)).toBe(expected)
						expect(task.toIcs()).toBe(original)
						expect(ICAL.TimezoneService.get(tzid)).toBe(before)
					})
				}
			}
		}

		it(`keeps UTC and floating values unchanged, reactive=${wrap === reactive}`, () => {
			for (const suffix of ['Z', '']) {
				expect(effectiveSortOrder(wrap(parse(`CREATED:20261027T090100${suffix}`)))).toBe(814784460)
			}
		})

		it(`uses GMT for London on October 27, reactive=${wrap === reactive}`, () => {
			expect(effectiveSortOrder(wrap(parse('CREATED;TZID=Europe/London:20261027T090100')))).toBe(814784460)
			expect(effectiveSortOrder(wrap(parse('CREATED;TZID=America/Denver:20261027T090100')))).toBe(814806060)
		})

		it(`prefers resource rules over IANA rules without leaking them, reactive=${wrap === reactive}`, () => {
			const block = timezone('Europe/London', '+0200', '+0200', 'BYMONTH=3;BYDAY=-1SU', 'BYMONTH=10;BYDAY=-1SU')
			const task = wrap(parse('CREATED;TZID=Europe/London:20261027T090100', block))
			expect(effectiveSortOrder(task)).toBe(effectiveSortOrder(parse('CREATED:20261027T070100Z')))
			expect(effectiveSortOrder(parse('CREATED;TZID=Europe/London:20261027T090100'))).toBe(814784460)
		})
	}
})
