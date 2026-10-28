import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/dav.js', () => ({
	getDavSession: vi.fn(() => ({})),
	listTaskCalendars: vi.fn(),
	fetchTodos: vi.fn(),
}))

import { fetchTodos, listTaskCalendars } from '../../src/services/dav.js'
import { useProjectsStore } from '../../src/store/projects.js'

const ics = (uid, categories = '', related = '') => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTODO\r\nUID:${uid}\r\nSUMMARY:${uid}\r\nSTATUS:NEEDS-ACTION\r\n${categories ? `CATEGORIES:${categories}\r\n` : ''}${related ? `RELATED-TO:${related}\r\n` : ''}END:VTODO\r\nEND:VCALENDAR\r\n`

describe('projects store load', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	it('loads areas, orphans and untagged parents, keeping loading true in flight', async () => {
		const calendars = [
			{ url: '/personal/', displayName: 'Personal', ownedByMe: true, ctag: 'p1' },
			{ url: '/project-a/', displayName: 'Project A', ownedByMe: true, ctag: 'v1' },
		]
		listTaskCalendars.mockResolvedValue(calendars)
		let finishFetch
		fetchTodos.mockImplementation((calendar) => calendar.url === '/personal/'
			? new Promise((resolve) => { finishFetch = resolve })
			: Promise.resolve([
					{ url: '/project-a/orphan.ics', etag: 'o1', calendarUrl: '/project-a/', ics: ics('orphan', '', 'missing') },
					{ url: '/project-a/parent.ics', etag: 'u1', calendarUrl: '/project-a/', ics: ics('parent') },
					{ url: '/project-a/child.ics', etag: 'c1', calendarUrl: '/project-a/', ics: ics('child', '', 'parent') },
				]))

		const store = useProjectsStore()
		const loading = store.load()
		await vi.waitFor(() => expect(fetchTodos).toHaveBeenCalledTimes(2))
		expect(store.loading).toBe(true)
		finishFetch([])
		await loading

		expect(store.areas).toHaveLength(2)
		expect(store.orphans.map((task) => task.uid)).toEqual(['orphan'])
		expect(store.untaggedParents.map((task) => task.uid)).toEqual(['parent'])
		expect(store.loading).toBe(false)
		expect(store.error).toBeNull()
		expect(store.ctags).toEqual({ '/personal/': 'p1', '/project-a/': 'v1' })
		expect(store.tasksByUid.parent.uid).toBe('parent')
	})

	it('sets the error and clears loading when a DAV call fails', async () => {
		listTaskCalendars.mockRejectedValue(new Error('DAV unavailable'))
		const store = useProjectsStore()
		await store.load()
		expect(store.error).toBe('DAV unavailable')
		expect(store.loading).toBe(false)
	})
})
