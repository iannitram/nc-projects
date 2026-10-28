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
	getDavSession: vi.fn(() => ({})),
	ConflictError: class ConflictError extends Error {},
}))
vi.mock('@nextcloud/dialogs', () => ({
	showError: vi.fn(),
	showInfo: vi.fn(),
	showSuccess: vi.fn(),
}))

import { showInfo } from '@nextcloud/dialogs'
import TaskTree from '../../src/components/TaskTree.vue'
import { fetchTodos, listTaskCalendars, putTodo } from '../../src/services/dav.js'
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

/** Two ProjectCard-like lists fed by the store, as AreaSection/ProjectCard feed them. */
const Host = defineComponent({
	setup() {
		const store = useProjectsStore()
		return () => h('div', store.areas[0].projects.map((project) => h(TaskTree, {
			key: project.task.uid,
			nodes: project.children,
			areaName: store.areas[0].name,
			projectUid: project.task.uid,
		})))
	},
})

const rows = (list) => Array.from(list.children).map((li) => li.querySelector('.drag-handle').dataset.uid)

describe('TaskTree cross-list drop renders the move', () => {
	let store
	beforeEach(async () => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
		putTodo.mockImplementation(async (url) => ({ etag: `"${url}-e2"` }))
		listTaskCalendars.mockResolvedValue([{ url: '/list-b/', displayName: 'Garden', ownedByMe: true, writable: true, ctag: 'v1' }])
		fetchTodos.mockResolvedValue([
			stored('A', { categories: 'project', sort: 10 }),
			stored('a1', { parent: 'A', sort: 10 }),
			stored('a2', { parent: 'A', sort: 20 }),
			stored('B', { categories: 'project', sort: 20 }),
			stored('b1', { parent: 'B', sort: 10 }),
			stored('b2', { parent: 'B', sort: 20 }),
		])
		store = useProjectsStore()
		await store.load()
	})

	it('shows the moved task once in the target and no longer in the source, without a reload', async () => {
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

	it('shows one notice and writes nothing when a drag is released over a project on another list', async () => {
		const wrapper = mount(Host, { attachTo: document.body })
		const [listA, listB] = wrapper.findAll('ul.cc-task-tree--level-1').map((w) => w.element)
		const other = document.createElement('ul')
		other.dataset.areaName = 'Other area'
		document.body.appendChild(other)
		const original = document.elementFromPoint
		document.elementFromPoint = vi.fn(() => other)

		// Sortable refuses the cross-area drop: the end event has from === to, with the pointer over the other area
		const item = listA.children[0]
		wrapper.findAllComponents(TaskTree)[0].findComponent({ name: 'Sortable' }).vm.$emit('end', {
			from: listA,
			to: listA,
			item,
			oldIndex: 0,
			newIndex: 0,
			originalEvent: { clientX: 5, clientY: 5 },
		})
		await wrapper.vm.$nextTick()

		expect(showInfo).toHaveBeenCalledTimes(1)
		expect(putTodo).not.toHaveBeenCalled()
		expect(rows(listA)).toEqual(['a1', 'a2'])
		expect(rows(listB)).toEqual(['b1', 'b2'])

		document.elementFromPoint = original
		other.remove()
		wrapper.unmount()
	})
})
