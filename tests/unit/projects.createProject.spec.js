import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/dav.js', () => ({
	getDavSession: vi.fn(() => ({})),
	listTaskCalendars: vi.fn(),
	fetchTodos: vi.fn(),
	fetchTodo: vi.fn(),
	createTodo: vi.fn(),
	putTodo: vi.fn(),
	ConflictError: class ConflictError extends Error {
		constructor(url) {
			super(`Conflict writing ${url}`)
			this.name = 'ConflictError'
			this.url = url
		}
	},
}))
vi.mock('@nextcloud/dialogs', () => ({
	showError: vi.fn(),
	showInfo: vi.fn(),
	showSuccess: vi.fn(),
}))

import { showError, showInfo } from '@nextcloud/dialogs'
import { Task } from '../../src/models/Task.js'
import { ConflictError, createTodo, fetchTodo, fetchTodos, listTaskCalendars } from '../../src/services/dav.js'
import { useProjectsStore } from '../../src/store/projects.js'

function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value)
		Object.values(value).forEach(deepFreeze)
	}
	return value
}

const VAN = { url: '/van/', displayName: 'Van', ownedByMe: true, writable: true, ctag: 'v1' }

function vtodo({ uid, created, categories, parent, sort, status }) {
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'BEGIN:VTODO',
		`UID:${uid}`,
		`SUMMARY:${uid}`,
		`STATUS:${status ?? 'NEEDS-ACTION'}`,
		`CREATED:${created}`,
		categories ? `CATEGORIES:${categories}` : null,
		parent ? `RELATED-TO:${parent}` : null,
		sort !== undefined ? `X-APPLE-SORT-ORDER:${sort}` : null,
		'END:VTODO',
		'END:VCALENDAR',
		'',
	].filter((line) => line !== null).join('\r\n')
}

function stored(uid, fields) {
	return { url: `/van/${uid}.ics`, etag: `"${uid}-e1"`, calendarUrl: '/van/', ics: vtodo({ uid, ...fields }) }
}

async function loadStore(todos) {
	listTaskCalendars.mockResolvedValue(deepFreeze([{ ...VAN }]))
	fetchTodos.mockResolvedValue(deepFreeze(todos))
	const store = useProjectsStore()
	await store.load()
	return store
}

function todos() {
	return [
		stored('A', { created: '20200101T000000Z', categories: 'project' }),
		stored('B', { created: '20210101T000000Z', categories: 'project' }),
	]
}

describe('projects store createProject', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	it('creates a project on the area\'s list: project tag, no parent, no sort order', async () => {
		const store = await loadStore(todos())
		createTodo.mockImplementation(async (calendar, ics) => ({ url: '/van/new.ics', etag: '"n1"', ics, calendarUrl: '/van/' }))

		await store.createProject('Van', 'Build deck')

		expect(createTodo).toHaveBeenCalledTimes(1)
		const [calendar, ics] = createTodo.mock.calls[0]
		expect(calendar.url).toBe('/van/')
		const sent = Task.fromIcs(ics, { url: '', etag: '', calendarUrl: '/van/' })
		expect(sent.summary).toBe('Build deck')
		expect(sent.categories).toEqual(['project'])
		expect(sent.parentUid).toBeNull()
		expect(sent.sortOrder).toBeNull()
		expect(ics).not.toContain('RELATED-TO')
		expect(ics).not.toContain('X-APPLE-SORT-ORDER')
	})

	it('stores the returned url and etag and shows it as the last open project of the area', async () => {
		const store = await loadStore(todos())
		let newUid
		createTodo.mockImplementation(async (calendar, ics) => {
			newUid = Task.fromIcs(ics, {}).uid
			return { url: '/van/new.ics', etag: '"n1"', ics, calendarUrl: '/van/' }
		})

		await store.createProject('Van', 'Build deck')

		const created = store.tasksByUid[newUid]
		expect(created.url).toBe('/van/new.ics')
		expect(created.etag).toBe('"n1"')
		expect(created.calendarUrl).toBe('/van/')
		expect(store.areas[0].projects.map((node) => node.task.summary)).toEqual(['A', 'B', 'Build deck'])
	})

	it('shows "Could not create the project" and leaves the area unchanged when the create fails', async () => {
		const store = await loadStore(todos())
		createTodo.mockRejectedValue(new Error('network down'))

		await store.createProject('Van', 'Build deck').catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not create the project')
		expect(Object.keys(store.tasksByUid).sort()).toEqual(['A', 'B'])
		expect(store.areas[0].projects.map((node) => node.task.summary)).toEqual(['A', 'B'])
	})

	it('shows "Could not create the project" and no "reloaded" notice when the conflict reload fails', async () => {
		const store = await loadStore(todos())
		createTodo.mockRejectedValue(new ConflictError('/van/conflict.ics'))
		fetchTodo.mockRejectedValue(new Error('reload failed'))

		await store.createProject('Van', 'Build deck')

		expect(showError).toHaveBeenCalledWith('Could not create the project')
		expect(showInfo).not.toHaveBeenCalled()
	})
})
