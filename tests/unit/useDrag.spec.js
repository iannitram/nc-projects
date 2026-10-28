import { describe, expect, it, vi } from 'vitest'
import { DRAG_OPTIONS, fullIndexForDrop, onSiblingDrop } from '../../src/composables/useDrag.js'

describe('useDrag', () => {
	describe('onSiblingDrop', () => {
		const drop = {
			parentUid: 'p1',
			allUids: ['t1', 't2', 't3'],
			visibleUids: ['t1', 't2', 't3'],
		}

		it('calls store.reorder with the parent, null area, the moved uid and the new index', async () => {
			const store = { reorder: vi.fn().mockResolvedValue(undefined) }

			await onSiblingDrop(store, drop, { oldIndex: 0, newIndex: 2 })

			expect(store.reorder).toHaveBeenCalledTimes(1)
			expect(store.reorder).toHaveBeenCalledWith('p1', null, 't1', 2)
		})

		it('does not call store.reorder when the index did not change', () => {
			const store = { reorder: vi.fn() }

			onSiblingDrop(store, drop, { oldIndex: 1, newIndex: 1 })

			expect(store.reorder).not.toHaveBeenCalled()
		})

		it('ignores an event without indexes', () => {
			const store = { reorder: vi.fn() }

			onSiblingDrop(store, drop, {})

			expect(store.reorder).not.toHaveBeenCalled()
		})

		it('passes the index among all siblings when closed ones are hidden', () => {
			const store = { reorder: vi.fn() }
			// t2 is closed and hidden: the rendered list is t1, t3
			const hiddenDrop = { parentUid: 'p1', allUids: ['t1', 't2', 't3'], visibleUids: ['t1', 't3'] }

			onSiblingDrop(store, hiddenDrop, { oldIndex: 0, newIndex: 1 })

			// t1 lands after t3, which is index 2 among all siblings
			expect(store.reorder).toHaveBeenCalledWith('p1', null, 't1', 2)
		})
	})

	describe('fullIndexForDrop', () => {
		it('equals the rendered index when nothing is hidden', () => {
			expect(fullIndexForDrop(['a', 'b', 'c'], ['a', 'b', 'c'], 'c', 0)).toBe(0)
			expect(fullIndexForDrop(['a', 'b', 'c'], ['a', 'b', 'c'], 'a', 1)).toBe(1)
		})

		it('places a task before the next rendered sibling when it has no rendered predecessor', () => {
			// 'x' is hidden at the start; a dropped at the top of the rendered list goes before b
			expect(fullIndexForDrop(['x', 'a', 'b'], ['a', 'b'], 'b', 0)).toBe(1)
		})
	})

	it('keeps the Tasks drag options', () => {
		expect(DRAG_OPTIONS).toEqual({
			delay: 300,
			delayOnTouchOnly: true,
			touchStartThreshold: 3,
			handle: '.drag-handle',
			chosenClass: 'cc-drag-chosen',
			ghostClass: 'cc-drag-ghost',
		})
	})
})
