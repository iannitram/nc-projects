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

function vtodo({ uid, created = '20200101T000000Z', categories, parent, sort, status, extra = [] }) {
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
		...extra,
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
const sent = (call) => Task.fromIcs(call[1], {})
const fresh = (uid, fields) => ({ ...stored(uid, fields), uid, etag: `"${uid}-fresh"` })

describe('projects store reorder conflict rollback (#130)', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	function threeProjects() {
		return [
			stored('A', { categories: 'project', sort: 0 }),
			stored('B', { categories: 'project', sort: 1 }),
			stored('C', { categories: 'project', sort: 10 }),
		]
	}

	it('undoes landed writes and reloads the conflicted item when the 2nd of 3 project PUTs throws ConflictError', async () => {
		const store = await loadStore(threeProjects())
		putTodo
			.mockResolvedValueOnce({ etag: '"C-e2"' })
			.mockRejectedValueOnce(new ConflictError('/list-b/A.ics'))
			.mockResolvedValueOnce({ etag: '"C-e3"' })
		fetchTodo.mockResolvedValue(fresh('A', { categories: 'project', sort: 50 }))

		await store.reorder(null, 'Garden', 'C', 0)

		expect(putTodo).toHaveBeenCalledTimes(3)
		const [firstWrite, secondWrite, undoWrite] = putTodo.mock.calls

		// 1st PUT: C moved to 0
		expect(firstWrite[0]).toBe('/list-b/C.ics')
		expect(sortOf(firstWrite[1])).toBe(0)
		expect(firstWrite[2]).toBe('"C-e1"')

		// 2nd PUT: A bumped to 1 (throws ConflictError)
		expect(secondWrite[0]).toBe('/list-b/A.ics')
		expect(sortOf(secondWrite[1])).toBe(1)
		expect(secondWrite[2]).toBe('"A-e1"')

		// 3rd PUT: undo C back to sort 10 over new etag "C-e2"
		expect(undoWrite[0]).toBe('/list-b/C.ics')
		expect(sortOf(undoWrite[1])).toBe(10)
		expect(undoWrite[2]).toBe('"C-e2"')

		// B was never written
		expect(putTodo.mock.calls.map((call) => call[0])).not.toContain('/list-b/B.ics')

		// Conflicted item A is refetched
		expect(fetchTodo).toHaveBeenCalledWith('/list-b/A.ics')
		expect(showInfo).toHaveBeenCalledTimes(1)
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()

		// Store is consistent
		expect(store.tasksByUid.C.sortOrder).toBe(10)
		expect(store.tasksByUid.C.etag).toBe('"C-e3"')
		expect(store.tasksByUid.A.sortOrder).toBe(50)
		expect(store.tasksByUid.A.etag).toBe('"A-fresh"')
		expect(store.tasksByUid.B.sortOrder).toBe(1)
		expect(store.tasksByUid.B.etag).toBe('"B-e1"')
	})

	it('refetches the conflicted item and does not undo when conflict occurs on the 1st PUT', async () => {
		const store = await loadStore(threeProjects())
		putTodo.mockRejectedValueOnce(new ConflictError('/list-b/C.ics'))
		fetchTodo.mockResolvedValue(fresh('C', { categories: 'project', sort: 25 }))

		await store.reorder(null, 'Garden', 'C', 0)

		expect(putTodo).toHaveBeenCalledTimes(1)
		expect(fetchTodo).toHaveBeenCalledWith('/list-b/C.ics')
		expect(showInfo).toHaveBeenCalledTimes(1)
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()

		expect(store.tasksByUid.C.sortOrder).toBe(25)
		expect(store.tasksByUid.C.etag).toBe('"C-fresh"')
		expect(store.tasksByUid.A.sortOrder).toBe(0)
		expect(store.tasksByUid.A.etag).toBe('"A-e1"')
		expect(store.tasksByUid.B.sortOrder).toBe(1)
		expect(store.tasksByUid.B.etag).toBe('"B-e1"')
	})

	function threeTasks() {
		return [
			stored('P', { categories: 'project', sort: 10 }),
			stored('a', { parent: 'P', sort: 0 }),
			stored('b', { parent: 'P', sort: 1 }),
			stored('c', { parent: 'P', sort: 10 }),
		]
	}

	it('undoes landed writes and reloads the conflicted item when the 2nd of 3 task PUTs throws ConflictError', async () => {
		const store = await loadStore(threeTasks())
		putTodo
			.mockResolvedValueOnce({ etag: '"c-e2"' })
			.mockRejectedValueOnce(new ConflictError('/list-b/a.ics'))
			.mockResolvedValueOnce({ etag: '"c-e3"' })
		fetchTodo.mockResolvedValue(fresh('a', { parent: 'P', sort: 30 }))

		await store.reorder('P', 'Garden', 'c', 0)

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

		expect(fetchTodo).toHaveBeenCalledWith('/list-b/a.ics')
		expect(showInfo).toHaveBeenCalledTimes(1)
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()

		expect(store.tasksByUid.c.sortOrder).toBe(10)
		expect(store.tasksByUid.c.etag).toBe('"c-e3"')
		expect(store.tasksByUid.a.sortOrder).toBe(30)
		expect(store.tasksByUid.a.etag).toBe('"a-fresh"')
		expect(store.tasksByUid.b.sortOrder).toBe(1)
		expect(store.tasksByUid.b.etag).toBe('"b-e1"')
	})

	function crowdedMove() {
		return [
			stored('P', { categories: 'project', sort: 10 }),
			stored('t1', { parent: 'P', sort: 10, extra: ['X-CC-NOTE:keep'] }),
			stored('Q', { categories: 'project', sort: 20 }),
			stored('q1', { parent: 'Q', sort: 10 }),
			stored('q2', { parent: 'Q', sort: 11 }),
		]
	}

	it('undoes landed writes and reloads the conflicted item when moveToProject encounters ConflictError on a sibling write', async () => {
		const store = await loadStore(crowdedMove())
		putTodo
			.mockResolvedValueOnce({ etag: '"t1-e2"' })
			.mockRejectedValueOnce(new ConflictError('/list-b/q2.ics'))
			.mockResolvedValueOnce({ etag: '"t1-e3"' })
		fetchTodo.mockResolvedValue(fresh('q2', { parent: 'Q', sort: 15 }))

		await store.moveToProject('t1', 'Q', 1)

		expect(putTodo).toHaveBeenCalledTimes(3)
		const [firstWrite, secondWrite, undoWrite] = putTodo.mock.calls

		expect(firstWrite[0]).toBe('/list-b/t1.ics')
		expect(secondWrite[0]).toBe('/list-b/q2.ics')

		expect(undoWrite[0]).toBe('/list-b/t1.ics')
		expect(undoWrite[2]).toBe('"t1-e2"')
		expect(sent(undoWrite).parentUid).toBe('P')
		expect(sent(undoWrite).sortOrder).toBe(10)
		expect(undoWrite[1]).toContain('X-CC-NOTE:keep')

		expect(fetchTodo).toHaveBeenCalledWith('/list-b/q2.ics')
		expect(showInfo).toHaveBeenCalledTimes(1)
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()

		expect(store.tasksByUid.t1.parentUid).toBe('P')
		expect(store.tasksByUid.t1.sortOrder).toBe(10)
		expect(store.tasksByUid.t1.etag).toBe('"t1-e3"')
		expect(store.tasksByUid.q2.sortOrder).toBe(15)
		expect(store.tasksByUid.q2.etag).toBe('"q2-fresh"')
	})
})
