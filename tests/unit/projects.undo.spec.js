import ICAL from 'ical.js'
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
			super('Conflict')
			this.url = url
		}
	},
}))
vi.mock('@nextcloud/dialogs', () => ({ showError: vi.fn(), showInfo: vi.fn() }))
vi.mock('../../src/services/settings.js', () => ({
	getAreaLists: vi.fn(async () => ['/a/', '/b/']),
	saveAreaLists: vi.fn(),
}))

import { showError, showInfo } from '@nextcloud/dialogs'
import { ConflictError, fetchTodo, fetchTodos, listTaskCalendars, moveTodo, putTodo } from '../../src/services/dav.js'
import { useProjectsStore } from '../../src/store/projects.js'

// A DAV fake that enforces If-Match and preserves the exact text it receives.
let server, log, version, inject, ctag
const urlOf = (uid, calendar = '/a/') => `${calendar}${uid}.ics`
const snapshot = () => Object.fromEntries([...server].map(([url, task]) => [url, task.ics]))

function seed(uid, { calendar = '/a/', parent, project, sort = 10, done = false } = {}) {
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
		'DESCRIPTION;LANGUAGE=en:Original note',
		'X-CC-CUSTOM;X-KEEP=yes:keep',
		'X-FORK-ID:123',
		'END:VTODO',
		'END:VCALENDAR',
		'',
	].filter((line) => line !== false && line !== undefined).join('\r\n')
	const url = urlOf(uid, calendar)
	server.set(url, { url, calendarUrl: calendar, etag: `"${++version}"`, ics })
}

beforeEach(() => {
	setActivePinia(createPinia())
	vi.resetAllMocks()
	server = new Map()
	log = []
	version = 0
	ctag = 'v1'
	inject = () => {}
	const request = (op, url, etag) => {
		log.push([op, url, ...(etag === undefined ? [] : [etag])])
		inject(op, url)
	}
	const guarded = (url, etag) => {
		const task = server.get(url)
		if (!task || task.etag !== etag) {
			throw new ConflictError(url)
		}
		return task
	}
	listTaskCalendars.mockImplementation(async () => ['a', 'b'].map((name) => ({
		url: `/${name}/`,
		displayName: name,
		ownedByMe: true,
		writable: true,
		ctag,
	})))
	fetchTodos.mockImplementation(async ({ url }) => [...server.values()].filter((task) => task.calendarUrl === url).map((task) => ({ ...task })))
	fetchTodo.mockImplementation(async (url) => {
		request('GET', url)
		if (!server.has(url)) {
			throw new Error('Missing task')
		}
		return { ...server.get(url) }
	})
	putTodo.mockImplementation(async (url, ics, etag) => {
		request('PUT', url, etag)
		const task = guarded(url, etag)
		const next = { ...task, ics, etag: `"${++version}"` }
		server.set(url, next)
		return { etag: next.etag }
	})
	moveTodo.mockImplementation(async (url, calendarUrl, etag) => {
		request('MOVE', url, etag)
		const task = guarded(url, etag)
		const destination = `${calendarUrl}${url.split('/').pop()}`
		if (server.has(destination)) {
			throw new Error('Destination exists')
		}
		server.delete(url)
		server.set(destination, { ...task, url: destination, calendarUrl, etag: `"${++version}"` })
		return destination
	})
	seed('P', { project: true })
	seed('Q', { project: true, sort: 11 })
	seed('R', { project: true, sort: 12 })
	seed('Other', { project: true, calendar: '/b/' })
	seed('t', { parent: 'P', sort: 10 })
	seed('s', { parent: 't' })
	seed('u', { parent: 'P', sort: 11 })
	seed('v', { parent: 'P', sort: 12 })
	seed('bumped', { parent: 'Other', calendar: '/b/', sort: 0 })
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
			before: { ics: before[originalUrl], url: originalUrl, calendarUrl: originalUrl.slice(0, originalUrl.lastIndexOf('/') + 1) },
			after: { url: current.url, etag: current.etag },
		}
	}) })
}

async function expectRestored(store, before) {
	log = []
	await store.undo()
	expect(showError).not.toHaveBeenCalled()
	expect(snapshot()).toEqual(before)
	expect(store.undoStack).toEqual([])
	for (const task of Object.values(store.tasksByUid)) {
		expect(task.toIcs()).toBe(server.get(task.url).ics)
		expect(task.etag).toBe(server.get(task.url).etag)
	}
}

describe('recording and restoring writes', () => {
	it.each([
		['rename', { summary: 'New title' }, 'Renamed: t'],
		['re-date', { due: ICAL.Time.fromDateString('2026-11-05') }, 'Moved to 2026-11-05: t'],
		['clear date', { due: null }, 'Moved to no date: t'],
		['priority', { priority: 1 }, 'Priority: t'],
		['clear priority', { priority: 0 }, 'Priority: t'],
		['note', { description: 'Original note\n- 2026-11-02 Finished' }, 'Note: t'],
	])('%s restores the exact stored text', async (_, changes, label) => {
		const store = await load()
		const before = snapshot()
		await store.updateTask('t', changes)
		expectEntry(store, before, label, ['t'])
		await expectRestored(store, before)
		expect(log.map(([op]) => op)).toEqual(['PUT', 'GET'])
	})

	it('completion includes all open descendants in write order and restores the tree', async () => {
		const store = await load()
		const before = snapshot()
		await store.setCompleted('t', true)
		expectEntry(store, before, 'Completed: t', ['t', 's'])
		await expectRestored(store, before)
		expect(log.map(([op, url]) => [op, url])).toEqual([
			['PUT', urlOf('s')],
			['GET', urlOf('s')],
			['PUT', urlOf('t')],
			['GET', urlOf('t')],
		])
		expect(store.areas[0].projects[0].progress.done).toBe(0)
	})

	it('reopening records closed ancestors in write order', async () => {
		for (const [uid, fields] of [['P', { project: true }], ['t', { parent: 'P' }], ['s', { parent: 't' }]]) {
			seed(uid, { ...fields, done: true })
		}
		const store = await load()
		const before = snapshot()
		await store.setCompleted('s', false)
		expectEntry(store, before, 'Reopened: s', ['s', 't', 'P'])
		await expectRestored(store, before)
	})

	it.each([false, true])('reorder (projects: %s) includes bumped siblings', async (projects) => {
		const store = await load()
		const before = snapshot()
		await store.reorder(projects ? null : 'P', 'a', projects ? 'R' : 'v', 1)
		expectEntry(store, before, 'Reordered', projects ? ['R', 'Q'] : ['v', 'u'])
		await expectRestored(store, before)
		expect(store.areas[0].projects.map(({ task }) => task.uid)).toEqual(['P', 'Q', 'R'])
	})

	it('same-list move records the moved task and bumped siblings', async () => {
		seed('bump', { parent: 'Q', sort: 0 })
		const store = await load()
		const before = snapshot()
		await store.moveToProject('t', 'Q', 0)
		expectEntry(store, before, 'Moved: t', ['t', 'bump'])
		await expectRestored(store, before)
	})

	it('cross-list move records descendants, one MOVE+PUT item and bumped siblings', async () => {
		const store = await load()
		const before = snapshot()
		await store.moveToProject('t', 'Other', 0)
		expectEntry(store, before, 'Moved: t', ['s', 't', 'bumped'])
		const tEtag = store.tasksByUid.t.etag
		await expectRestored(store, before)
		expect(log.map(([op, url]) => [op, url])).toEqual([
			['PUT', urlOf('bumped', '/b/')],
			['GET', urlOf('bumped', '/b/')],
			['MOVE', urlOf('t', '/b/')],
			['GET', urlOf('t')],
			['PUT', urlOf('t')],
			['GET', urlOf('t')],
			['MOVE', urlOf('s', '/b/')],
			['GET', urlOf('s')],
			['PUT', urlOf('s')],
			['GET', urlOf('s')],
		])
		expect(log[2][2]).toBe(tEtag)
		expect(log[4][2]).not.toBe(tEtag) // PUT uses the etag read after MOVE.
		expect(store.tasksByUid.t.parentUid).toBe('P')
	})

	it.each(['category', 'make-project'])('%s uses the same recorder', async (action) => {
		const store = await load()
		const before = snapshot()
		if (action === 'category') {
			await store.toggleCategory('P', 'blocked')
			expectEntry(store, before, 'Updated: P', ['P'])
		} else {
			await store.makeProject('t')
			expectEntry(store, before, 'Made project: t', ['t'])
		}
		await expectRestored(store, before)
	})

	it('publishes only after every write lands', async () => {
		const store = await load()
		const put = putTodo.getMockImplementation()
		const gate = Promise.withResolvers()
		putTodo.mockImplementationOnce(async (...args) => {
			await gate.promise
			return put(...args)
		})
		const pending = store.updateTask('t', { priority: 1 })
		expect(store.undoStack).toEqual([])
		gate.resolve()
		await pending
		expect(store.undoStack).toHaveLength(1)
	})

	it('supports successive undos of the same task over our own etags', async () => {
		const store = await load()
		const before = snapshot()
		await store.updateTask('t', { priority: 1 })
		await store.updateTask('t', { summary: 'Next' })
		await store.undo()
		expect(store.undoStack).toHaveLength(1)
		await expectRestored(store, before)
	})

	it('keeps a new entry when another task is edited while undo is pending', async () => {
		const store = await load()
		await store.updateTask('t', { priority: 1 })
		const put = putTodo.getMockImplementation()
		const gate = Promise.withResolvers()
		putTodo.mockImplementationOnce(async (...args) => {
			await gate.promise
			return put(...args)
		})
		const pending = store.undo()
		await store.updateTask('u', { priority: 9 })
		gate.resolve()
		await pending
		expect(store.undoStack).toHaveLength(1)
		expect(store.undoStack[0].items.map(({ uid }) => uid)).toEqual(['u'])
		expect(store.tasksByUid.t.priority).toBe(5)
	})

	it('does not record no-op actions', async () => {
		const store = await load()
		await store.updateTask('t', {})
		await store.setCompleted('t', false)
		await store.moveToProject('missing', 'Q', 0)
		await store.reorder('missing', 'a', 't', 0)
		expect(store.undoStack).toEqual([])
		expect(putTodo).not.toHaveBeenCalled()
	})
})

describe('failure and conflict paths', () => {
	it.each(['edit', 'completion', 'move', 'reorder', 'projects', 'cross-list'])('failed %s publishes nothing', async (action) => {
		seed('bump', { parent: 'Q', sort: 0 })
		const store = await load()
		const before = snapshot()
		let writes = 0
		inject = (op) => {
			if ((op === 'PUT' || op === 'MOVE') && ++writes === (action === 'edit' ? 1 : 2)) {
				throw new Error('Failed write')
			}
		}
		const actions = {
			edit: () => store.updateTask('t', { priority: 1 }),
			completion: () => store.setCompleted('t', true),
			move: () => store.moveToProject('t', 'Q', 0),
			reorder: () => store.reorder('P', 'a', 'v', 1),
			projects: () => store.reorder(null, 'a', 'R', 1),
			'cross-list': () => store.moveToProject('t', 'Other', 0),
		}
		await actions[action]()
		if (['move', 'reorder', 'projects'].includes(action)) {
			expect(snapshot()).toEqual(before)
		}
		expect(store.undoStack).toEqual([])
		expect(showError).toHaveBeenCalled()
	})

	it('a planned conflict writes nothing, reloads and drops only the changed task everywhere', async () => {
		const store = await load()
		await store.updateTask('t', { priority: 1 })
		await store.setCompleted('t', true)
		const external = { ...server.get(urlOf('t')), etag: '"external"' }
		server.set(external.url, external)
		store.tasksByUid.t.where.etag = external.etag
		log = []
		await store.undo()
		expect(log).toEqual([['GET', urlOf('t')]])
		expect(store.undoStack.map((entry) => entry.items.map(({ uid }) => uid))).toEqual([['s']])
		expect(store.tasksByUid.t.etag).toBe(external.etag)
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
	})

	it.each(['url', 'missing'])('a planned %s conflict reloads without writes', async (kind) => {
		const store = await load()
		await store.updateTask('t', { priority: 1 })
		if (kind === 'url') {
			const task = server.get(urlOf('t'))
			server.delete(task.url)
			server.set(urlOf('t', '/b/'), { ...task, url: urlOf('t', '/b/'), calendarUrl: '/b/' })
			store.tasksByUid.t.where = { ...store.tasksByUid.t.where, url: urlOf('t', '/b/'), calendarUrl: '/b/' }
		} else {
			delete store.tasksByUid.t
		}
		log = []
		await store.undo()
		expect(log).toEqual([['GET', urlOf('t', kind === 'url' ? '/b/' : '/a/')]])
		expect(store.undoStack).toEqual([])
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
	})

	it('a failed conflict reload still drops the unsafe task and shows Could not undo', async () => {
		const store = await load()
		await store.updateTask('t', { priority: 1 })
		store.tasksByUid.t.where.etag = '"external"'
		fetchTodo.mockRejectedValue(new Error('Unavailable'))
		await store.undo()
		expect(putTodo).toHaveBeenCalledTimes(1) // The edit only.
		expect(store.undoStack).toEqual([])
		expect(showError).toHaveBeenCalledWith('Could not undo')
		expect(showInfo).not.toHaveBeenCalled()
	})

	it('a conflict during an edit records nothing and invalidates older entries for that task', async () => {
		const store = await load()
		await store.updateTask('t', { priority: 1 })
		server.set(urlOf('t'), { ...server.get(urlOf('t')), etag: '"external"' })
		await store.updateTask('t', { summary: 'Refused' })
		expect(store.undoStack).toEqual([])
		expect(store.tasksByUid.t.summary).toBe('t')
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
	})

	it.each(['PUT', 'MOVE'])('a stale server etag refuses undo %s without blind retry', async (op) => {
		const store = await load()
		if (op === 'MOVE') {
			await store.moveToProject('t', 'Other', 1)
		} else {
			await store.updateTask('t', { priority: 1 })
		}
		const url = store.tasksByUid.t.url
		server.set(url, { ...server.get(url), etag: '"external"' })
		log = []
		await store.undo()
		expect(log).toEqual([[op, url, expect.any(String)], ['GET', url]])
		expect(store.undoStack.flatMap((entry) => entry.items).some(({ uid }) => uid === 't')).toBe(false)
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()
	})

	it.each(['PUT', 'MOVE', 'GET'])('a failed undo %s keeps the entry and shows Could not undo', async (op) => {
		const store = await load()
		if (op === 'MOVE') {
			await store.moveToProject('t', 'Other', 1)
		} else {
			await store.updateTask('t', { priority: 1 })
		}
		inject = (method) => {
			if (method === op) {
				throw new Error('Unavailable')
			}
		}
		await store.undo()
		expect(store.undoStack).toHaveLength(1)
		expect(showError).toHaveBeenCalledWith('Could not undo')
	})

	it('a partial undo can safely retry with the etags from its own landed writes', async () => {
		const store = await load()
		const before = snapshot()
		await store.setCompleted('t', true)
		inject = (op, url) => {
			if (op === 'PUT' && url === urlOf('t')) {
				throw new Error('Unavailable')
			}
		}
		await store.undo()
		expect(store.undoStack).toHaveLength(1)
		inject = () => {}
		vi.mocked(showError).mockClear()
		await expectRestored(store, before)
	})

	it.each(['changed', 'deleted', 'moved', 'unchanged'])('refresh drops an externally %s task, preserving other items', async (kind) => {
		const store = await load()
		await store.setCompleted('t', true)
		const task = server.get(urlOf('t'))
		if (kind === 'changed') {
			server.set(task.url, { ...task, etag: '"external"' })
		}
		if (kind === 'deleted') {
			server.delete(task.url)
		}
		if (kind === 'moved') {
			server.delete(task.url)
			server.set(urlOf('t', '/b/'), { ...task, url: urlOf('t', '/b/'), calendarUrl: '/b/' })
		}
		ctag = 'v2'
		await store.refresh()
		expect(store.undoStack[0].items.map(({ uid }) => uid)).toEqual(kind === 'unchanged' ? ['t', 's'] : ['s'])
	})

	it('a failed read after a cross-list MOVE records nothing', async () => {
		const store = await load()
		fetchTodo.mockRejectedValue(new Error('Unavailable'))
		await store.moveToProject('t', 'Other', 1)
		expect(store.undoStack).toEqual([])
		expect(showError).toHaveBeenCalled()
	})

	it('empty undo does nothing', async () => {
		const store = await load()
		await store.undo()
		expect(log).toEqual([])
	})
})
