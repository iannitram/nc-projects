import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/dav.js', () => ({
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

import { showError } from '@nextcloud/dialogs'
import { Task } from '../../src/models/Task.js'
import { createTodo, fetchTodos, listTaskCalendars } from '../../src/services/dav.js'
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
		stored('P', { created: '20200101T000000Z', categories: 'project' }),
		stored('t1', { created: '20200102T000000Z', parent: 'P' }),
		stored('t2', { created: '20200103T000000Z', parent: 'P' }),
	]
}

describe('projects store addTask', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	it('creates the task on the project\'s list, linked to the project, with no sort order', async () => {
		const store = await loadStore(todos())
		createTodo.mockImplementation(async (calendar, ics) => ({ url: '/van/new.ics', etag: '"n1"', ics, calendarUrl: '/van/' }))

		await store.addTask('P', 'Buy paint')

		expect(createTodo).toHaveBeenCalledTimes(1)
		const [calendar, ics] = createTodo.mock.calls[0]
		expect(calendar.url).toBe('/van/')
		const sent = Task.fromIcs(ics, { url: '', etag: '', calendarUrl: '/van/' })
		expect(sent.summary).toBe('Buy paint')
		expect(sent.parentUid).toBe('P')
		expect(sent.status).toBe('NEEDS-ACTION')
		expect(sent.sortOrder).toBeNull()
		expect(ics).not.toContain('X-APPLE-SORT-ORDER')
	})

	it('stores the returned url and etag and shows the task last under the project', async () => {
		const store = await loadStore(todos())
		let newUid
		createTodo.mockImplementation(async (calendar, ics) => {
			newUid = Task.fromIcs(ics, {}).uid
			return { url: '/van/new.ics', etag: '"n1"', ics, calendarUrl: '/van/' }
		})

		await store.addTask('P', 'Buy paint')

		const added = store.tasksByUid[newUid]
		expect(added.summary).toBe('Buy paint')
		expect(added.url).toBe('/van/new.ics')
		expect(added.etag).toBe('"n1"')
		expect(added.calendarUrl).toBe('/van/')
		const project = store.areas[0].projects[0]
		expect(project.children.map((node) => node.task.summary)).toEqual(['t1', 't2', 'Buy paint'])
		expect(project.progress).toEqual({ done: 0, total: 3 })
	})

	it('shows "Could not add the task" and leaves the tree unchanged when the create fails', async () => {
		const store = await loadStore(todos())
		createTodo.mockRejectedValue(new Error('network down'))

		await store.addTask('P', 'Buy paint').catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not add the task')
		expect(Object.keys(store.tasksByUid).sort()).toEqual(['P', 't1', 't2'])
		expect(store.areas[0].projects[0].children.map((node) => node.task.summary)).toEqual(['t1', 't2'])
	})
})
