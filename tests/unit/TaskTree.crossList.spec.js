import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

vi.mock('../../src/services/dav.js', () => ({
	listTaskCalendars: vi.fn(),
	fetchTodos: vi.fn(),
	fetchTodo: vi.fn(),
	createTodo: vi.fn(),
	putTodo: vi.fn(),
	moveTodo: vi.fn(),
	getDavSession: vi.fn(() => ({})),
	ConflictError: class ConflictError extends Error {},
}))
vi.mock('@nextcloud/dialogs', () => ({
	showError: vi.fn(),
	showInfo: vi.fn(),
	showSuccess: vi.fn(),
}))

import { NcDialog } from '@nextcloud/vue'
import TaskTree from '../../src/components/TaskTree.vue'
import { fetchTodos, listTaskCalendars, moveTodo, putTodo } from '../../src/services/dav.js'
import { useProjectsStore } from '../../src/store/projects.js'

function vtodo({ uid, categories, parent, sort }) {
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'BEGIN:VTODO',
		`UID:${uid}`,
		`SUMMARY:${uid}`,
		'STATUS:NEEDS-ACTION',
		'CREATED:20200101T000000Z',
		categories ? `CATEGORIES:${categories}` : null,
		parent ? `RELATED-TO:${parent}` : null,
		`X-APPLE-SORT-ORDER:${sort}`,
		'END:VTODO',
		'END:VCALENDAR',
		'',
	].filter((line) => line !== null).join('\r\n')
}

const stored = (uid, fields) => ({ url: `/list-b/${uid}.ics`, etag: `"${uid}-e1"`, calendarUrl: '/list-b/', ics: vtodo({ uid, ...fields }) })

/** ProjectCard-like lists fed by the store across all areas. */
const Host = defineComponent({
	setup() {
		const store = useProjectsStore()
		return () => h('div', store.areas.flatMap((area) => area.projects.map((project) => h(TaskTree, {
			key: project.task.uid,
			nodes: project.children,
			areaName: area.name,
			projectUid: project.task.uid,
			dialogContainer: null,
		}))))
	},
})

const rows = (list) => Array.from(list.children).map((li) => li.querySelector('.drag-handle')?.dataset.uid).filter(Boolean)

describe('TaskTree cross-list drop renders the move', () => {
	let store
	beforeEach(async () => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
		putTodo.mockImplementation(async (url) => ({ etag: `"${url}-e2"` }))
		moveTodo.mockImplementation(async (url, targetCalendar) => ({
			url: `${targetCalendar}${url.split('/').pop()}`,
			etag: '"moved-etag"',
			calendarUrl: targetCalendar,
			ics: vtodo({ uid: 'a1', parent: 'C', sort: 10 }),
		}))
		listTaskCalendars.mockResolvedValue([
			{ url: '/list-b/', displayName: 'Garden', ownedByMe: true, writable: true, ctag: 'v1' },
			{ url: '/list-c/', displayName: 'Work', ownedByMe: true, writable: true, ctag: 'v1' },
		])
		fetchTodos.mockImplementation(async (calendar) => {
			if (calendar.url === '/list-b/') {
				return [
					stored('A', { categories: 'project', sort: 10 }),
					stored('a1', { parent: 'A', sort: 10 }),
					stored('sub1', { parent: 'a1', sort: 10 }),
					stored('a2', { parent: 'A', sort: 20 }),
					stored('B', { categories: 'project', sort: 20 }),
					stored('b1', { parent: 'B', sort: 10 }),
					stored('b2', { parent: 'B', sort: 20 }),
				]
			}
			if (calendar.url === '/list-c/') {
				return [
					{ url: '/list-c/C.ics', etag: '"C-e1"', calendarUrl: '/list-c/', ics: vtodo({ uid: 'C', categories: 'project', sort: 10 }) },
					{ url: '/list-c/c1.ics', etag: '"c1-e1"', calendarUrl: '/list-c/', ics: vtodo({ uid: 'c1', parent: 'C', sort: 10 }) },
				]
			}
			return []
		})
		store = useProjectsStore()
		await store.load()
	})

	it('shows the moved task once in the target and no longer in the source, without a reload, on same-list drop', async () => {
		const wrapper = mount(Host, { attachTo: document.body })
		const [listA, listB] = wrapper.findAll('ul.cc-task-tree--level-1').map((w) => w.element)
		expect(rows(listA)).toEqual(['a1', 'a2'])
		expect(rows(listB)).toEqual(['b1', 'b2'])

		// What Sortable leaves behind: the item moved from A into B at newIndex 1
		const item = listA.children[0]
		listB.insertBefore(item, listB.children[1])
		wrapper.findAllComponents(TaskTree)[0].findComponent({ name: 'Sortable' }).vm.$emit('end', {
			from: listA,
			to: listB,
			item,
			oldIndex: 0,
			newIndex: 1,
		})
		await vi.waitFor(() => expect(putTodo).toHaveBeenCalledTimes(1))
		await wrapper.vm.$nextTick()
		await wrapper.vm.$nextTick()

		expect(rows(listA)).toEqual(['a2'])
		expect(rows(listB)).toEqual(['b1', 'a1', 'b2'])
		wrapper.unmount()
	})

	it('shows a confirmation dialog on cross-list drop and cancels cleanly when Cancel is clicked', async () => {
		const wrapper = mount(Host, { attachTo: document.body })
		const trees = wrapper.findAll('ul.cc-task-tree--level-1').map((w) => w.element)
		const listA = trees[0]
		const listC = trees[2]
		expect(rows(listA)).toEqual(['a1', 'a2'])
		expect(rows(listC)).toEqual(['c1'])

		const item = listA.children[0]
		listC.appendChild(item)

		wrapper.findAllComponents(TaskTree)[0].findComponent({ name: 'Sortable' }).vm.$emit('end', {
			from: listA,
			to: listC,
			item,
			oldIndex: 0,
			newIndex: 1,
		})
		await wrapper.vm.$nextTick()

		// Confirmation dialog appears with the consequence sentence (noting the 1 subtask)
		const dialog = wrapper.findComponent(NcDialog)
		expect(dialog.exists()).toBe(true)
		expect(dialog.props('message')).toBe("Moves under 'C' and to the Work list, with its 1 subtask.")

		// Neither moveTodo nor putTodo was called yet
		expect(moveTodo).not.toHaveBeenCalled()
		expect(putTodo).not.toHaveBeenCalled()

		// Click Cancel button
		const cancelButton = dialog.props('buttons').find((b) => b.label === 'Cancel')
		cancelButton.callback()
		await wrapper.vm.$nextTick()
		await wrapper.vm.$nextTick()

		// Dialog closes and task stays in listA
		expect(wrapper.findComponent(NcDialog).exists()).toBe(false)
		expect(moveTodo).not.toHaveBeenCalled()
		expect(rows(wrapper.findAll('ul.cc-task-tree--level-1')[0].element)).toEqual(['a1', 'a2'])
		wrapper.unmount()
	})

	it('shows a confirmation dialog on cross-list drop and executes moveToProject when Move is clicked', async () => {
		const wrapper = mount(Host, { attachTo: document.body })
		const trees = wrapper.findAll('ul.cc-task-tree--level-1').map((w) => w.element)
		const listA = trees[0]
		const listC = trees[2]

		const item = listA.children[0]
		listC.appendChild(item)

		wrapper.findAllComponents(TaskTree)[0].findComponent({ name: 'Sortable' }).vm.$emit('end', {
			from: listA,
			to: listC,
			item,
			oldIndex: 0,
			newIndex: 1,
		})
		await wrapper.vm.$nextTick()

		const dialog = wrapper.findComponent(NcDialog)
		expect(dialog.exists()).toBe(true)
		const moveButton = dialog.props('buttons').find((b) => b.label === 'Move')
		await moveButton.callback()
		await wrapper.vm.$nextTick()
		await wrapper.vm.$nextTick()

		// moveTodo called for both task and subtask
		expect(moveTodo).toHaveBeenCalled()
		expect(wrapper.findComponent(NcDialog).exists()).toBe(false)
		wrapper.unmount()
	})
})
