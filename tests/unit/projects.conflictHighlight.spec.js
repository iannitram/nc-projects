import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { showInfo } from '@nextcloud/dialogs'
import ProjectCard from '../../src/components/ProjectCard.vue'
import TaskRow from '../../src/components/TaskRow.vue'
import { ConflictError, fetchTodo, fetchTodos, listTaskCalendars, putTodo } from '../../src/services/dav.js'
import { CONFLICT_HIGHLIGHT_MS, useProjectsStore } from '../../src/store/projects.js'

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

function todos() {
	return [
		stored('P', { categories: 'project', sort: 10 }),
		stored('t1', { parent: 'P', sort: 10, extra: ['PRIORITY:5'] }),
	]
}

describe('conflict highlight (#125)', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	it('marks the reloaded uid after a conflict, keeps the toast, and clears the mark after 4 s', async () => {
		const store = await loadStore(todos())
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
		putTodo.mockRejectedValue(new ConflictError('/list-b/t1.ics'))
		fetchTodo.mockResolvedValue({ ...stored('t1', { parent: 'P', sort: 10, extra: ['PRIORITY:1'] }), etag: '"t1-fresh"' })

		await store.updateTask('t1', { summary: 'New title' }).catch(() => {})

		expect(showInfo).toHaveBeenCalledWith('Someone else changed this; reloaded')
		expect(CONFLICT_HIGHLIGHT_MS).toBe(4000)
		expect(typeof store.conflictReloaded.t1).toBe('number')
		expect(store.conflictReloaded.P).toBeUndefined()

		vi.advanceTimersByTime(3999)
		expect(store.conflictReloaded.t1).toBeDefined()
		vi.advanceTimersByTime(1)
		expect(store.conflictReloaded.t1).toBeUndefined()
	})

	it('does not mark anything when the conflict reload fails', async () => {
		const store = await loadStore(todos())
		putTodo.mockRejectedValue(new ConflictError('/list-b/t1.ics'))
		fetchTodo.mockRejectedValue(new Error('reload failed'))

		await store.updateTask('t1', { summary: 'New title' }).catch(() => {})

		expect(store.conflictReloaded).toEqual({})
	})

	it('a second conflict on the same row restarts its 4 s', () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
		const store = useProjectsStore()
		store.markConflictReloaded(['t1'])
		vi.advanceTimersByTime(3000)
		store.markConflictReloaded(['t1'])
		vi.advanceTimersByTime(1000)
		expect(store.conflictReloaded.t1).toBeDefined()
		vi.advanceTimersByTime(3000)
		expect(store.conflictReloaded.t1).toBeUndefined()
	})

	it('tints a marked task row and project band', () => {
		const store = useProjectsStore()
		const row = mount(TaskRow, { props: { node: { task: { uid: 't1', summary: 'A' } } } })
		const band = mount(ProjectCard, { props: { project: { task: { uid: 'P', summary: 'Proj' }, children: [], progress: { done: 0, total: 0 } } } })
		expect(row.classes()).not.toContain('cc-conflict-reloaded')
		store.markConflictReloaded(['t1', 'P'])
		return Promise.resolve().then(() => {
			expect(row.classes()).toContain('cc-conflict-reloaded')
			expect(band.find('.cc-project-card__header').classes()).toContain('cc-conflict-reloaded')
		})
	})
})
