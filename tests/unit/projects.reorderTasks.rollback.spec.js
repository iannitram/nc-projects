import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/dav.js', () => ({
	listTaskCalendars: vi.fn(),
	fetchTodos: vi.fn(),
	fetchTodo: vi.fn(),
	createTodo: vi.fn(),
	putTodo: vi.fn(),
	getDavSession: vi.fn(() => ({})),
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
import { fetchTodo, fetchTodos, listTaskCalendars, putTodo } from '../../src/services/dav.js'
import { useProjectsStore } from '../../src/store/projects.js'

function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value)
		Object.values(value).forEach(deepFreeze)
	}
	return value
}

const GARDEN = { url: '/list-b/', displayName: 'Garden', ownedByMe: true, writable: true, ctag: 'v1' }

function vtodo({ uid, created = '20200101T000000Z', categories, parent, sort, status }) {
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
	return { url: `/list-b/${uid}.ics`, etag: `"${uid}-e1"`, calendarUrl: '/list-b/', ics: vtodo({ uid, ...fields }) }
}

async function loadStore(todos) {
	listTaskCalendars.mockResolvedValue(deepFreeze([{ ...GARDEN }]))
	fetchTodos.mockResolvedValue(deepFreeze(todos))
	const store = useProjectsStore()
	await store.load()
	return store
}

const sortOf = (ics) => Task.fromIcs(ics, {}).sortOrder
const fresh = (uid, fields) => ({ ...stored(uid, fields), etag: `"${uid}-fresh"` })

describe('projects store reorderTasks rollback after a landed write', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	function threeTasks() {
		return [
			stored('P', { categories: 'project', sort: 10 }),
			stored('a', { parent: 'P', sort: 0 }),
			stored('b', { parent: 'P', sort: 1 }),
			stored('c', { parent: 'P', sort: 10 }),
		]
	}

	it('undoes landed writes on the server and locally when a subsequent write fails', async () => {
		const store = await loadStore(threeTasks())
		putTodo
			.mockResolvedValueOnce({ etag: '"c-e2"' })
			.mockRejectedValueOnce(new Error('boom'))
			.mockResolvedValue({ etag: '"c-e1"' })

		await store.reorder('P', 'Garden', 'c', 0)

		expect(showError).toHaveBeenCalledTimes(1)
		expect(showError).toHaveBeenCalledWith('Could not save the new order')

		expect(putTodo).toHaveBeenCalledTimes(3)
		const [firstWrite, secondWrite, undoWrite] = putTodo.mock.calls

		expect(firstWrite[0]).toBe('/list-b/c.ics')
		expect(sortOf(firstWrite[1])).toBe(0)
		expect(firstWrite[2]).toBe('"c-e1"')

		expect(secondWrite[0]).toBe('/list-b/a.ics')
		expect(sortOf(secondWrite[1])).toBe(1)
		expect(secondWrite[2]).toBe('"a-e1"')

		expect(undoWrite[0]).toBe('/list-b/c.ics')
		expect(sortOf(undoWrite[1])).toBe(10)
		expect(undoWrite[2]).toBe('"c-e2"')

		expect(putTodo.mock.calls.map((call) => call[0])).not.toContain('/list-b/b.ics')

		expect(store.tasksByUid.a.sortOrder).toBe(0)
		expect(store.tasksByUid.a.etag).toBe('"a-e1"')
		expect(store.tasksByUid.b.sortOrder).toBe(1)
		expect(store.tasksByUid.b.etag).toBe('"b-e1"')
		expect(store.tasksByUid.c.sortOrder).toBe(10)
		expect(store.tasksByUid.c.etag).toBe('"c-e1"')

		expect(store.areas[0].projects[0].children.map((node) => node.task.uid)).toEqual(['a', 'b', 'c'])
	})

	it('takes the server copy when the undo write fails too', async () => {
		const store = await loadStore(threeTasks())
		putTodo
			.mockResolvedValueOnce({ etag: '"c-e2"' })
			.mockRejectedValueOnce(new Error('boom'))
			.mockRejectedValueOnce(new Error('undo failed'))
		fetchTodo.mockResolvedValue(fresh('c', { parent: 'P', sort: 10 }))

		await store.reorder('P', 'Garden', 'c', 0)

		expect(fetchTodo).toHaveBeenCalledTimes(1)
		expect(fetchTodo).toHaveBeenCalledWith('/list-b/c.ics')
		expect(store.tasksByUid.c.sortOrder).toBe(10)
		expect(store.tasksByUid.c.etag).toBe('"c-fresh"')
		expect(showError).toHaveBeenCalledTimes(1)
		expect(showError).toHaveBeenCalledWith('Could not save the new order')

		expect(store.tasksByUid.a.sortOrder).toBe(0)
		expect(store.tasksByUid.a.etag).toBe('"a-e1"')
		expect(store.tasksByUid.b.sortOrder).toBe(1)
		expect(store.tasksByUid.b.etag).toBe('"b-e1"')
		expect(store.areas[0].projects[0].children.map((node) => node.task.uid)).toEqual(['a', 'b', 'c'])
	})
})
