import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/dav.js', () => ({
	getDavSession: vi.fn(() => ({})),
	listTaskCalendars: vi.fn(),
	fetchTodos: vi.fn(),
}))

vi.mock('../../src/services/settings.js', () => ({
	getAreaLists: vi.fn(),
	saveAreaLists: vi.fn(),
}))

import { fetchTodos, listTaskCalendars } from '../../src/services/dav.js'
import { getAreaLists } from '../../src/services/settings.js'
import { useProjectsStore } from '../../src/store/projects.js'

const ics = (uid, categories = '', related = '') => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTODO\r\nUID:${uid}\r\nSUMMARY:${uid}\r\nSTATUS:NEEDS-ACTION\r\n${categories ? `CATEGORIES:${categories}\r\n` : ''}${related ? `RELATED-TO:${related}\r\n` : ''}END:VTODO\r\nEND:VCALENDAR\r\n`

describe('projects store load', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
		getAreaLists.mockResolvedValue(['/list-a/', '/list-b/'])
	})

	it('loads areas, orphans and untagged parents, keeping loading true in flight', async () => {
		const calendars = [
			{ url: '/list-a/', displayName: 'Home', ownedByMe: true, ctag: 'p1' },
			{ url: '/list-b/', displayName: 'Garden', ownedByMe: true, ctag: 'v1' },
		]
		listTaskCalendars.mockResolvedValue(calendars)
		let finishFetch
		fetchTodos.mockImplementation((calendar) => calendar.url === '/list-a/'
			? new Promise((resolve) => { finishFetch = resolve })
			: Promise.resolve([
					{ url: '/list-b/orphan.ics', etag: 'o1', calendarUrl: '/list-b/', ics: ics('orphan', '', 'missing') },
					{ url: '/list-b/parent.ics', etag: 'u1', calendarUrl: '/list-b/', ics: ics('parent') },
					{ url: '/list-b/child.ics', etag: 'c1', calendarUrl: '/list-b/', ics: ics('child', '', 'parent') },
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
		expect(store.ctags).toEqual({ '/list-a/': 'p1', '/list-b/': 'v1' })
		expect(store.tasksByUid.parent.uid).toBe('parent')
		expect(store.areaLists).toEqual(['/list-a/', '/list-b/'])
	})

	it('loads areas in saved URL order', async () => {
		getAreaLists.mockResolvedValue(['/list-b/', '/list-a/'])
		const calendars = [
			{ url: '/list-a/', displayName: 'Home', ownedByMe: true },
			{ url: '/list-b/', displayName: 'Garden', ownedByMe: true },
		]
		listTaskCalendars.mockResolvedValue(calendars)
		fetchTodos.mockResolvedValue([])
		const store = useProjectsStore()
		await store.load()
		expect(store.areas.map((area) => area.name)).toEqual(['Garden', 'Home'])
		expect(fetchTodos.mock.calls.map(([calendar]) => calendar.url)).toEqual(['/list-b/', '/list-a/'])
	})

	it('sets the error and clears loading when a DAV call fails', async () => {
		listTaskCalendars.mockRejectedValue(new Error('DAV unavailable'))
		const store = useProjectsStore()
		await store.load()
		expect(store.error).toBe('DAV unavailable')
		expect(store.loading).toBe(false)
	})
})
