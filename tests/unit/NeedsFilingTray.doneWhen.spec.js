import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@nextcloud/dialogs', () => ({
	showError: vi.fn(),
	showInfo: vi.fn(),
	showSuccess: vi.fn(),
}))
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

import NeedsFilingTray from '../../src/components/NeedsFilingTray.vue'
import { Task } from '../../src/models/Task.js'
import { fetchTodos, listTaskCalendars, putTodo } from '../../src/services/dav.js'
import { getAreaLists } from '../../src/services/settings.js'
import { useProjectsStore } from '../../src/store/projects.js'

const CALENDAR = {
	url: '/list-a/',
	displayName: 'Home',
	ownedByMe: true,
	writable: true,
	ctag: 'c1',
	color: '#3d8c40',
}

function vtodo({ uid, summary, categories, parent, sort = 10, extra = [] }) {
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'BEGIN:VTODO',
		`UID:${uid}`,
		`SUMMARY:${summary || uid}`,
		'STATUS:NEEDS-ACTION',
		'CREATED:20260101T000000Z',
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
	return {
		url: `/list-a/${uid}.ics`,
		etag: `"${uid}-etag-1"`,
		calendarUrl: '/list-a/',
		ics: vtodo({ uid, ...fields }),
	}
}

describe('Needs filing tray #27 done-when', () => {
	let pinia

	beforeEach(() => {
		pinia = createPinia()
		setActivePinia(pinia)
		vi.clearAllMocks()
		getAreaLists.mockResolvedValue(['/list-a/'])
		putTodo.mockImplementation(async (url) => ({
			etag: `"${url.split('/').pop().replace('.ics', '')}-etag-2"`,
		}))
	})

	it('shows both lists from buildTree with counts in group headings', async () => {
		const rawTodos = [
			stored('proj1', { summary: 'Existing Project', categories: 'project' }),
			stored('p1-task', { summary: 'Project task', parent: 'proj1' }),
			stored('untagged1', {
				summary: 'Untagged Parent',
				categories: 'home',
				extra: ['X-CC-CUSTOM:preserve-me'],
			}),
			stored('u1-child', { summary: 'Subtask 1', parent: 'untagged1' }),
			stored('u2-child', { summary: 'Subtask 2', parent: 'untagged1' }),
			stored('orphan1', { summary: 'Orphan Task', parent: 'deleted-parent' }),
		]

		listTaskCalendars.mockResolvedValue([CALENDAR])
		fetchTodos.mockResolvedValue(rawTodos)

		const store = useProjectsStore()
		await store.load()

		expect(store.orphans).toHaveLength(1)
		expect(store.untaggedParents).toHaveLength(1)

		const wrapper = mount(NeedsFilingTray, {
			props: {
				orphans: store.orphans,
				untaggedParents: store.untaggedParents,
			},
			global: { plugins: [pinia] },
		})

		const titles = wrapper.findAll('.cc-needs-filing-tray__group-title').map((node) => node.text())
		expect(titles).toEqual([
			expect.stringContaining('Orphan tasks (1)'),
			expect.stringContaining('Parents without a project tag (1)'),
		])
		expect(wrapper.text()).toContain('their parent is missing or done')
		expect(wrapper.text()).toContain("they have subtasks but aren't projects")
	})

	it('makeProject adds ONLY the project category with If-Match (etag), promotes the item to a project, and updates the tray', async () => {
		const rawTodos = [
			stored('proj1', { summary: 'Existing Project', categories: 'project' }),
			stored('untagged1', {
				summary: 'Untagged Parent',
				categories: 'home',
				extra: ['X-CC-CUSTOM:preserve-me'],
			}),
			stored('u1-child', { summary: 'Subtask 1', parent: 'untagged1' }),
			stored('orphan1', { summary: 'Orphan Task', parent: 'deleted-parent' }),
		]

		listTaskCalendars.mockResolvedValue([CALENDAR])
		fetchTodos.mockResolvedValue(rawTodos)

		const store = useProjectsStore()
		await store.load()

		const wrapper = mount(NeedsFilingTray, {
			props: {
				orphans: store.orphans,
				untaggedParents: store.untaggedParents,
			},
			global: { plugins: [pinia] },
		})

		// Find the "Make project" button for the untagged parent
		const makeButtons = wrapper.findAll('.cc-needs-filing-tray__actions button').filter((b) => b.text().includes('Make project'))
		expect(makeButtons).toHaveLength(2)

		// Click "Make project" on the untagged parent (the second item)
		await makeButtons[1].trigger('click')
		await flushPromises()

		// 1. Verify putTodo called with If-Match (etag) and ONLY 'project' added to categories
		expect(putTodo).toHaveBeenCalledTimes(1)
		const [url, ics, etag] = putTodo.mock.calls[0]
		expect(url).toBe('/list-a/untagged1.ics')
		expect(etag).toBe('"untagged1-etag-1"') // If-Match check

		const sentTask = Task.fromIcs(ics, {})
		expect(sentTask.categories).toEqual(['home', 'project'])
		expect(ics).toContain('X-CC-CUSTOM:preserve-me')
		expect(ics).toContain('SUMMARY:Untagged Parent')

		// 2. Verify the task now appears as a project card in its area
		const homeArea = store.areas.find((a) => a.name === 'Home')
		expect(homeArea.projects.map((p) => p.task.uid)).toEqual(['proj1', 'untagged1'])
		expect(homeArea.projects[1].children.map((n) => n.task.uid)).toEqual(['u1-child'])

		// 3. Verify the item left the untaggedParents list
		expect(store.untaggedParents).toHaveLength(0)

		// Sync wrapper props to reflect store update
		await wrapper.setProps({
			orphans: store.orphans,
			untaggedParents: store.untaggedParents,
		})

		// Untagged parents group should now be gone from the tray
		expect(wrapper.text()).not.toContain('Parents without a project tag')
		expect(wrapper.text()).not.toContain('Untagged Parent')

		// Click "Make project" on the remaining orphan
		const remainingMakeBtn = wrapper.find('.cc-needs-filing-tray__actions button')
		await remainingMakeBtn.trigger('click')
		await flushPromises()

		expect(putTodo).toHaveBeenCalledTimes(2)
		const [orphanUrl, orphanIcs, orphanEtag] = putTodo.mock.calls[1]
		expect(orphanUrl).toBe('/list-a/orphan1.ics')
		expect(orphanEtag).toBe('"orphan1-etag-1"')
		expect(Task.fromIcs(orphanIcs, {}).categories).toEqual(['project'])

		// 4. Verify both lists are empty and tray shows empty state "Everything is filed"
		expect(store.orphans).toHaveLength(0)
		expect(store.untaggedParents).toHaveLength(0)

		await wrapper.setProps({
			orphans: store.orphans,
			untaggedParents: store.untaggedParents,
		})

		expect(wrapper.findComponent({ name: 'NcEmptyContent' }).exists()).toBe(true)
		expect(wrapper.text()).toContain('Everything is filed')
		expect(wrapper.text()).toContain('Every task sits under a project.')
	})
})
