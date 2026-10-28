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
import { Task } from '../../src/models/Task.js'
import { fetchTodo, fetchTodos, listTaskCalendars, putTodo } from '../../src/services/dav.js'
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

function taskUids(store, projectUid) {
	return store.areas[0].projects.find((node) => node.task.uid === projectUid).children.map((node) => node.task.uid)
}

describe('projects store moveToProject rollback after a landed write', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
		putTodo.mockImplementation(async (url) => ({ etag: `"${uidOfUrl(url)}-e2"` }))
	})

	function crowded() {
		return [
			stored('P', { categories: 'project', sort: 10 }),
			stored('t1', { parent: 'P', sort: 10, extra: ['X-CC-NOTE:keep'] }),
			stored('Q', { categories: 'project', sort: 20 }),
			stored('q1', { parent: 'Q', sort: 10 }),
			stored('q2', { parent: 'Q', sort: 11 }),
		]
	}

	it('undoes the moved task on the server and locally when a bumped sibling write fails afterwards', async () => {
		const store = await loadStore(crowded())
		putTodo.mockImplementation(async (url) => {
			if (url === '/list-b/q2.ics') {
				throw new Error('network down')
			}
			return { etag: `"${uidOfUrl(url)}-e2"` }
		})

		await store.moveToProject('t1', 'Q', 1)

		expect(showError).toHaveBeenCalledWith('Could not save the move')
		const puts = putTodo.mock.calls.map((call) => call[0])
		expect(puts).toEqual(['/list-b/t1.ics', '/list-b/q2.ics', '/list-b/t1.ics'])
		const undo = putTodo.mock.calls[2]
		expect(undo[2]).toBe('"t1-e2"')
		expect(sent(undo).parentUid).toBe('P')
		expect(sent(undo).sortOrder).toBe(10)
		expect(undo[1]).toContain('X-CC-NOTE:keep')
		expect(store.tasksByUid.t1.parentUid).toBe('P')
		expect(store.tasksByUid.t1.sortOrder).toBe(10)
		expect(store.tasksByUid.t1.etag).toBe('"t1-e2"')
		expect(store.tasksByUid.q2.sortOrder).toBe(11)
		expect(store.tasksByUid.q2.etag).toBe('"q2-e1"')
		expect(taskUids(store, 'P')).toEqual(['t1'])
		expect(taskUids(store, 'Q')).toEqual(['q1', 'q2'])
	})

	it('takes the server copy when the undo write fails too', async () => {
		const store = await loadStore(crowded())
		putTodo.mockImplementation(async (url) => {
			if (url === '/list-b/q2.ics' || putTodo.mock.calls.filter((call) => call[0] === url).length > 1) {
				throw new Error('network down')
			}
			return { etag: `"${uidOfUrl(url)}-e2"` }
		})
		fetchTodo.mockResolvedValue(fresh('t1', { parent: 'Q', sort: 11 }))

		await store.moveToProject('t1', 'Q', 1)

		expect(fetchTodo).toHaveBeenCalledWith('/list-b/t1.ics')
		expect(store.tasksByUid.t1.etag).toBe('"t1-fresh"')
		expect(showError).toHaveBeenCalledWith('Could not save the move')
	})
})
