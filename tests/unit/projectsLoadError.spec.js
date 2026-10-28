import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listTaskCalendars } from '../../src/services/dav.js'
import { useProjectsStore } from '../../src/store/projects.js'

vi.mock('../../src/services/dav.js', () => ({
	getDavSession: vi.fn(() => ({})),
	listTaskCalendars: vi.fn(),
	fetchTodos: vi.fn(),
}))

describe('projects store load errors', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	it('keeps a non-empty error when the thrown Error has an empty message', async () => {
		listTaskCalendars.mockRejectedValue(new Error(''))
		const store = useProjectsStore()

		await store.load()

		expect(typeof store.error).toBe('string')
		expect(store.error.length).toBeGreaterThan(0)
		expect(store.loading).toBe(false)
	})
})
