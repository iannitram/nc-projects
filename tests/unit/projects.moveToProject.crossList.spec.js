/**
 * #26 (P12): a cross-list move, with failure injection.
 * Every dav.js call stands for one HTTP request against a small fake server, so the
 * request log below is the sequence the real Nextcloud would see.
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/dav.js', () => {
	class ConflictError extends Error {
		constructor(url) {
			super(`Conflict writing ${url}`)
			this.name = 'ConflictError'
			this.url = url
		}
	}
	class MoveError extends Error {
		constructor(url, status, reason) {
			super(`Could not move ${url}: HTTP ${status}`)
			this.name = 'MoveError'
			this.url = url
			this.status = status
			this.reason = reason
		}
	}
	return {
		listTaskCalendars: vi.fn(),
		fetchTodos: vi.fn(),
		fetchTodo: vi.fn(),
		createTodo: vi.fn(),
		putTodo: vi.fn(),
		moveTodo: vi.fn(),
		getDavSession: vi.fn(() => ({})),
		ConflictError,
		MoveError,
	}
})
vi.mock('@nextcloud/dialogs', () => ({
	showError: vi.fn(),
	showInfo: vi.fn(),
	showSuccess: vi.fn(),
}))

import { showError } from '@nextcloud/dialogs'
import { Task } from '../../src/models/Task.js'
import { ConflictError, fetchTodo, fetchTodos, listTaskCalendars, MoveError, moveTodo, putTodo } from '../../src/services/dav.js'
import { useProjectsStore } from '../../src/store/projects.js'

const GARDEN = { url: '/list-b/', displayName: 'Garden', ownedByMe: true, writable: true, ctag: 'v1' }
const WORK = { url: '/list-c/', displayName: 'Work', ownedByMe: true, writable: true, ctag: 'v1' }

function vtodo({ uid, categories, parent, sort, status, extra = [] }) {
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'BEGIN:VTODO',
		`UID:${uid}`,
		`SUMMARY:${uid}`,
		`STATUS:${status ?? 'NEEDS-ACTION'}`,
		status === 'COMPLETED' ? 'COMPLETED:20260101T000000Z' : null,
		'CREATED:20200101T000000Z',
		categories ? `CATEGORIES:${categories}` : null,
		parent ? `RELATED-TO:${parent}` : null,
		sort !== undefined ? `X-APPLE-SORT-ORDER:${sort}` : null,
		...extra,
		'END:VTODO',
		'END:VCALENDAR',
		'',
	].filter((line) => line !== null).join('\r\n')
}

const uidOfUrl = (url) => url.split('/').pop().replace('.ics', '')
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status })

/** The fake server: url -> { ics, etag, calendarUrl }. */
let server
/** Every request after load, in order. */
let log
/** Return an error to fail a request: (method, url, nth request of that method) => Error | undefined */
let inject

function seed(entries) {
	server = new Map(entries.map(([listUrl, uid, fields]) => [`${listUrl}${uid}.ics`, {
		ics: vtodo({ uid, ...fields }),
		etag: `"${uid}-e1"`,
		calendarUrl: listUrl,
	}]))
}

const snapshot = () => JSON.parse(JSON.stringify([...server.entries()]))

beforeEach(() => {
	setActivePinia(createPinia())
	vi.clearAllMocks()
	log = []
	inject = () => undefined
	const counts = {}
	const request = (method, url, extra = []) => {
		counts[method] = (counts[method] ?? 0) + 1
		log.push([method, url, ...extra])
		const error = inject(method, url, counts[method])
		if (error) {
			throw error
		}
	}

	listTaskCalendars.mockImplementation(async () => [{ ...GARDEN }, { ...WORK }])
	fetchTodos.mockImplementation(async (calendar) => {
		request('REPORT', calendar.url)
		return [...server.entries()]
			.filter(([, entry]) => entry.calendarUrl === calendar.url)
			.map(([url, entry]) => ({ url, ...entry }))
	})
	fetchTodo.mockImplementation(async (url) => {
		request('GET', url)
		const entry = server.get(url)
		if (!entry) {
			throw httpError(404)
		}
		return { url, ...entry }
	})
	moveTodo.mockImplementation(async (url, targetCalendarUrl, etag) => {
		request('MOVE', url, [targetCalendarUrl, etag])
		const entry = server.get(url)
		if (!entry || entry.etag !== etag) {
			throw new ConflictError(url)
		}
		const destination = `${targetCalendarUrl}${url.split('/').pop()}`
		server.delete(url)
		server.set(destination, { ...entry, calendarUrl: targetCalendarUrl, etag: `"${uidOfUrl(url)}-moved"` })
		return destination
	})
	putTodo.mockImplementation(async (url, ics, etag) => {
		request('PUT', url, [etag])
		const entry = server.get(url)
		if (!entry || entry.etag !== etag) {
			throw new ConflictError(url)
		}
		server.set(url, { ...entry, ics, etag: `"${uidOfUrl(url)}-put"` })
		return { etag: `"${uidOfUrl(url)}-put"` }
	})
})

/** t1 (with s1 open and s2 done) under P on Garden; Q (with q1) on Work. */
async function loadStore() {
	seed([
		['/list-b/', 'P', { categories: 'project', sort: 10 }],
		['/list-b/', 't1', { parent: 'P', sort: 10, extra: ['X-CC-NOTE:keep', 'X-FORK-ID:123', 'DESCRIPTION;LANGUAGE=en:notes'] }],
		['/list-b/', 's1', { parent: 't1', sort: 10 }],
		['/list-b/', 's2', { parent: 't1', sort: 20, status: 'COMPLETED' }],
		['/list-c/', 'Q', { categories: 'project', sort: 20 }],
		['/list-c/', 'q1', { parent: 'Q', sort: 10 }],
	])
	const store = useProjectsStore()
	await store.load()
	log = []
	return store
}

/** The store holds exactly what the server holds (url, etag, list, content). */
function expectStoreMatchesServer(store) {
	const byUid = Object.fromEntries([...server.entries()].map(([url, entry]) => [uidOfUrl(url), { url, ...entry }]))
	expect(Object.keys(store.tasksByUid).sort()).toEqual(Object.keys(byUid).sort())
	for (const [uid, entry] of Object.entries(byUid)) {
		const task = store.tasksByUid[uid]
		expect({ uid, url: task.url, etag: task.etag, calendarUrl: task.calendarUrl, parentUid: task.parentUid ?? null })
			.toEqual({ uid, url: entry.url, etag: entry.etag, calendarUrl: entry.calendarUrl, parentUid: Task.fromIcs(entry.ics, {}).parentUid ?? null })
	}
}

const icsLines = (ics, drop) => ics.split(/\r\n/).filter((line) => line && !drop.some((name) => line.startsWith(name)))

describe('moveToProject across lists (#26)', () => {
	it('moves subtasks first, then the task, each with If-Match and a re-read, then one PUT that re-links it', async () => {
		const store = await loadStore()
		const before = server.get('/list-b/t1.ics').ics

		await store.moveToProject('t1', 'Q', 1)

		expect(log).toEqual([
			['MOVE', '/list-b/s1.ics', '/list-c/', '"s1-e1"'],
			['GET', '/list-c/s1.ics'],
			['MOVE', '/list-b/s2.ics', '/list-c/', '"s2-e1"'],
			['GET', '/list-c/s2.ics'],
			['MOVE', '/list-b/t1.ics', '/list-c/', '"t1-e1"'],
			['GET', '/list-c/t1.ics'],
			['PUT', '/list-c/t1.ics', '"t1-moved"'],
		])
		expect(showError).not.toHaveBeenCalled()

		const written = server.get('/list-c/t1.ics').ics
		expect(Task.fromIcs(written, {}).parentUid).toBe('Q')
		expect(written.match(/RELATED-TO/g)).toHaveLength(1)
		// Every other property is kept (the drop position may set the sort order; every write stamps DTSTAMP and LAST-MODIFIED)
		const changed = ['RELATED-TO', 'X-APPLE-SORT-ORDER', 'DTSTAMP', 'LAST-MODIFIED']
		expect(icsLines(written, changed).sort()).toEqual(icsLines(before, changed).sort())
		// Subtasks are moved, never rewritten
		expect(server.get('/list-c/s1.ics').ics).toBe(vtodo({ uid: 's1', parent: 't1', sort: 10 }))
		expect(server.get('/list-c/s2.ics').ics).toBe(vtodo({ uid: 's2', parent: 't1', sort: 20, status: 'COMPLETED' }))

		expectStoreMatchesServer(store)
		const work = store.areas.find((area) => area.name === 'Work')
		const q = work.projects.find((node) => node.task.uid === 'Q')
		expect(q.children.map((node) => node.task.uid)).toEqual(['q1', 't1'])
	})

	it('a failed re-link PUT after the MOVEs: one notice saying what moved, both lists reloaded, store matches the server', async () => {
		const store = await loadStore()
		inject = (method) => (method === 'PUT' ? httpError(500) : undefined)

		await store.moveToProject('t1', 'Q', 1)

		const afterPut = log.slice(log.findIndex(([method]) => method === 'PUT') + 1)
		expect(afterPut.map(([method, url]) => `${method} ${url}`).sort()).toEqual(['REPORT /list-b/', 'REPORT /list-c/'])
		expect(showError).toHaveBeenCalledTimes(1)
		expect(showError.mock.calls[0][0]).toBe("Moved 't1' and its 2 subtasks to Work, but it is still under 'P'. Try again.")
		expectStoreMatchesServer(store)
		expect(store.tasksByUid.t1.calendarUrl).toBe('/list-c/')
		expect(store.tasksByUid.t1.parentUid).toBe('P')
	})

	it('a 412 on the first MOVE: one message, no further requests, nothing changed', async () => {
		const store = await loadStore()
		const before = snapshot()
		inject = (method, url, nth) => (method === 'MOVE' && nth === 1 ? new ConflictError(url) : undefined)

		await store.moveToProject('t1', 'Q', 1)

		expect(log).toEqual([['MOVE', '/list-b/s1.ics', '/list-c/', '"s1-e1"']])
		expect(showError).toHaveBeenCalledTimes(1)
		expect(showError.mock.calls[0][0]).toBe("Could not move 't1': it or a subtask was changed elsewhere. Nothing was moved; refresh and try again.")
		expect(snapshot()).toEqual(before)
		expectStoreMatchesServer(store)
	})

	it('a failure on the second MOVE: stops, reloads both lists, and names what moved', async () => {
		const store = await loadStore()
		inject = (method, url, nth) => (method === 'MOVE' && nth === 2 ? new MoveError(url, 500, 'failed') : undefined)

		await store.moveToProject('t1', 'Q', 1)

		expect(log.map(([method, url]) => `${method} ${url}`)).toEqual([
			'MOVE /list-b/s1.ics',
			'GET /list-c/s1.ics',
			'MOVE /list-b/s2.ics',
			expect.stringMatching(/^REPORT /),
			expect.stringMatching(/^REPORT /),
		])
		expect(showError).toHaveBeenCalledTimes(1)
		expect(showError.mock.calls[0][0]).toBe("Moved 1 of 2 subtasks of 't1' to Work; 't1' and the rest stayed on Garden. Try again.")
		expectStoreMatchesServer(store)
		expect(store.tasksByUid.s1.calendarUrl).toBe('/list-c/')
		expect(store.tasksByUid.s2.calendarUrl).toBe('/list-b/')
		expect(store.tasksByUid.t1.calendarUrl).toBe('/list-b/')
	})

	it('the target list vanished (404 on MOVE): one message, nothing changed', async () => {
		const store = await loadStore()
		const before = snapshot()
		inject = (method, url) => (method === 'MOVE' ? new MoveError(url, 404, 'target-missing') : undefined)

		await store.moveToProject('t1', 'Q', 1)

		expect(log).toHaveLength(1)
		expect(showError).toHaveBeenCalledTimes(1)
		expect(showError.mock.calls[0][0]).toBe("Could not move 't1': Work is no longer available. Nothing was moved.")
		expect(snapshot()).toEqual(before)
		expectStoreMatchesServer(store)
	})

	it('the file already exists on the target list (412 with Overwrite: F): one message, nothing overwritten', async () => {
		const store = await loadStore()
		const before = snapshot()
		inject = (method, url) => (method === 'MOVE' ? new MoveError(url, 412, 'exists') : undefined)

		await store.moveToProject('t1', 'Q', 1)

		expect(log).toHaveLength(1)
		expect(showError).toHaveBeenCalledTimes(1)
		expect(showError.mock.calls[0][0]).toBe("Could not move 't1': Work already has a task with the same file. Nothing was moved.")
		expect(snapshot()).toEqual(before)
		expectStoreMatchesServer(store)
	})

	it('a same-list move is still exactly one PUT', async () => {
		seed([
			['/list-b/', 'P', { categories: 'project', sort: 10 }],
			['/list-b/', 't1', { parent: 'P', sort: 10 }],
			['/list-b/', 's1', { parent: 't1', sort: 10 }],
			['/list-b/', 'R', { categories: 'project', sort: 20 }],
		])
		const store = useProjectsStore()
		await store.load()
		log = []

		await store.moveToProject('t1', 'R', 0)

		expect(log).toEqual([['PUT', '/list-b/t1.ics', '"t1-e1"']])
		expect(moveTodo).not.toHaveBeenCalled()
	})
})
