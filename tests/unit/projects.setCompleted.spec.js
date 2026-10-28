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

const VAN = { url: '/van/', displayName: 'Van', ownedByMe: true, writable: true, ctag: 'v1' }

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
	return { url: `/van/${uid}.ics`, etag: `"${uid}-e1"`, calendarUrl: '/van/', ics: vtodo({ uid, ...fields }) }
}

async function loadStore(todos) {
	listTaskCalendars.mockResolvedValue(deepFreeze([{ ...VAN }]))
	fetchTodos.mockResolvedValue(deepFreeze(todos))
	const store = useProjectsStore()
	await store.load()
	return store
}

const sent = (call) => Task.fromIcs(call[1], {})
const uidOfUrl = (url) => url.split('/').pop().replace('.ics', '')
const fresh = (uid, fields) => ({ ...stored(uid, fields), etag: `"${uid}-fresh"` })

const nodeOf = (store, uid) => store.areas[0].projects.find((node) => node.task.uid === uid)

function open() {
	return [
		stored('P', { categories: 'project', sort: 10 }),
		stored('A', { parent: 'P', sort: 10 }),
		stored('A1', { parent: 'A', sort: 10 }),
		stored('A2', { parent: 'A', sort: 20, status: 'COMPLETED' }),
		stored('B', { parent: 'P', sort: 20 }),
	]
}

function closedChain() {
	return [
		stored('P', { categories: 'project', sort: 10, status: 'COMPLETED' }),
		stored('A', { parent: 'P', sort: 10, status: 'COMPLETED' }),
		stored('A1', { parent: 'A', sort: 10, status: 'COMPLETED' }),
		stored('B', { parent: 'P', sort: 20, status: 'COMPLETED' }),
	]
}

describe('projects store setCompleted', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
		putTodo.mockImplementation(async (url) => ({ etag: `"${uidOfUrl(url)}-e2"` }))
	})

	it('checking off writes the task, then each open descendant, each with its own etag', async () => {
		const store = await loadStore(open())

		await store.setCompleted('A', true)

		expect(putTodo).toHaveBeenCalledTimes(2)
		const [first, second] = putTodo.mock.calls
		expect([first[0], first[2]]).toEqual(['/van/A.ics', '"A-e1"'])
		expect([second[0], second[2]]).toEqual(['/van/A1.ics', '"A1-e1"'])
		for (const call of putTodo.mock.calls) {
			expect(sent(call).status).toBe('COMPLETED')
			expect(sent(call).completed).toBe(true)
			expect(call[1]).toContain('PERCENT-COMPLETE:100')
		}
	})

	it('stores the new etags and progress after checking off', async () => {
		const store = await loadStore(open())

		await store.setCompleted('A', true)

		expect(store.tasksByUid.A.completed).toBe(true)
		expect(store.tasksByUid.A1.completed).toBe(true)
		expect(store.tasksByUid.A.etag).toBe('"A-e2"')
		expect(store.tasksByUid.A1.etag).toBe('"A1-e2"')
		expect(store.tasksByUid.B.completed).toBe(false)
		expect(nodeOf(store, 'P').progress).toEqual({ done: 3, total: 4 })
	})

	it('reopening writes the task, then each closed ancestor up to the project, as open tasks', async () => {
		const store = await loadStore(closedChain())

		await store.setCompleted('A1', false)

		expect(putTodo.mock.calls.map((call) => call[0])).toEqual(['/van/A1.ics', '/van/A.ics', '/van/P.ics'])
		for (const call of putTodo.mock.calls) {
			expect(sent(call).status).toBe('NEEDS-ACTION')
			expect(call[1]).not.toContain('COMPLETED:')
			expect(call[1]).not.toContain('PERCENT-COMPLETE')
		}
		expect(store.tasksByUid.B.completed).toBe(true)
		expect(nodeOf(store, 'P').progress).toEqual({ done: 1, total: 3 })
	})

	it('shows the change at once, before the writes finish', async () => {
		const store = await loadStore(open())
		const gate = Promise.withResolvers()
		putTodo.mockImplementation(async () => {
			await gate.promise
			return { etag: '"x"' }
		})

		const pending = store.setCompleted('B', true)

		expect(store.tasksByUid.B.completed).toBe(true)
		gate.resolve()
		await pending
	})

	it('writes nothing when the task is already in the asked state', async () => {
		const store = await loadStore(open())

		await store.setCompleted('A2', true)
		await store.setCompleted('B', false)

		expect(putTodo).not.toHaveBeenCalled()
	})

	it('rolls every task and etag back and shows "Could not save the change" when a write fails', async () => {
		const store = await loadStore(open())
		putTodo.mockRejectedValue(new Error('network down'))

		await store.setCompleted('A', true).catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not save the change')
		expect(store.tasksByUid.A.completed).toBe(false)
		expect(store.tasksByUid.A1.completed).toBe(false)
		expect(store.tasksByUid.A.etag).toBe('"A-e1"')
		expect(nodeOf(store, 'P').progress).toEqual({ done: 1, total: 4 })
	})

	it('reloads every task in the plan and shows "Someone else changed this; reloaded" on a conflict', async () => {
		const store = await loadStore(open())
		putTodo.mockRejectedValue(new ConflictError('/van/A.ics'))
		fetchTodo.mockImplementation(async (url) => fresh(uidOfUrl(url), { parent: uidOfUrl(url) === 'A' ? 'P' : 'A', sort: 10 }))

		await store.setCompleted('A', true).catch(() => {})

		expect(fetchTodo.mock.calls.map((call) => call[0]).sort()).toEqual(['/van/A.ics', '/van/A1.ics'])
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()
		expect(store.tasksByUid.A.etag).toBe('"A-fresh"')
		expect(store.tasksByUid.A1.etag).toBe('"A1-fresh"')
		expect(store.tasksByUid.A.completed).toBe(false)
	})

	it('shows "Could not save the change" and no "reloaded" notice when the conflict reload fails', async () => {
		const store = await loadStore(open())
		putTodo.mockRejectedValue(new ConflictError('/van/A.ics'))
		fetchTodo.mockRejectedValue(new Error('reload failed'))

		await store.setCompleted('A', true).catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not save the change')
		expect(showInfo).not.toHaveBeenCalled()
	})

	it('preserves node collapse state across a setCompleted rebuild', async () => {
		const store = await loadStore(open())
		const nodeA = store.areas[0].projects[0].children[0]
		expect(nodeA.task.uid).toBe('A')
		nodeA.collapsed = true

		await store.setCompleted('B', true)

		const updatedNodeA = store.areas[0].projects[0].children[0]
		expect(updatedNodeA.task.uid).toBe('A')
		expect(updatedNodeA.collapsed).toBe(true)
	})
})
