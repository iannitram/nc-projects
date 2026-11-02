import { describe, expect, it } from 'vitest'
import { planUndo } from '../../src/models/undo.js'

function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value)
		Object.values(value).forEach(deepFreeze)
	}
	return value
}

// Only the getters planUndo reads: etag, url and calendarUrl.
const now = (uid, calendarUrl, etag) => ({ uid, url: `${calendarUrl}${uid}.ics`, calendarUrl, etag })
function item(uid, fromList, toList, etag) {
	return {
		uid,
		before: { ics: `BEFORE ${uid}`, url: `${fromList}${uid}.ics`, calendarUrl: fromList },
		after: { url: `${toList}${uid}.ics`, etag },
	}
}

describe('planUndo', () => {
	it('puts the old copy back with the current etag', () => {
		const entry = deepFreeze({ label: 'Completed: a', items: [item('a', '/a/', '/a/', '"a2"')] })
		const tasks = deepFreeze({ a: now('a', '/a/', '"a2"') })

		expect(planUndo(entry, tasks)).toEqual({
			steps: [{ op: 'put', uid: 'a', url: '/a/a.ics', ics: 'BEFORE a', etag: '"a2"' }],
			conflicts: [],
		})
	})

	it('undoes the items newest first', () => {
		const entry = deepFreeze({ label: 'Reordered', items: [item('a', '/a/', '/a/', '"a2"'), item('b', '/a/', '/a/', '"b2"')] })
		const tasks = deepFreeze({ a: now('a', '/a/', '"a2"'), b: now('b', '/a/', '"b2"') })

		expect(planUndo(entry, tasks).steps.map((step) => step.uid)).toEqual(['b', 'a'])
	})

	it('moves a task back to its old list first, then puts the old copy with no etag (re-read after the move)', () => {
		const entry = deepFreeze({ label: 'Moved', items: [item('s', '/a/', '/b/', '"s2"'), item('t', '/a/', '/b/', '"t2"')] })
		const tasks = deepFreeze({ s: now('s', '/b/', '"s2"'), t: now('t', '/b/', '"t2"') })

		expect(planUndo(entry, tasks)).toEqual({
			steps: [
				{ op: 'move', uid: 't', url: '/b/t.ics', toCalendarUrl: '/a/', etag: '"t2"' },
				{ op: 'put', uid: 't', url: '/a/t.ics', ics: 'BEFORE t', etag: null },
				{ op: 'move', uid: 's', url: '/b/s.ics', toCalendarUrl: '/a/', etag: '"s2"' },
				{ op: 'put', uid: 's', url: '/a/s.ics', ics: 'BEFORE s', etag: null },
			],
			conflicts: [],
		})
	})

	it('refuses the whole undo when any task changed since, listing those tasks', () => {
		const entry = deepFreeze({ label: 'Reordered', items: [item('a', '/a/', '/a/', '"a2"'), item('b', '/a/', '/a/', '"b2"'), item('c', '/a/', '/a/', '"c2"')] })
		const tasks = deepFreeze({ a: now('a', '/a/', '"a3"'), b: now('b', '/a/', '"b2"'), c: now('c', '/a/', '"c9"') })

		expect(planUndo(entry, tasks)).toEqual({ steps: [], conflicts: ['c', 'a'] })
	})

	it('treats a task that is gone, or that moved elsewhere since, as changed', () => {
		const entry = deepFreeze({ label: 'Two', items: [item('a', '/a/', '/a/', '"a2"'), item('b', '/a/', '/a/', '"b2"')] })
		const tasks = deepFreeze({ b: now('b', '/c/', '"b2"') })

		expect(planUndo(entry, tasks)).toEqual({ steps: [], conflicts: ['b', 'a'] })
	})

	it('plans nothing for an entry with no items', () => {
		expect(planUndo(deepFreeze({ label: 'Empty', items: [] }), deepFreeze({}))).toEqual({ steps: [], conflicts: [] })
	})
})
