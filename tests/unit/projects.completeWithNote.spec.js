import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/dav.js', () => ({
	listTaskCalendars: vi.fn(),
	fetchTodos: vi.fn(),
	fetchTodo: vi.fn(),
	putTodo: vi.fn(),
	moveTodo: vi.fn(),
	createTodo: vi.fn(),
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
vi.mock('../../src/services/settings.js', () => ({
	getAreaLists: vi.fn(async () => ['/a/', '/b/']),
	saveAreaLists: vi.fn(),
}))

import { showError, showInfo } from '@nextcloud/dialogs'
import { Task } from '../../src/models/Task.js'
import { ConflictError, fetchTodo, fetchTodos, listTaskCalendars, putTodo } from '../../src/services/dav.js'
import { useProjectsStore } from '../../src/store/projects.js'

// A DAV fake that enforces If-Match and keeps the exact text it receives.
let server, version, ctag
const TODAY = '2026-11-02'
const urlOf = (uid, calendar = '/a/') => `${calendar}${uid}.ics`
const snapshot = () => Object.fromEntries([...server].map(([url, task]) => [url, task.ics]))

function seed(uid, { parent, project, sort = 10, done = false, description } = {}) {
	const ics = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'BEGIN:VTODO',
		`UID:${uid}`,
		`SUMMARY:${uid}`,
		`STATUS:${done ? 'COMPLETED' : 'NEEDS-ACTION'}`,
		done && 'COMPLETED:20260101T000000Z',
		done && 'PERCENT-COMPLETE:100',
		project && 'CATEGORIES:project',
		parent && `RELATED-TO:${parent}`,
		`X-APPLE-SORT-ORDER:${sort}`,
		'DUE;VALUE=DATE:20261102',
		'PRIORITY:5',
		description !== undefined && `DESCRIPTION;LANGUAGE=en:${description}`,
		'X-CC-CUSTOM;X-KEEP=yes:keep',
		'X-FORK-ID:123',
		'END:VTODO',
		'END:VCALENDAR',
		'',
	].filter((line) => line !== false && line !== undefined).join('\r\n')
	const url = urlOf(uid)
	server.set(url, { url, calendarUrl: '/a/', etag: `"${++version}"`, ics })
}

function open() {
	seed('P', { project: true })
	seed('t', { parent: 'P', sort: 10, description: 'Original note' })
	seed('s', { parent: 't' })
	seed('u', { parent: 'P', sort: 20 })
}

beforeEach(() => {
	setActivePinia(createPinia())
	vi.resetAllMocks()
	server = new Map()
	version = 0
	ctag = 'v1'
	listTaskCalendars.mockImplementation(async () => ['a'].map((name) => ({
		url: `/${name}/`,
		displayName: name,
		ownedByMe: true,
		writable: true,
		ctag,
	})))
	fetchTodos.mockImplementation(async ({ url }) => [...server.values()].filter((task) => task.calendarUrl === url).map((task) => ({ ...task })))
	fetchTodo.mockImplementation(async (url) => {
		if (!server.has(url)) {
			throw new Error('Missing task')
		}
		return { ...server.get(url) }
	})
	putTodo.mockImplementation(async (url, ics, etag) => {
		const task = server.get(url)
		if (!task || task.etag !== etag) {
			throw new ConflictError(url)
		}
		const next = { ...task, ics, etag: `"${++version}"` }
		server.set(url, next)
		return { etag: next.etag }
	})
	open()
})

async function load() {
	const store = useProjectsStore()
	await store.load()
	return store
}

function expectEntry(store, before, label, uids) {
	expect(store.undoStack).toHaveLength(1)
	expect(store.undoStack[0]).toEqual({ label, items: uids.map((uid) => {
		const originalUrl = Object.keys(before).find((url) => url.endsWith(`/${uid}.ics`))
		const current = store.tasksByUid[uid]
		return {
			uid,
			before: { ics: before[originalUrl], url: originalUrl, calendarUrl: '/a/' },
			after: { url: current.url, etag: current.etag },
		}
	}) })
}

const descriptionOf = (ics) => Task.fromIcs(ics, {}).description

describe('projects store completeWithNote', () => {
	it('appends the note to the task DESCRIPTION in the same PUT as its completion', async () => {
		const store = await load()

		await store.completeWithNote('t', 'Finished the draft', TODAY)

		expect(putTodo.mock.calls.map((call) => call[0])).toEqual([urlOf('t'), urlOf('s')])
		const sentTask = Task.fromIcs(putTodo.mock.calls[0][1], {})
		expect(sentTask.completed).toBe(true)
		expect(sentTask.description).toBe('Original note\n- 2026-11-02 Finished the draft')
		expect(store.tasksByUid.t.description).toBe('Original note\n- 2026-11-02 Finished the draft')
		expect(store.tasksByUid.t.completed).toBe(true)
		expect(store.tasksByUid.s.completed).toBe(true)
	})

	it('writes the note only to the task itself, not to the descendants it completes', async () => {
		const store = await load()

		await store.completeWithNote('t', 'Done', TODAY)

		expect(descriptionOf(putTodo.mock.calls[1][1])).toBeNull()
		expect(store.tasksByUid.s.description).toBeNull()
	})

	it('a blank note changes no DESCRIPTION and writes the same cascade as setCompleted', async () => {
		const store = await load()

		await store.completeWithNote('t', '   ', TODAY)

		expect(putTodo.mock.calls.map((call) => call[0])).toEqual([urlOf('t'), urlOf('s')])
		expect(putTodo.mock.calls[0][1]).toContain('DESCRIPTION;LANGUAGE=en:Original note\r\n')
		expect(store.tasksByUid.t.description).toBe('Original note')
		expect(store.tasksByUid.t.completed).toBe(true)
	})

	it('sets a DESCRIPTION on a task that had none', async () => {
		server.delete(urlOf('t'))
		seed('t', { parent: 'P', sort: 10 })
		const store = await load()

		await store.completeWithNote('t', 'First note', TODAY)

		expect(store.tasksByUid.t.description).toBe('- 2026-11-02 First note')
	})

	it('pushes one undo entry labelled Completed and restores the exact stored text', async () => {
		const store = await load()
		const before = snapshot()

		await store.completeWithNote('t', 'Done', TODAY)

		expectEntry(store, before, 'Completed: t', ['t', 's'])
		putTodo.mockClear()
		await store.undo()
		expect(snapshot()).toEqual(before)
		expect(store.undoStack).toEqual([])
		expect(store.tasksByUid.t.description).toBe('Original note')
		expect(store.tasksByUid.t.completed).toBe(false)
	})

	it('shows the change at once, before the writes finish', async () => {
		const store = await load()
		const gate = Promise.withResolvers()
		putTodo.mockImplementation(async (url, ics, etag) => {
			await gate.promise
			return { etag: `"${etag}-x"` }
		})

		const pending = store.completeWithNote('u', 'Later', TODAY)

		expect(store.tasksByUid.u.completed).toBe(true)
		expect(store.tasksByUid.u.description).toBe('- 2026-11-02 Later')
		gate.resolve()
		await pending
	})

	it('rolls the task back, description included, when a write fails', async () => {
		const store = await load()
		putTodo.mockRejectedValue(new Error('network down'))

		await store.completeWithNote('t', 'Done', TODAY).catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not save the change')
		expect(store.tasksByUid.t.completed).toBe(false)
		expect(store.tasksByUid.t.description).toBe('Original note')
		expect(store.undoStack).toEqual([])
	})

	it('reloads the task and shows "Someone else changed this; reloaded" on a conflict', async () => {
		const store = await load()
		server.set(urlOf('t'), { ...server.get(urlOf('t')), etag: '"moved-on"' })

		await store.completeWithNote('t', 'Done', TODAY)

		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()
		expect(store.tasksByUid.t.etag).toBe('"moved-on"')
		expect(store.tasksByUid.t.description).toBe('Original note')
		expect(store.undoStack).toEqual([])
	})

	it('writes nothing for a task that is already done', async () => {
		server.delete(urlOf('s'))
		seed('s', { parent: 't', done: true })
		const store = await load()

		await store.completeWithNote('s', 'Again', TODAY)

		expect(putTodo).not.toHaveBeenCalled()
	})
})
