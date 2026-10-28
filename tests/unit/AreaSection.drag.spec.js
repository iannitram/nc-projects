import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Sortable } from 'sortablejs-vue3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaSection from '../../src/components/AreaSection.vue'
import { DRAG_OPTIONS } from '../../src/composables/useDrag.js'
import { useProjectsStore } from '../../src/store/projects.js'

const AddTaskInputStub = {
	props: ['projectUid'],
	template: '<div class="cc-add-task-input" />',
}

function projectNode(uid, summary, categories = ['project']) {
	return {
		task: {
			uid,
			summary,
			categories,
			url: `/${uid}.ics`,
			calendarUrl: '/area-1/',
		},
		children: [],
		progress: { done: 0, total: 1 },
	}
}

describe('AreaSection drag to reorder', () => {
	let store

	beforeEach(() => {
		setActivePinia(createPinia())
		store = useProjectsStore()
		store.reorder = vi.fn().mockResolvedValue(undefined)
	})

	it('renders a .drag-handle on each open card header', () => {
		const area = {
			name: 'Work',
			calendarUrl: '/area-1/',
			projects: [
				projectNode('p1', 'Project 1'),
				projectNode('p2', 'Project 2'),
			],
			done: [],
		}

		const wrapper = mount(AreaSection, {
			props: { area },
			global: { stubs: { AddTaskInput: AddTaskInputStub } },
		})

		const handles = wrapper.findAll('.cc-project-card__header.drag-handle')
		expect(handles).toHaveLength(2)
		expect(handles.map((h) => h.attributes('data-uid'))).toEqual(['p1', 'p2'])
	})

	it('renders open non-someday projects in a Sortable list with DRAG_OPTIONS and area group', () => {
		const area = {
			name: 'Work',
			calendarUrl: '/area-1/',
			projects: [
				projectNode('p1', 'Project 1'),
				projectNode('p2', 'Project 2'),
				projectNode('p-someday', 'Someday Project', ['project', 'someday']),
			],
			done: [],
		}

		const wrapper = mount(AreaSection, {
			props: { area },
			global: { stubs: { AddTaskInput: AddTaskInputStub } },
		})

		const sortable = wrapper.findComponent(Sortable)
		expect(sortable.exists()).toBe(true)
		expect(sortable.props('options')).toMatchObject({
			...DRAG_OPTIONS,
			group: { name: 'cc-projects-Work' },
		})
		expect(sortable.props('list').map((p) => p.task.uid)).toEqual(['p1', 'p2'])
		// Someday project is rendered outside the sortable list
		expect(wrapper.findAll('.cc-project-card')).toHaveLength(3)
		const sortableCards = sortable.findAll('.cc-project-card')
		expect(sortableCards).toHaveLength(2)
	})

	it('calls store.reorder(null, areaName, uid, index) on drop', async () => {
		const area = {
			name: 'Work',
			calendarUrl: '/area-1/',
			projects: [
				projectNode('p1', 'Project 1'),
				projectNode('p2', 'Project 2'),
				projectNode('p3', 'Project 3'),
			],
			done: [],
		}

		const wrapper = mount(AreaSection, {
			props: { area },
			global: { stubs: { AddTaskInput: AddTaskInputStub } },
		})

		const sortableEl = wrapper.find('.cc-area-section__sortable').element
		const item = sortableEl.children[0]

		wrapper.findComponent(Sortable).vm.$emit('end', {
			item,
			from: sortableEl,
			oldIndex: 0,
			newIndex: 2,
		})
		await wrapper.vm.$nextTick()

		expect(store.reorder).toHaveBeenCalledTimes(1)
		expect(store.reorder).toHaveBeenCalledWith(null, 'Work', 'p1', 2)
	})

	it('does not call store.reorder when drop keeps the same index', async () => {
		const area = {
			name: 'Work',
			calendarUrl: '/area-1/',
			projects: [
				projectNode('p1', 'Project 1'),
				projectNode('p2', 'Project 2'),
			],
			done: [],
		}

		const wrapper = mount(AreaSection, {
			props: { area },
			global: { stubs: { AddTaskInput: AddTaskInputStub } },
		})

		const sortableEl = wrapper.find('.cc-area-section__sortable').element
		wrapper.findComponent(Sortable).vm.$emit('end', {
			item: sortableEl.children[1],
			from: sortableEl,
			oldIndex: 1,
			newIndex: 1,
		})
		await wrapper.vm.$nextTick()

		expect(store.reorder).not.toHaveBeenCalled()
	})

	it('restores the dropped card to its original position before store update', () => {
		const area = {
			name: 'Work',
			calendarUrl: '/area-1/',
			projects: [
				projectNode('p1', 'Project 1'),
				projectNode('p2', 'Project 2'),
				projectNode('p3', 'Project 3'),
			],
			done: [],
		}

		const wrapper = mount(AreaSection, {
			props: { area },
			global: { stubs: { AddTaskInput: AddTaskInputStub } },
		})

		const sortableEl = wrapper.find('.cc-area-section__sortable').element
		// Simulate Sortable moving p1 to the end of the DOM
		sortableEl.appendChild(sortableEl.children[0])

		wrapper.findComponent(Sortable).vm.$emit('end', {
			item: sortableEl.children[2],
			from: sortableEl,
			oldIndex: 0,
			newIndex: 2,
		})

		const handles = wrapper.findAll('.cc-project-card__header.drag-handle')
		expect(handles.map((h) => h.attributes('data-uid'))).toEqual(['p1', 'p2', 'p3'])
	})
})
