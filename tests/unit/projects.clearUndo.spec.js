import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectsStore } from '../../src/store/projects.js'

describe('clearUndo', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('empties the undo stack and forgets any undo error', () => {
		const store = useProjectsStore()
		store.undoStack = [{ label: 'a', items: [] }, { label: 'b', items: [] }]
		store.undoError = 'Could not undo'
		store.clearUndo()
		expect(store.undoStack).toEqual([])
		expect(store.undoError).toBeNull()
	})

	it('is harmless on an empty stack', () => {
		const store = useProjectsStore()
		store.clearUndo()
		expect(store.undoStack).toEqual([])
		expect(store.undoError).toBeNull()
	})
})
