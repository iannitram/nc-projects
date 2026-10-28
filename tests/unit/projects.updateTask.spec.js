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

const ORIGINAL = ['PRIORITY:5', 'DUE:20260101T000000Z', 'X-CC-NOTE:keep']

function todos() {
	return [
		stored('P', { categories: 'project', sort: 10 }),
		stored('t1', { parent: 'P', sort: 10, extra: ORIGINAL }),
	]
}

describe('projects store updateTask', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
		putTodo.mockImplementation(async (url) => ({ etag: `"${uidOfUrl(url)}-e2"` }))
	})

	it('renames: writes the new summary with the etag and keeps every other property', async () => {
		const store = await loadStore(todos())

		await store.updateTask('t1', { summary: 'New title' })

		expect(putTodo).toHaveBeenCalledTimes(1)
		const [url, ics, etag] = putTodo.mock.calls[0]
		expect([url, etag]).toEqual(['/list-b/t1.ics', '"t1-e1"'])
		expect(sent(putTodo.mock.calls[0]).summary).toBe('New title')
		for (const line of ['PRIORITY:5', 'DUE:20260101T000000Z', 'X-CC-NOTE:keep', 'X-APPLE-SORT-ORDER:10', 'RELATED-TO:P']) {
			expect(ics).toContain(line)
		}
		expect(store.tasksByUid.t1.summary).toBe('New title')
		expect(store.tasksByUid.t1.etag).toBe('"t1-e2"')
	})

	it('sets a due date from a Date, and clears it with null', async () => {
		const store = await loadStore(todos())

		await store.updateTask('t1', { due: new Date(Date.UTC(2026, 10, 5, 12, 0, 0)) })
		expect(sent(putTodo.mock.calls[0]).due.toJSDate().toISOString()).toBe('2026-11-05T12:00:00.000Z')

		await store.updateTask('t1', { due: null })
		expect(putTodo.mock.calls[1][1]).not.toContain('DUE')
		expect(putTodo.mock.calls[1][2]).toBe('"t1-e2"')
		expect(store.tasksByUid.t1.due).toBeNull()
	})

	it.each([1, 5, 9])('sets priority %i', async (priority) => {
		const store = await loadStore(todos())

		await store.updateTask('t1', { priority })

		expect(sent(putTodo.mock.calls[0]).priority).toBe(priority)
	})

	it('removes PRIORITY when the priority is 0 (none)', async () => {
		const store = await loadStore(todos())

		await store.updateTask('t1', { priority: 0 })

		expect(putTodo.mock.calls[0][1]).not.toContain('PRIORITY')
	})

	it('changes only the fields it is given', async () => {
		const store = await loadStore(todos())

		await store.updateTask('t1', { priority: 9 })

		const task = sent(putTodo.mock.calls[0])
		expect(task.summary).toBe('t1')
		expect(task.due.toJSDate().toISOString()).toBe('2026-01-01T00:00:00.000Z')
	})

	it('writes nothing for empty changes or an unknown uid', async () => {
		const store = await loadStore(todos())

		await store.updateTask('t1', {}).catch(() => {})
		await store.updateTask('nope', { summary: 'x' }).catch(() => {})

		expect(putTodo).not.toHaveBeenCalled()
	})

	it('shows the change at once, before the write finishes', async () => {
		const store = await loadStore(todos())
		const gate = Promise.withResolvers()
		putTodo.mockImplementation(async () => {
			await gate.promise
			return { etag: '"x"' }
		})

		const pending = store.updateTask('t1', { summary: 'Typed' })

		expect(store.tasksByUid.t1.summary).toBe('Typed')
		gate.resolve()
		await pending
	})

	it('puts the old values and etag back and shows "Could not save the change" when the write fails', async () => {
		const store = await loadStore(todos())
		putTodo.mockRejectedValue(new Error('network down'))

		await store.updateTask('t1', { summary: 'New title', priority: 1 }).catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not save the change')
		expect(store.tasksByUid.t1.summary).toBe('t1')
		expect(store.tasksByUid.t1.priority).toBe(5)
		expect(store.tasksByUid.t1.etag).toBe('"t1-e1"')
	})

	it('reloads the task and shows "Someone else changed this; reloaded" on a conflict', async () => {
		const store = await loadStore(todos())
		putTodo.mockRejectedValue(new ConflictError('/list-b/t1.ics'))
		fetchTodo.mockResolvedValue(fresh('t1', { parent: 'P', sort: 10, extra: ['PRIORITY:1'] }))

		await store.updateTask('t1', { summary: 'New title' }).catch(() => {})

		expect(fetchTodo).toHaveBeenCalledWith('/list-b/t1.ics')
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()
		expect(store.tasksByUid.t1.etag).toBe('"t1-fresh"')
		expect(store.tasksByUid.t1.priority).toBe(1)
	})
})
