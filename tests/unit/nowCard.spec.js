import { describe, expect, it } from 'vitest'
import { FREE_TITLES, nowCard } from '../../src/models/nowCard.js'

const ev = (uid, start, end, allDay = false) => Object.freeze({ uid, title: `T ${uid}`, start, end, allDay })
const h = (hours) => hours * 60
const DAY = Object.freeze([ev('a', h(9), h(10)), ev('b', h(11), h(12)), ev('c', h(14), h(15))])
const TASK = Object.freeze({ uid: 't1', summary: 'Order cables' })

describe('nowCard', () => {
	it('has the free-time titles', () => {
		expect(FREE_TITLES).toEqual({ none: 'No events today', before: 'Before the day', open: 'Open window', after: 'Day complete' })
	})

	it('names the running event, the minutes left in it and what comes next', () => {
		expect(nowCard({ events: DAY, nowMin: h(9) + 20 })).toEqual({
			kind: 'event',
			window: 'event',
			title: 'T a',
			uid: 'a',
			minutesLeft: 40,
			next: { title: 'T b', start: h(11) },
		})
	})

	it('prefers the running event over a task', () => {
		expect(nowCard({ events: DAY, nowMin: h(14), task: TASK })).toMatchObject({ kind: 'event', uid: 'c', minutesLeft: 60, next: null })
	})

	it('names the event that started last when several are running', () => {
		const events = [ev('long', h(9), h(12)), ev('inner', h(10), h(10) + 30)]

		expect(nowCard({ events, nowMin: h(10) + 10 })).toMatchObject({ uid: 'inner', minutesLeft: 20 })
		expect(nowCard({ events, nowMin: h(10) + 30 })).toMatchObject({ uid: 'long', minutesLeft: 90 })
	})

	it('treats an event as over at its end minute', () => {
		expect(nowCard({ events: DAY, nowMin: h(10) })).toMatchObject({ kind: 'free', window: 'open' })
	})

	it('names the task in a gap, with the minutes until the next event', () => {
		expect(nowCard({ events: DAY, nowMin: h(10) + 15, task: TASK })).toEqual({
			kind: 'task',
			window: 'open',
			title: 'Order cables',
			uid: 't1',
			minutesLeft: 45,
			next: { title: 'T b', start: h(11) },
		})
	})

	it('says before the day, open window or day complete with no task', () => {
		expect(nowCard({ events: DAY, nowMin: h(8) })).toEqual({
			kind: 'free',
			window: 'before',
			title: 'Before the day',
			uid: null,
			minutesLeft: 60,
			next: { title: 'T a', start: h(9) },
		})
		expect(nowCard({ events: DAY, nowMin: h(12) + 30 })).toMatchObject({ window: 'open', title: 'Open window', minutesLeft: 90 })
		expect(nowCard({ events: DAY, nowMin: h(16) })).toEqual({
			kind: 'free',
			window: 'after',
			title: 'Day complete',
			uid: null,
			minutesLeft: null,
			next: null,
		})
	})

	it('says no events today when there are none, or only all-day ones', () => {
		const expected = { kind: 'free', window: 'none', title: 'No events today', uid: null, minutesLeft: null, next: null }

		expect(nowCard({ events: [], nowMin: h(10) })).toEqual(expected)
		expect(nowCard({ events: [ev('d', 0, 1440, true)], nowMin: h(10) })).toEqual(expected)
		expect(nowCard({ events: [], nowMin: h(10), task: TASK })).toMatchObject({ kind: 'task', window: 'none', minutesLeft: null })
	})

	it('reads events in any order', () => {
		const shuffled = [DAY[2], DAY[0], DAY[1]]

		expect(nowCard({ events: shuffled, nowMin: h(8) }).next).toEqual({ title: 'T a', start: h(9) })
		expect(nowCard({ events: shuffled, nowMin: h(14) + 30 }).window).toBe('event')
	})

	it('does not reorder the events it is given', () => {
		const events = Object.freeze([DAY[2], DAY[0]])
		nowCard({ events, nowMin: h(9) })

		expect(events.map((e) => e.uid)).toEqual(['c', 'a'])
	})
})
