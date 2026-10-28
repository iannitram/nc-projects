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

import { showError } from '@nextcloud/dialogs'
import { createTodo, fetchTodos, listTaskCalendars } from '../../src/services/dav.js'
import { useProjectsStore } from '../../src/store/projects.js'

function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value)
		Object.values(value).forEach(deepFreeze)
	}
	return value
}

const PROJECT_A = { url: '/project-a/', displayName: 'Project A', ownedByMe: true, writable: true, ctag: 'v1' }

function vtodo({ uid, created, categories, parent, sort, status }) {
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'BEGIN:VTODO',
		`UID:${uid}`,
		`SUMMARY:${uid}`,
		`STATUS:${status ?? 'NEEDS-ACTION'}`,
		`CREATED:${created}`,
		categories ? `CATEGORIES:${categories}` : null,
		parent ? `RELATED-TO:${parent}` : null,
		sort !== undefined ? `X-APPLE-SORT-ORDER:${sort}` : null,
		'END:VTODO',
		'END:VCALENDAR',
		'',
	].filter((line) => line !== null).join('\r\n')
}

function stored(uid, fields) {
	return { url: `/project-a/${uid}.ics`, etag: `"${uid}-e1"`, calendarUrl: '/project-a/', ics: vtodo({ uid, ...fields }) }
}

async function loadStore(todos) {
	listTaskCalendars.mockResolvedValue(deepFreeze([{ ...PROJECT_A }]))
	fetchTodos.mockResolvedValue(deepFreeze(todos))
	const store = useProjectsStore()
	await store.load()
	return store
}

function todos() {
	return [
		stored('P', { created: '20200101T000000Z', categories: 'project' }),
		stored('t1', { created: '20200102T000000Z', parent: 'P' }),
		stored('t2', { created: '20200103T000000Z', parent: 'P' }),
	]
}

describe('projects store addTask failures', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
	})

	it('resolves to null and shows an error when the create fails', async () => {
		const store = await loadStore(todos())
		createTodo.mockRejectedValue(new Error('network down'))

		await expect(store.addTask('P', 'Buy paint')).resolves.toBeNull()

		expect(showError).toHaveBeenCalledWith('Could not add the task')
	})

	it('resolves to null, shows an error and does not create when the project is unknown', async () => {
		const store = await loadStore(todos())

		await expect(store.addTask('nope', 'Buy paint')).resolves.toBeNull()

		expect(showError).toHaveBeenCalledWith('Could not add the task: project not found')
		expect(createTodo).not.toHaveBeenCalled()
	})
})
