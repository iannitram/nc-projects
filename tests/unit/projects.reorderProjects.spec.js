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

import { showError, showInfo } from '@nextcloud/dialogs'
import { Task } from '../../src/models/Task.js'
import { ConflictError, fetchTodo, fetchTodos, listTaskCalendars, putTodo } from '../../src/services/dav.js'
import { useProjectsStore } from '../../src/store/projects.js'

function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value)
		Object.values(value).forEach(deepFreeze)
	}
	return value
}

const GARDEN = { url: '/list-b/', displayName: 'Garden', ownedByMe: true, writable: true, ctag: 'v1' }

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

function spaced() {
	return [
		stored('A', { created: '20200101T000000Z', categories: 'project', sort: 10 }),
		stored('B', { created: '20200101T000000Z', categories: 'project', sort: 20 }),
		stored('C', { created: '20200101T000000Z', categories: 'project', sort: 30 }),
	]
}

describe('projects store reorder (projects in an area)', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	it('writes only the moved project when there is room: [A:10, B:20, C:30], C to the top -> C=9', async () => {
		const store = await loadStore(spaced())
		putTodo.mockResolvedValue({ etag: '"C-e2"' })

		await store.reorder(null, 'Garden', 'C', 0)

		expect(putTodo).toHaveBeenCalledTimes(1)
		const [url, ics, etag] = putTodo.mock.calls[0]
		expect(url).toBe('/list-b/C.ics')
		expect(etag).toBe('"C-e1"')
		expect(sortOf(ics)).toBe(9)
		expect(store.areas[0].projects.map((node) => node.task.uid)).toEqual(['C', 'A', 'B'])
		expect(store.tasksByUid.C.sortOrder).toBe(9)
		expect(store.tasksByUid.C.etag).toBe('"C-e2"')
	})

	it('bumps colliding later projects, each written with its own etag: [A:10, B:11, C:12], C to index 1 -> C=11, B=12', async () => {
		const store = await loadStore([
			stored('A', { created: '20200101T000000Z', categories: 'project', sort: 10 }),
			stored('B', { created: '20200101T000000Z', categories: 'project', sort: 11 }),
			stored('C', { created: '20200101T000000Z', categories: 'project', sort: 12 }),
		])
		putTodo.mockImplementation(async (url) => ({ etag: url === '/list-b/C.ics' ? '"C-e2"' : '"B-e2"' }))

		await store.reorder(null, 'Garden', 'C', 1)

		expect(putTodo).toHaveBeenCalledTimes(2)
		const [[urlC, icsC, etagC], [urlB, icsB, etagB]] = putTodo.mock.calls
		expect([urlC, sortOf(icsC), etagC]).toEqual(['/list-b/C.ics', 11, '"C-e1"'])
		expect([urlB, sortOf(icsB), etagB]).toEqual(['/list-b/B.ics', 12, '"B-e1"'])
		expect(store.areas[0].projects.map((node) => node.task.uid)).toEqual(['A', 'C', 'B'])
		expect(store.tasksByUid.B.etag).toBe('"B-e2"')
		expect(store.tasksByUid.A.sortOrder).toBe(10)
	})

	it('rolls the sort order back and shows "Could not save the new order" when the write fails', async () => {
		const store = await loadStore(spaced())
		putTodo.mockRejectedValue(new Error('network down'))

		await store.reorder(null, 'Garden', 'C', 0).catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not save the new order')
		expect(store.tasksByUid.C.sortOrder).toBe(30)
		expect(store.tasksByUid.C.etag).toBe('"C-e1"')
		expect(store.areas[0].projects.map((node) => node.task.uid)).toEqual(['A', 'B', 'C'])
	})

	it('reloads the task and shows "Someone else changed this; reloaded" on a conflict', async () => {
		const store = await loadStore(spaced())
		putTodo.mockRejectedValue(new ConflictError('/list-b/C.ics'))
		fetchTodo.mockResolvedValue({
			url: '/list-b/C.ics',
			etag: '"C-fresh"',
			calendarUrl: '/list-b/',
			ics: vtodo({ uid: 'C', created: '20200101T000000Z', categories: 'project', sort: 25 }),
		})

		await store.reorder(null, 'Garden', 'C', 0).catch(() => {})

		expect(fetchTodo).toHaveBeenCalledWith('/list-b/C.ics')
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()
		expect(store.tasksByUid.C.etag).toBe('"C-fresh"')
		expect(store.tasksByUid.C.sortOrder).toBe(25)
	})
})
