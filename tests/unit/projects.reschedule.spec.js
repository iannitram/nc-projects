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

// 2026-11-02 is a Monday, so 'next-week' is 2026-11-09 and 'tomorrow' is 2026-11-03.
const TODAY = '2026-11-02'
let server, version
const urlOf = (uid) => `/a/${uid}.ics`
const snapshot = () => Object.fromEntries([...server].map(([url, task]) => [url, task.ics]))

const TZID_BLOCK = [
	'BEGIN:VTIMEZONE',
	'TZID:Test/Fixed',
	'BEGIN:STANDARD',
	'DTSTART:19700101T000000',
	'TZOFFSETFROM:-0500',
	'TZOFFSETTO:-0500',
	'END:STANDARD',
	'END:VTIMEZONE',
]

/**
 * Seed one open VTODO on list /a/. Pass due: null for a task with no DUE.
 *
 * @param {string} uid the task uid
 * @param {object} [options] the fixture options
 * @param {string|null} [options.due] the DUE line, or null for none
 * @param {boolean} [options.zoned] whether to include the VTIMEZONE block
 */
function seed(uid, { due = 'DUE;VALUE=DATE:20261102', zoned = false } = {}) {
	const ics = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//test//EN',
		...(zoned ? TZID_BLOCK : []),
		'BEGIN:VTODO',
		`UID:${uid}`,
		`SUMMARY:${uid}`,
		'STATUS:NEEDS-ACTION',
		'X-APPLE-SORT-ORDER:10',
		due,
		'PRIORITY:5',
		'DESCRIPTION;LANGUAGE=en:Original note',
		'X-CC-CUSTOM;X-KEEP=yes:keep',
		'END:VTODO',
		'END:VCALENDAR',
		'',
	].filter((line) => line !== null).join('\r\n')
	const url = urlOf(uid)
	server.set(url, { url, calendarUrl: '/a/', etag: `"${++version}"`, ics })
}

beforeEach(() => {
	setActivePinia(createPinia())
	vi.resetAllMocks()
	server = new Map()
	version = 0
	listTaskCalendars.mockImplementation(async () => [{ url: '/a/', displayName: 'a', ownedByMe: true, writable: true, ctag: 'v1' }])
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
	seed('t')
})

async function load() {
	const store = useProjectsStore()
	await store.load()
	return store
}

describe('projects store reschedule', () => {
	it.each([
		['tomorrow', '2026-11-03'],
		['next-week', '2026-11-09'],
		['2026-12-01', '2026-12-01'],
	])('%s sets DUE to %s in one PUT, keeping the other properties', async (kind, expected) => {
		const store = await load()

		await store.reschedule('t', kind, TODAY)

		expect(putTodo).toHaveBeenCalledTimes(1)
		expect(putTodo.mock.calls[0][0]).toBe(urlOf('t'))
		const sent = Task.fromIcs(putTodo.mock.calls[0][1], {})
		expect(sent.due.toString()).toBe(expected)
		expect(sent.due.isDate).toBe(true)
		expect(sent.summary).toBe('t')
		expect(sent.description).toBe('Original note')
		expect(putTodo.mock.calls[0][1]).toContain('X-CC-CUSTOM;X-KEEP=yes:keep')
		expect(store.tasksByUid.t.due.toString()).toBe(expected)
		expect(store.tasksByUid.t.description).toBe('Original note')
		expect(store.tasksByUid.t.etag).toBe(server.get(urlOf('t')).etag)
	})

	it('sets DUE on a task that had none', async () => {
		server.delete(urlOf('t'))
		seed('t', { due: null })
		const store = await load()

		await store.reschedule('t', 'tomorrow', TODAY)

		expect(store.tasksByUid.t.due.toString()).toBe('2026-11-03')
	})

	it('keeps the TZID and clock time of a date-time due in a named zone', async () => {
		server.delete(urlOf('t'))
		seed('t', { due: 'DUE;TZID=Test/Fixed:20261030T144500', zoned: true })
		const store = await load()

		await store.reschedule('t', 'tomorrow', TODAY)

		expect(putTodo.mock.calls[0][1]).toContain('DUE;TZID=Test/Fixed:20261103T144500')
		const stored = store.tasksByUid.t.due
		expect(stored.toString()).toBe('2026-11-03T14:45:00')
		expect(stored.zone.tzid).toBe('Test/Fixed')
	})

	it('pushes one undo entry labelled Moved to the new date and restores the exact stored text', async () => {
		const store = await load()
		const before = snapshot()

		await store.reschedule('t', 'tomorrow', TODAY)

		expect(store.undoStack).toHaveLength(1)
		expect(store.undoStack[0].label).toBe('Moved to 2026-11-03: t')
		expect(store.undoStack[0].items.map((item) => item.uid)).toEqual(['t'])
		await store.undo()
		expect(snapshot()).toEqual(before)
		expect(store.undoStack).toEqual([])
		expect(store.tasksByUid.t.due.toString()).toBe('2026-11-02')
	})

	it('shows the new date at once, before the write finishes', async () => {
		const store = await load()
		const gate = Promise.withResolvers()
		putTodo.mockImplementationOnce(async () => {
			await gate.promise
			return { etag: '"late"' }
		})

		const pending = store.reschedule('t', 'next-week', TODAY)

		expect(store.tasksByUid.t.due.toString()).toBe('2026-11-09')
		gate.resolve()
		await pending
	})

	it('puts the old DUE back and shows "Could not save the change" when the write fails', async () => {
		const store = await load()
		putTodo.mockRejectedValueOnce(new Error('network down'))

		await store.reschedule('t', 'tomorrow', TODAY)

		expect(showError).toHaveBeenCalledWith('Could not save the change')
		expect(store.tasksByUid.t.due.toString()).toBe('2026-11-02')
		expect(store.undoStack).toEqual([])
	})

	it('reloads the task and shows "Someone else changed this; reloaded" on a conflict', async () => {
		const store = await load()
		server.set(urlOf('t'), { ...server.get(urlOf('t')), etag: '"moved-on"' })

		await store.reschedule('t', 'tomorrow', TODAY)

		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()
		expect(store.tasksByUid.t.etag).toBe('"moved-on"')
		expect(store.tasksByUid.t.due.toString()).toBe('2026-11-02')
		expect(store.undoStack).toEqual([])
	})

	it('writes nothing for an unknown uid, and rejects an invalid kind before writing', async () => {
		const store = await load()

		await store.reschedule('missing', 'tomorrow', TODAY)
		await expect(store.reschedule('t', 'someday', TODAY)).rejects.toThrow(TypeError)

		expect(putTodo).not.toHaveBeenCalled()
	})
})
