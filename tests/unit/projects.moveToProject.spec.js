import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/dav.js', () => ({
	listTaskCalendars: vi.fn(),
	fetchTodos: vi.fn(),
	fetchTodo: vi.fn(),
	createTodo: vi.fn(),
	putTodo: vi.fn(),
	moveTodo: vi.fn(),
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
import { ConflictError, fetchTodo, fetchTodos, listTaskCalendars, moveTodo, putTodo } from '../../src/services/dav.js'
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
		status === 'COMPLETED' ? 'COMPLETED:20260101T000000Z' : null,
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

const sent = (call) => Task.fromIcs(call[1], {})
const uidOfUrl = (url) => url.split('/').pop().replace('.ics', '')
const fresh = (uid, fields) => ({ ...stored(uid, fields), etag: `"${uid}-fresh"` })

function taskUids(store, projectUid) {
	return store.areas[0].projects.find((node) => node.task.uid === projectUid).children.map((node) => node.task.uid)
}

function spaced(extra = []) {
	return [
		stored('P', { categories: 'project', sort: 10 }),
		stored('t1', { parent: 'P', sort: 10, extra: ['X-CC-NOTE:keep'] }),
		stored('s1', { parent: 't1', sort: 10 }),
		stored('Q', { categories: 'project', sort: 20 }),
		stored('q1', { parent: 'Q', sort: 10 }),
		stored('q2', { parent: 'Q', sort: 20 }),
		...extra,
	]
}

describe('projects store moveToProject (same list)', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
		putTodo.mockImplementation(async (url) => ({ etag: `"${uidOfUrl(url)}-e2"` }))
	})

	it('re-links the task to the new project with one bare RELATED-TO and writes it once, with its etag', async () => {
		const store = await loadStore(spaced())

		await store.moveToProject('t1', 'Q', 2)

		expect(putTodo).toHaveBeenCalledTimes(1)
		const [url, ics, etag] = putTodo.mock.calls[0]
		expect([url, etag]).toEqual(['/list-b/t1.ics', '"t1-e1"'])
		expect(sent(putTodo.mock.calls[0]).parentUid).toBe('Q')
		expect(ics.match(/RELATED-TO/g)).toHaveLength(1)
		expect(ics).toContain('RELATED-TO:Q')
		expect(ics).not.toContain('RELTYPE')
		expect(ics).toContain('X-CC-NOTE:keep')
		expect(store.tasksByUid.t1.etag).toBe('"t1-e2"')
	})

	it('places it by the order rule: after the last (q2:20 -> 21), or before the first (q1:10 -> 9)', async () => {
		const last = await loadStore(spaced())
		await last.moveToProject('t1', 'Q', 2)
		expect(sent(putTodo.mock.calls[0]).sortOrder).toBe(21)
		expect(taskUids(last, 'Q')).toEqual(['q1', 'q2', 't1'])

		setActivePinia(createPinia())
		putTodo.mockClear()
		const first = await loadStore(spaced())
		await first.moveToProject('t1', 'Q', 0)
		expect(sent(putTodo.mock.calls[0]).sortOrder).toBe(9)
		expect(taskUids(first, 'Q')).toEqual(['t1', 'q1', 'q2'])
		expect(taskUids(first, 'P')).toEqual([])
	})

	it('bumps colliding later siblings, each written with its own etag: q1:10, q2:11, to index 1 -> t1=11, q2=12', async () => {
		const store = await loadStore([
			stored('P', { categories: 'project', sort: 10 }),
			stored('t1', { parent: 'P', sort: 10 }),
			stored('Q', { categories: 'project', sort: 20 }),
			stored('q1', { parent: 'Q', sort: 10 }),
			stored('q2', { parent: 'Q', sort: 11 }),
		])

		await store.moveToProject('t1', 'Q', 1)

		expect(putTodo).toHaveBeenCalledTimes(2)
		const [first, second] = putTodo.mock.calls
		expect([first[0], sent(first).sortOrder, sent(first).parentUid]).toEqual(['/list-b/t1.ics', 11, 'Q'])
		expect([second[0], sent(second).sortOrder, second[2]]).toEqual(['/list-b/q2.ics', 12, '"q2-e1"'])
		expect(taskUids(store, 'Q')).toEqual(['q1', 't1', 'q2'])
	})

	it('leaves the subtasks untouched: they are not written and still sit under the task', async () => {
		const store = await loadStore(spaced())

		await store.moveToProject('t1', 'Q', 2)

		expect(putTodo.mock.calls.map((call) => call[0])).toEqual(['/list-b/t1.ics'])
		expect(store.tasksByUid.s1.parentUid).toBe('t1')
		const moved = store.areas[0].projects.find((node) => node.task.uid === 'Q').children.find((node) => node.task.uid === 't1')
		expect(moved.children.map((node) => node.task.uid)).toEqual(['s1'])
	})

	it('puts the old project and sort order back and shows "Could not save the move" when the write fails', async () => {
		const store = await loadStore(spaced())
		putTodo.mockRejectedValue(new Error('network down'))

		await store.moveToProject('t1', 'Q', 2).catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not save the move')
		expect(store.tasksByUid.t1.parentUid).toBe('P')
		expect(store.tasksByUid.t1.sortOrder).toBe(10)
		expect(store.tasksByUid.t1.etag).toBe('"t1-e1"')
		expect(taskUids(store, 'P')).toEqual(['t1'])
		expect(taskUids(store, 'Q')).toEqual(['q1', 'q2'])
	})

	it('reloads the task and shows "Someone else changed this; reloaded" on a conflict', async () => {
		const store = await loadStore(spaced())
		putTodo.mockRejectedValue(new ConflictError('/list-b/t1.ics'))
		fetchTodo.mockResolvedValue(fresh('t1', { parent: 'P', sort: 15 }))

		await store.moveToProject('t1', 'Q', 2).catch(() => {})

		expect(fetchTodo).toHaveBeenCalledWith('/list-b/t1.ics')
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()
		expect(store.tasksByUid.t1.etag).toBe('"t1-fresh"')
		expect(store.tasksByUid.t1.parentUid).toBe('P')
	})

	it('same-list move still issues one PUT and does not call moveTodo', async () => {
		const store = await loadStore(spaced())
		await store.moveToProject('t1', 'Q', 2)
		expect(putTodo).toHaveBeenCalledTimes(1)
		expect(moveTodo).not.toHaveBeenCalled()
	})
})
