import { describe, expect, it } from 'vitest'
import { DAY_MAX, DAY_MIN, fitRange, hourMarks, layoutEvents, MIN_EVENT_PX, nowTop, PX_PER_MIN } from '../../src/models/timeline.js'

const ev = (uid, start, end, allDay = false) => Object.freeze({ uid, start, end, allDay })
const h = (hours) => hours * 60

describe('timeline constants', () => {
	it('spans 6am to 10pm at 34 px an hour, with events at least 14 px tall', () => {
		expect([DAY_MIN, DAY_MAX, PX_PER_MIN, MIN_EVENT_PX]).toEqual([360, 1320, 34 / 60, 14])
	})
})

describe('fitRange', () => {
	it('shows at least 7am to 5pm', () => {
		expect(fitRange([], h(12))).toEqual({ start: h(7), end: h(17) })
	})

	it('widens to whole hours around the events, plus an hour after the last', () => {
		expect(fitRange([ev('a', h(8) + 30, h(9)), ev('b', h(17) + 10, h(18) + 15)], h(12))).toEqual({ start: h(7), end: h(20) })
	})

	it('widens to take in the clock between 6am and 10pm', () => {
		expect(fitRange([], h(6) + 20)).toEqual({ start: h(6), end: h(17) })
		expect(fitRange([], h(19) + 5)).toEqual({ start: h(7), end: h(21) })
		expect(fitRange([], h(23))).toEqual({ start: h(7), end: h(17) })
	})

	it('never goes outside 6am to 10pm, and ignores all-day events', () => {
		expect(fitRange([ev('a', h(5), h(6)), ev('b', h(21) + 30, h(23))], h(12))).toEqual({ start: h(6), end: h(22) })
		expect(fitRange([ev('d', 0, 1440, true)], h(12))).toEqual({ start: h(7), end: h(17) })
	})
})

describe('hourMarks', () => {
	it('lists each whole hour from start to end', () => {
		expect(hourMarks({ start: h(7), end: h(10) })).toEqual([h(7), h(8), h(9), h(10)])
	})
})

describe('layoutEvents', () => {
	const range = Object.freeze({ start: h(7), end: h(17) })

	it('places an event by its minutes, two pixels short, at the given scale', () => {
		expect(layoutEvents([ev('a', h(8), h(9))], range, h(12), 1)).toEqual([
			{ uid: 'a', top: 60, height: 58, column: 0, columns: 1, past: true },
		])
		expect(layoutEvents([ev('a', h(8), h(9))], range, h(8))[0]).toMatchObject({ top: 34, height: 32, past: false })
	})

	it('gives a short event the minimum height', () => {
		expect(layoutEvents([ev('a', h(8), h(8) + 5)], range, 0, 1)[0].height).toBe(14)
	})

	it('puts overlapping events side by side, and a later one back in a free column', () => {
		const events = [ev('a', h(9), h(11)), ev('b', h(9) + 30, h(10)), ev('c', h(10), h(10) + 30), ev('d', h(12), h(13))]

		expect(layoutEvents(events, range, 0, 1).map((e) => [e.uid, e.column, e.columns])).toEqual([
			['a', 0, 2],
			['b', 1, 2],
			['c', 1, 2],
			['d', 0, 1],
		])
	})

	it('sorts by start, longer first on a tie, and counts three-way overlaps', () => {
		const events = [ev('short', h(9), h(9) + 30), ev('long', h(9), h(12)), ev('mid', h(9) + 15, h(10))]

		expect(layoutEvents(events, range, 0, 1).map((e) => [e.uid, e.column, e.columns])).toEqual([
			['long', 0, 3],
			['short', 1, 3],
			['mid', 2, 3],
		])
	})

	it('clips events to the range, and leaves out all-day events and those outside it', () => {
		const events = [ev('early', h(6), h(8)), ev('gone', h(5), h(6)), ev('day', 0, 1440, true)]

		expect(layoutEvents(events, range, 0, 1)).toEqual([{ uid: 'early', top: 0, height: 58, column: 0, columns: 1, past: false }])
	})
})

describe('nowTop', () => {
	it('puts the NOW line at the clock, or nowhere outside the range', () => {
		expect(nowTop(h(9) + 30, { start: h(7), end: h(17) }, 1)).toBe(150)
		expect(nowTop(h(7), { start: h(7), end: h(17) })).toBe(0)
		expect(nowTop(h(6), { start: h(7), end: h(17) })).toBeNull()
		expect(nowTop(h(18), { start: h(7), end: h(17) })).toBeNull()
	})
})
