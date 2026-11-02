import { describe, expect, it } from 'vitest'
import { dropUndoFor, popUndo, pushUndo, topUndo, UNDO_MAX } from '../../src/models/undo.js'

function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value)
		Object.values(value).forEach(deepFreeze)
	}
	return value
}

const item = (uid) => ({ uid, before: { ics: `ICS ${uid}`, url: `/a/${uid}.ics`, calendarUrl: '/a/' }, after: { url: `/a/${uid}.ics`, etag: `"${uid}2"` } })
const entry = (label, ...uids) => deepFreeze({ label, items: uids.map(item) })

describe('the undo stack', () => {
	it('keeps the last 10 by default', () => {
		expect(UNDO_MAX).toBe(10)
	})

	it('pushes the newest entry on top without changing the old stack', () => {
		const stack = deepFreeze([entry('one', 'a')])
		const next = pushUndo(stack, entry('two', 'b'))

		expect(next.map((e) => e.label)).toEqual(['one', 'two'])
		expect(stack.map((e) => e.label)).toEqual(['one'])
	})

	it('drops the oldest entry past the limit', () => {
		let stack = deepFreeze([])
		for (let i = 1; i <= 12; i++) {
			stack = deepFreeze(pushUndo(stack, entry(`e${i}`, 'a')))
		}

		expect(stack.map((e) => e.label)).toEqual(['e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12'])
		expect(pushUndo(deepFreeze([entry('x', 'a'), entry('y', 'b')]), entry('z', 'c'), 2).map((e) => e.label)).toEqual(['y', 'z'])
	})

	it('reads and pops the newest entry', () => {
		const stack = deepFreeze([entry('one', 'a'), entry('two', 'b')])

		expect(topUndo(stack).label).toBe('two')
		expect(popUndo(stack).map((e) => e.label)).toEqual(['one'])
		expect(stack).toHaveLength(2)
	})

	it('has no top and pops to empty when empty', () => {
		expect(topUndo([])).toBeNull()
		expect(popUndo(deepFreeze([]))).toEqual([])
	})

	it('drops one task from every entry, and entries left empty', () => {
		const stack = deepFreeze([entry('one', 'a'), entry('two', 'a', 'b'), entry('three', 'c')])
		const next = dropUndoFor(stack, 'a')

		expect(next.map((e) => [e.label, e.items.map((i) => i.uid)])).toEqual([['two', ['b']], ['three', ['c']]])
		expect(stack[1].items).toHaveLength(2)
	})

	it('keeps the stack the same when the task is in no entry', () => {
		const stack = deepFreeze([entry('one', 'a')])

		expect(dropUndoFor(stack, 'zzz')).toEqual(stack)
	})
})
