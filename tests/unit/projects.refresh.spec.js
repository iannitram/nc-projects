import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/dav.js', () => ({
	getDavSession: vi.fn(() => ({})),
	listTaskCalendars: vi.fn(),
	fetchTodos: vi.fn(),
	fetchTodo: vi.fn(),
	createTodo: vi.fn(),
	putTodo: vi.fn(),
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

import { fetchTodos, listTaskCalendars } from '../../src/services/dav.js'
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

const BARNUM = { url: '/barnum/', displayName: 'Barnum', ownedByMe: true, writable: true, ctag: 'b1' }

const barnumTodo = (uid, fields) => ({ ...stored(uid, fields), url: `/barnum/${uid}.ics`, calendarUrl: '/barnum/' })

function vanTodos() {
	return [
		stored('P', { categories: 'project', sort: 10 }),
		stored('t1', { parent: 'P', sort: 10 }),
		stored('t2', { parent: 'P', sort: 20 }),
	]
}

function barnumTodos() {
	return [
		barnumTodo('Q', { categories: 'project', sort: 10 }),
		barnumTodo('q1', { parent: 'Q', sort: 10 }),
	]
}

async function loaded() {
	const data = { '/van/': vanTodos(), '/barnum/': barnumTodos() }
	listTaskCalendars.mockResolvedValue(deepFreeze([{ ...VAN }, { ...BARNUM }]))
	fetchTodos.mockImplementation(async (calendar) => deepFreeze(data[calendar.url]))
	const store = useProjectsStore()
	await store.load()
	fetchTodos.mockClear()
	return store
}

const childNames = (store, areaIndex) => store.areas[areaIndex].projects[0].children.map((node) => node.task.summary)

describe('projects store refresh', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	it('re-reads no list when every ctag is unchanged', async () => {
		const store = await loaded()

		await store.refresh()

		expect(listTaskCalendars).toHaveBeenCalledTimes(2)
		expect(fetchTodos).not.toHaveBeenCalled()
		expect(childNames(store, 0)).toEqual(['t1', 't2'])
	})

	it('re-reads only the list whose ctag changed and leaves the other list as it was', async () => {
		const store = await loaded()
		listTaskCalendars.mockResolvedValue(deepFreeze([{ ...VAN, ctag: 'v2' }, { ...BARNUM }]))
		fetchTodos.mockResolvedValue(deepFreeze(vanTodos()))

		await store.refresh()

		expect(fetchTodos).toHaveBeenCalledTimes(1)
		expect(fetchTodos.mock.calls[0][0].url).toBe('/van/')
		expect(store.tasksByUid.q1.etag).toBe('"q1-e1"')
		expect(childNames(store, 1)).toEqual(['q1'])
	})

	it('refreshes a list after its calendar ctag changes', async () => {
		const store = await loaded()
		listTaskCalendars.mockResolvedValue(deepFreeze([{ ...VAN, ctag: 'v2' }, { ...BARNUM }]))
		fetchTodos.mockResolvedValue(deepFreeze(vanTodos()))

		await store.refresh()

		expect(listTaskCalendars).toHaveBeenCalledTimes(2)
		expect(fetchTodos).toHaveBeenCalledOnce()
		expect(fetchTodos.mock.calls[0][0].url).toBe('/van/')
	})

	it('shows what changed on that list: an edited task, a removed task, a new task', async () => {
		const store = await loaded()
		listTaskCalendars.mockResolvedValue(deepFreeze([{ ...VAN, ctag: 'v2' }, { ...BARNUM }]))
		fetchTodos.mockResolvedValue(deepFreeze([
			stored('P', { categories: 'project', sort: 10 }),
			{ ...stored('t1', { parent: 'P', sort: 10 }), etag: '"t1-e2"', ics: vtodo({ uid: 't1', parent: 'P', sort: 30 }) },
			stored('t3', { parent: 'P', sort: 20 }),
		]))

		await store.refresh()

		expect(store.tasksByUid.t1.etag).toBe('"t1-e2"')
		expect(store.tasksByUid.t1.sortOrder).toBe(30)
		expect(store.tasksByUid.t2).toBeUndefined()
		expect(store.tasksByUid.t3.etag).toBe('"t3-e1"')
		expect(childNames(store, 0)).toEqual(['t3', 't1'])
		expect(store.areas[0].projects[0].progress).toEqual({ done: 0, total: 2 })
	})

	it('remembers the new ctag, so the next refresh with the same ctag re-reads nothing', async () => {
		const store = await loaded()
		listTaskCalendars.mockResolvedValue(deepFreeze([{ ...VAN, ctag: 'v2' }, { ...BARNUM }]))
		fetchTodos.mockResolvedValue(deepFreeze(vanTodos()))

		await store.refresh()
		fetchTodos.mockClear()
		await store.refresh()

		expect(store.ctags['/van/']).toBe('v2')
		expect(store.ctags['/barnum/']).toBe('b1')
		expect(fetchTodos).not.toHaveBeenCalled()
	})

	it('keeps what is shown, sets no error and does not throw when the read fails', async () => {
		const store = await loaded()
		listTaskCalendars.mockRejectedValue(new Error('offline'))

		await store.refresh()

		expect(store.error).toBeNull()
		expect(childNames(store, 0)).toEqual(['t1', 't2'])
		expect(childNames(store, 1)).toEqual(['q1'])
	})
})
