import { describe, expect, it } from 'vitest'
import { dropUndoFor } from '../../src/models/undo.js'

// Reviewer probe for #158 (P20): a stated behaviour the locked undo.stack.spec.js does not reach.

const item = (uid) => ({ uid, before: { ics: `ICS ${uid}`, url: `/a/${uid}.ics`, calendarUrl: '/a/' }, after: { url: `/a/${uid}.ics`, etag: `"${uid}2"` } })

describe('dropUndoFor keeps only entries with at least one item', () => {
	it('drops an entry that had no items to begin with', () => {
		const stack = [{ label: 'empty', items: [] }, { label: 'one', items: [item('a')] }]

		expect(dropUndoFor(stack, 'zzz').map((e) => e.label)).toEqual(['one'])
	})
})
