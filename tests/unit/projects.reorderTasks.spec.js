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

const PROJECT_A = { url: '/project-a/', displayName: 'Project A', ownedByMe: true, writable: true, ctag: 'v1' }

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
	return { url: `/project-a/${uid}.ics`, etag: `"${uid}-e1"`, calendarUrl: '/project-a/', ics: vtodo({ uid, ...fields }) }
}

async function loadStore(todos) {
	listTaskCalendars.mockResolvedValue(deepFreeze([{ ...PROJECT_A }]))
	fetchTodos.mockResolvedValue(deepFreeze(todos))
	const store = useProjectsStore()
	await store.load()
	return store
}

const sent = (call) => Task.fromIcs(call[1], {})
const uidOfUrl = (url) => url.split('/').pop().replace('.ics', '')
const fresh = (uid, fields) => ({ ...stored(uid, fields), etag: `"${uid}-fresh"` })

const taskUids = (store) => store.areas[0].projects[0].children.map((node) => node.task.uid)

function spaced() {
	return [
		stored('P', { categories: 'project', sort: 10 }),
		stored('a', { parent: 'P', sort: 10 }),
		stored('b', { parent: 'P', sort: 20 }),
		stored('c', { parent: 'P', sort: 30 }),
	]
}

describe('projects store reorder (tasks under a parent)', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	it('writes only the moved task when there is room: [a:10, b:20, c:30], c to the top -> c=9', async () => {
		const store = await loadStore(spaced())
		putTodo.mockResolvedValue({ etag: '"c-e2"' })

		await store.reorder('P', 'Project A', 'c', 0)

		expect(putTodo).toHaveBeenCalledTimes(1)
		const [url, ics, etag] = putTodo.mock.calls[0]
		expect(url).toBe('/project-a/c.ics')
		expect(etag).toBe('"c-e1"')
		expect(sent(putTodo.mock.calls[0]).sortOrder).toBe(9)
		expect(ics).toContain('RELATED-TO:P')
		expect(taskUids(store)).toEqual(['c', 'a', 'b'])
		expect(store.tasksByUid.c.sortOrder).toBe(9)
		expect(store.tasksByUid.c.etag).toBe('"c-e2"')
	})

	it('bumps colliding later tasks, each written with its own etag: [a:10, b:11, c:12], c to index 1 -> c=11, b=12', async () => {
		const store = await loadStore([
			stored('P', { categories: 'project', sort: 10 }),
			stored('a', { parent: 'P', sort: 10 }),
			stored('b', { parent: 'P', sort: 11 }),
			stored('c', { parent: 'P', sort: 12 }),
		])
		putTodo.mockImplementation(async (url) => ({ etag: `"${uidOfUrl(url)}-e2"` }))

		await store.reorder('P', 'Project A', 'c', 1)

		expect(putTodo).toHaveBeenCalledTimes(2)
		const [first, second] = putTodo.mock.calls
		expect([first[0], sent(first).sortOrder, first[2]]).toEqual(['/project-a/c.ics', 11, '"c-e1"'])
		expect([second[0], sent(second).sortOrder, second[2]]).toEqual(['/project-a/b.ics', 12, '"b-e1"'])
		expect(taskUids(store)).toEqual(['a', 'c', 'b'])
		expect(store.tasksByUid.b.etag).toBe('"b-e2"')
		expect(store.tasksByUid.a.sortOrder).toBe(10)
	})

	it('reorders the children of a task as well: a1:10, a2:20 under a, a2 to the top -> a2=9', async () => {
		const store = await loadStore([
			...spaced(),
			stored('a1', { parent: 'a', sort: 10 }),
			stored('a2', { parent: 'a', sort: 20 }),
		])
		putTodo.mockResolvedValue({ etag: '"a2-e2"' })

		await store.reorder('a', 'Project A', 'a2', 0)

		expect(putTodo).toHaveBeenCalledTimes(1)
		expect(putTodo.mock.calls[0][0]).toBe('/project-a/a2.ics')
		expect(sent(putTodo.mock.calls[0]).sortOrder).toBe(9)
		expect(store.tasksByUid.a2.sortOrder).toBe(9)
	})

	it('rolls the sort order back and shows "Could not save the new order" when the write fails', async () => {
		const store = await loadStore(spaced())
		putTodo.mockRejectedValue(new Error('network down'))

		await store.reorder('P', 'Project A', 'c', 0).catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not save the new order')
		expect(store.tasksByUid.c.sortOrder).toBe(30)
		expect(store.tasksByUid.c.etag).toBe('"c-e1"')
		expect(taskUids(store)).toEqual(['a', 'b', 'c'])
	})

	it('reloads the task and shows "Someone else changed this; reloaded" on a conflict', async () => {
		const store = await loadStore(spaced())
		putTodo.mockRejectedValue(new ConflictError('/project-a/c.ics'))
		fetchTodo.mockResolvedValue(fresh('c', { parent: 'P', sort: 25 }))

		await store.reorder('P', 'Project A', 'c', 0).catch(() => {})

		expect(fetchTodo).toHaveBeenCalledWith('/project-a/c.ics')
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()
		expect(store.tasksByUid.c.etag).toBe('"c-fresh"')
		expect(store.tasksByUid.c.sortOrder).toBe(25)
	})

	it('shows "Could not save the new order" and no "reloaded" notice when the conflict reload fails', async () => {
		const store = await loadStore(spaced())
		putTodo.mockRejectedValue(new ConflictError('/van/c.ics'))
		fetchTodo.mockRejectedValue(new Error('reload failed'))

		await store.reorder('P', 'Van', 'c', 0).catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not save the new order')
		expect(showInfo).not.toHaveBeenCalled()
	})

	it('writes nothing when the moved uid is not among the parent\'s children', async () => {
		const store = await loadStore(spaced())

		await store.reorder('P', 'Project A', 'nope', 0).catch(() => {})

		expect(putTodo).not.toHaveBeenCalled()
	})
})
