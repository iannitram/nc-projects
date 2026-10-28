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

// Project P > level 1: a, b > level 2 (children of a): a1, a2 > level 3 (children of a1): x, y, z
const level2Children = (store) => store.areas[0].projects[0].children[0].children.map((node) => node.task.uid)
const level3Children = (store) => store.areas[0].projects[0].children[0].children[0].children.map((node) => node.task.uid)

function deep() {
	return [
		stored('P', { categories: 'project', sort: 10 }),
		stored('a', { parent: 'P', sort: 10 }),
		stored('b', { parent: 'P', sort: 20 }),
		stored('a1', { parent: 'a', sort: 10 }),
		stored('a2', { parent: 'a', sort: 20 }),
		stored('x', { parent: 'a1', sort: 10 }),
		stored('y', { parent: 'a1', sort: 20 }),
		stored('z', { parent: 'a1', sort: 30 }),
	]
}

describe('projects store reorder (third-level tasks)', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	it('writes only the moved third-level task when there is room, with If-Match and RELATED-TO its level-2 parent: [x:10, y:20, z:30], z to the top -> z=9', async () => {
		const store = await loadStore(deep())
		putTodo.mockResolvedValue({ etag: '"z-e2"' })

		await store.reorder('a1', 'Garden', 'z', 0)

		expect(putTodo).toHaveBeenCalledTimes(1)
		const [url, ics, etag] = putTodo.mock.calls[0]
		expect(url).toBe('/list-b/z.ics')
		expect(etag).toBe('"z-e1"')
		expect(sent(putTodo.mock.calls[0]).sortOrder).toBe(9)
		expect(ics).toContain('RELATED-TO:a1')
		expect(level3Children(store)).toEqual(['z', 'x', 'y'])
		expect(store.tasksByUid.z.sortOrder).toBe(9)
		expect(store.tasksByUid.z.etag).toBe('"z-e2"')
		expect(level2Children(store)).toEqual(['a1', 'a2'])
	})

	it('bumps colliding later third-level tasks, each written with its own etag: [x:10, y:11, z:12], z to index 1 -> z=11, y=12', async () => {
		const store = await loadStore([
			stored('P', { categories: 'project', sort: 10 }),
			stored('a', { parent: 'P', sort: 10 }),
			stored('a1', { parent: 'a', sort: 10 }),
			stored('x', { parent: 'a1', sort: 10 }),
			stored('y', { parent: 'a1', sort: 11 }),
			stored('z', { parent: 'a1', sort: 12 }),
		])
		putTodo.mockImplementation(async (url) => ({ etag: `"${uidOfUrl(url)}-e2"` }))

		await store.reorder('a1', 'Garden', 'z', 1)

		expect(putTodo).toHaveBeenCalledTimes(2)
		const [first, second] = putTodo.mock.calls
		expect([first[0], sent(first).sortOrder, first[2]]).toEqual(['/list-b/z.ics', 11, '"z-e1"'])
		expect([second[0], sent(second).sortOrder, second[2]]).toEqual(['/list-b/y.ics', 12, '"y-e1"'])
		expect(level3Children(store)).toEqual(['x', 'z', 'y'])
		expect(store.tasksByUid.y.etag).toBe('"y-e2"')
		expect(store.tasksByUid.x.sortOrder).toBe(10)
	})

	it('keeps the landed write and rolls back only the unlanded one when a later write fails', async () => {
		const store = await loadStore([
			stored('P', { categories: 'project', sort: 10 }),
			stored('a', { parent: 'P', sort: 10 }),
			stored('a1', { parent: 'a', sort: 10 }),
			stored('x', { parent: 'a1', sort: 10 }),
			stored('y', { parent: 'a1', sort: 11 }),
			stored('z', { parent: 'a1', sort: 12 }),
		])
		putTodo
			.mockResolvedValueOnce({ etag: '"z-e2"' })
			.mockRejectedValueOnce(new Error('network down'))

		await store.reorder('a1', 'Garden', 'z', 1).catch(() => {})

		expect(putTodo).toHaveBeenCalledTimes(2)
		expect(showError).toHaveBeenCalledWith('Could not save the new order')
		expect(store.tasksByUid.z.sortOrder).toBe(11)
		expect(store.tasksByUid.z.etag).toBe('"z-e2"')
		expect(store.tasksByUid.y.sortOrder).toBe(11)
		expect(store.tasksByUid.y.etag).toBe('"y-e1"')
		// y and z now both sit at 11: a tie, which keeps load order
		expect(level3Children(store)).toEqual(['x', 'y', 'z'])
	})

	it('rolls every sort order back when the first write fails', async () => {
		const store = await loadStore(deep())
		putTodo.mockRejectedValue(new Error('network down'))

		await store.reorder('a1', 'Garden', 'z', 0).catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not save the new order')
		expect(store.tasksByUid.z.sortOrder).toBe(30)
		expect(store.tasksByUid.z.etag).toBe('"z-e1"')
		expect(level3Children(store)).toEqual(['x', 'y', 'z'])
	})

	it('reloads the task and shows "Someone else changed this; reloaded" on a conflict', async () => {
		const store = await loadStore(deep())
		putTodo.mockRejectedValue(new ConflictError('/list-b/z.ics'))
		fetchTodo.mockResolvedValue(fresh('z', { parent: 'a1', sort: 25 }))

		await store.reorder('a1', 'Garden', 'z', 0).catch(() => {})

		expect(fetchTodo).toHaveBeenCalledWith('/list-b/z.ics')
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()
		expect(store.tasksByUid.z.etag).toBe('"z-fresh"')
		expect(store.tasksByUid.z.sortOrder).toBe(25)
	})

	it('writes nothing when the moved uid is not among the level-2 parent\'s children', async () => {
		const store = await loadStore(deep())

		await store.reorder('a1', 'Garden', 'a2', 0).catch(() => {})

		expect(putTodo).not.toHaveBeenCalled()
	})
})
