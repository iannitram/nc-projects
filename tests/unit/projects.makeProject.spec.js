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

function todos() {
	return [
		stored('P', { categories: 'project', sort: 10 }),
		stored('p1', { parent: 'P', sort: 10 }),
		stored('U', { categories: 'home', sort: 20, extra: ['X-CC-NOTE:keep'] }),
		stored('u1', { parent: 'U', sort: 10 }),
		stored('V', { sort: 30 }),
		stored('v1', { parent: 'V', sort: 10 }),
		stored('o', { parent: 'gone', sort: 40 }),
	]
}

const projectUids = (store) => store.areas[0].projects.map((node) => node.task.uid)

describe('projects store makeProject', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
		putTodo.mockImplementation(async (url) => ({ etag: `"${uidOfUrl(url)}-e2"` }))
	})

	it('starts out with the untagged parents and the orphan in the tray lists', async () => {
		const store = await loadStore(todos())

		expect(store.untaggedParents.map((task) => task.uid)).toEqual(['U', 'V'])
		expect(store.orphans.map((task) => task.uid)).toEqual(['o'])
		expect(projectUids(store)).toEqual(['P'])
	})

	it('adds only the project category to an untagged parent, written once with its etag', async () => {
		const store = await loadStore(todos())

		await store.makeProject('U')

		expect(putTodo).toHaveBeenCalledTimes(1)
		const [url, ics, etag] = putTodo.mock.calls[0]
		expect([url, etag]).toEqual(['/van/U.ics', '"U-e1"'])
		expect(sent(putTodo.mock.calls[0]).categories).toEqual(['home', 'project'])
		for (const line of ['SUMMARY:U', 'X-CC-NOTE:keep', 'X-APPLE-SORT-ORDER:20']) {
			expect(ics).toContain(line)
		}
		expect(store.tasksByUid.U.etag).toBe('"U-e2"')
	})

	it('gives a task with no categories just ["project"]', async () => {
		const store = await loadStore(todos())

		await store.makeProject('V')

		expect(sent(putTodo.mock.calls[0]).categories).toEqual(['project'])
	})

	it('moves the parent into its area and out of the tray, children with it', async () => {
		const store = await loadStore(todos())

		await store.makeProject('U')

		expect(projectUids(store)).toEqual(['P', 'U'])
		expect(store.areas[0].projects[1].children.map((node) => node.task.uid)).toEqual(['u1'])
		expect(store.untaggedParents.map((task) => task.uid)).toEqual(['V'])
	})

	it('works on an orphan too', async () => {
		const store = await loadStore(todos())

		await store.makeProject('o')

		expect(sent(putTodo.mock.calls[0]).categories).toEqual(['project'])
		expect(projectUids(store)).toContain('o')
		expect(store.orphans).toEqual([])
	})

	it('writes nothing for a task that is already a project or an unknown uid', async () => {
		const store = await loadStore(todos())

		await store.makeProject('P').catch(() => {})
		await store.makeProject('nope').catch(() => {})

		expect(putTodo).not.toHaveBeenCalled()
	})

	it('puts the categories and etag back and shows "Could not make the project" when the write fails', async () => {
		const store = await loadStore(todos())
		putTodo.mockRejectedValue(new Error('network down'))

		await store.makeProject('U').catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not make the project')
		expect(store.tasksByUid.U.categories).toEqual(['home'])
		expect(store.tasksByUid.U.etag).toBe('"U-e1"')
		expect(store.untaggedParents.map((task) => task.uid)).toEqual(['U', 'V'])
		expect(projectUids(store)).toEqual(['P'])
	})

	it('shows "Could not make the project" and no "reloaded" notice when the conflict reload fails', async () => {
		const store = await loadStore(todos())
		putTodo.mockRejectedValue(new ConflictError('/van/U.ics'))
		fetchTodo.mockRejectedValue(new Error('reload failed'))

		await store.makeProject('U').catch(() => {})

		expect(showError).toHaveBeenCalledWith('Could not make the project')
		expect(showInfo).not.toHaveBeenCalled()
	})

	it('reloads the task and shows "Someone else changed this; reloaded" on a conflict', async () => {
		const store = await loadStore(todos())
		putTodo.mockRejectedValue(new ConflictError('/van/U.ics'))
		fetchTodo.mockResolvedValue(fresh('U', { categories: 'home,work', sort: 20 }))

		await store.makeProject('U').catch(() => {})

		expect(fetchTodo).toHaveBeenCalledWith('/van/U.ics')
		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(showError).not.toHaveBeenCalled()
		expect(store.tasksByUid.U.etag).toBe('"U-fresh"')
		expect(store.tasksByUid.U.categories).toEqual(['home', 'work'])
	})
})
