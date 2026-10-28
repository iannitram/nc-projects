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

import { showError } from '@nextcloud/dialogs'
import { fetchTodos, listTaskCalendars, putTodo } from '../../src/services/dav.js'
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

const taskUids = (store) => store.areas[0].projects[0].children.map((node) => node.task.uid)

function spaced() {
	return [
		stored('P', { categories: 'project', sort: 10 }),
		stored('a', { parent: 'P', sort: 10 }),
		stored('b', { parent: 'P', sort: 20 }),
		stored('c', { parent: 'P', sort: 30 }),
	]
}

describe('projects store reorder (partial failure and optimistic tree)', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	it('keeps the landed task at its new sort order and new etag when a later write fails', async () => {
		const store = await loadStore([
			stored('P', { categories: 'project', sort: 10 }),
			stored('a', { parent: 'P', sort: 10 }),
			stored('b', { parent: 'P', sort: 11 }),
			stored('c', { parent: 'P', sort: 12 }),
		])
		putTodo
			.mockResolvedValueOnce({ etag: '"c-e2"' })
			.mockRejectedValueOnce(new Error('network down'))

		await store.reorder('P', 'Van', 'c', 1).catch(() => {})

		expect(putTodo).toHaveBeenCalledTimes(2)
		expect(showError).toHaveBeenCalledWith('Could not save the new order')
		expect(store.tasksByUid.c.sortOrder).toBe(11)
		expect(store.tasksByUid.c.etag).toBe('"c-e2"')
		expect(store.tasksByUid.b.sortOrder).toBe(11)
		expect(store.tasksByUid.b.etag).toBe('"b-e1"')
	})

	it('rebuilds the tree before the first put is awaited', async () => {
		const store = await loadStore(spaced())
		let resolvePut
		putTodo.mockImplementation(() => new Promise((resolve) => {
			resolvePut = resolve
		}))

		const pending = store.reorder('P', 'Van', 'c', 0)

		expect(taskUids(store)).toEqual(['c', 'a', 'b'])
		expect(store.tasksByUid.c.sortOrder).toBe(9)

		resolvePut({ etag: '"c-e2"' })
		await pending

		expect(taskUids(store)).toEqual(['c', 'a', 'b'])
	})
})
