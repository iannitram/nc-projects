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
import { ConflictError, createTodo, fetchTodo, fetchTodos, listTaskCalendars } from '../../src/services/dav.js'
import { useProjectsStore } from '../../src/store/projects.js'

function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value)
		Object.values(value).forEach(deepFreeze)
	}
	return value
}

const GARDEN = { url: '/list-b/', displayName: 'Garden', ownedByMe: true, writable: true, ctag: 'v1' }

function vtodo({ uid, summary, created = '20200101T000000Z', categories, parent, sort, status }) {
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'BEGIN:VTODO',
		`UID:${uid}`,
		`SUMMARY:${summary ?? uid}`,
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
	return { url: `/list-b/${uid}.ics`, etag: `"${uid}-e1"`, calendarUrl: '/list-b/', ics: vtodo({ uid, ...fields }) }
}

async function loadStore(todos) {
	listTaskCalendars.mockResolvedValue(deepFreeze([{ ...GARDEN }]))
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

describe('projects store addTask failures', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	it('resolves to null and shows an error when the create fails', async () => {
		const store = await loadStore(todos())
		createTodo.mockRejectedValue(new Error('network down'))

		await expect(store.addTask('P', 'Buy paint')).resolves.toBeNull()

		expect(showError).toHaveBeenCalledWith('Could not add the task')
	})

	it('resolves to null, shows an error and does not create when the project is unknown', async () => {
		const store = await loadStore(todos())

		await expect(store.addTask('nope', 'Buy paint')).resolves.toBeNull()

		expect(showError).toHaveBeenCalledWith('Could not add the task: project not found')
		expect(createTodo).not.toHaveBeenCalled()
	})

	it('reloads the task with fetchTodo, calls showInfo once and does not call showError when createTodo rejects with ConflictError', async () => {
		const store = await loadStore(todos())
		createTodo.mockRejectedValue(new ConflictError('/van/conflict.ics'))
		fetchTodo.mockResolvedValue(deepFreeze({
			url: '/van/conflict.ics',
			etag: '"c1-e2"',
			calendarUrl: '/van/',
			ics: vtodo({ uid: 'c1', parent: 'P', summary: 'Server task' }),
		}))

		const result = await store.addTask('P', 'Buy paint')

		expect(result).toBeNull()
		expect(fetchTodo).toHaveBeenCalledWith('/van/conflict.ics', expect.anything())
		expect(store.tasksByUid.c1.summary).toBe('Server task')
		expect(showInfo).toHaveBeenCalledTimes(1)
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()
	})

	it('shows "Could not add the task" and no "reloaded" notice when the conflict reload fails', async () => {
		const store = await loadStore(todos())
		createTodo.mockRejectedValue(new ConflictError('/van/conflict.ics'))
		fetchTodo.mockRejectedValue(new Error('reload failed'))

		const result = await store.addTask('P', 'Buy paint')

		expect(result).toBeNull()
		expect(showError).toHaveBeenCalledWith('Could not add the task')
		expect(showInfo).not.toHaveBeenCalled()
	})

	it('shows only a single notice when two ConflictErrors arrive together', async () => {
		const store = await loadStore(todos())
		createTodo
			.mockRejectedValueOnce(new ConflictError('/van/c1.ics'))
			.mockRejectedValueOnce(new ConflictError('/van/c2.ics'))

		fetchTodo.mockImplementation(async (url) => deepFreeze({
			url,
			etag: '"new-etag"',
			calendarUrl: '/van/',
			ics: vtodo({ uid: url.includes('c1') ? 'c1' : 'c2', parent: 'P', summary: 'server' }),
		}))

		const [res1, res2] = await Promise.all([
			store.addTask('P', 'Task 1'),
			store.addTask('P', 'Task 2'),
		])

		expect(res1).toBeNull()
		expect(res2).toBeNull()
		expect(fetchTodo).toHaveBeenCalledTimes(2)
		expect(fetchTodo).toHaveBeenCalledWith('/van/c1.ics', expect.anything())
		expect(fetchTodo).toHaveBeenCalledWith('/van/c2.ics', expect.anything())
		expect(showInfo).toHaveBeenCalledTimes(1)
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()
	})
})
