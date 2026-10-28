import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddTaskInput from '../../src/components/AddTaskInput.vue'
import ProjectCard from '../../src/components/ProjectCard.vue'
import TaskTree from '../../src/components/TaskTree.vue'
import { readProjectCollapsed, useProjectsStore, writeProjectCollapsed } from '../../src/store/projects.js'

describe('projects collapse and ProjectCard integration', () => {
	let pinia
	let store

	beforeEach(() => {
		window.localStorage.clear()
		pinia = createPinia()
		setActivePinia(pinia)
		store = useProjectsStore()
	})

	afterEach(() => {
		window.localStorage.clear()
		vi.restoreAllMocks()
	})

	it('collapseAll() collapses every project, persists in localStorage, and expandAll() restores', () => {
		store.areas = [
			{
				name: 'Home',
				projects: [
					{ task: { uid: 'p1', summary: 'Project 1' }, children: [] },
					{ task: { uid: 'p2', summary: 'Project 2' }, children: [] },
				],
			},
			{
				name: 'Work',
				projects: [
					{ task: { uid: 'p3', summary: 'Project 3' }, children: [] },
				],
			},
		]

		expect(store.allCollapsed).toBe(false)
		expect(window.localStorage.getItem('cc_projects:collapsed:p1')).toBeNull()

		// Collapse all
		store.collapseAll()

		expect(store.allCollapsed).toBe(true)
		expect(store.collapsedProjects.has('p1')).toBe(true)
		expect(store.collapsedProjects.has('p2')).toBe(true)
		expect(store.collapsedProjects.has('p3')).toBe(true)

		// State persists in localStorage under cc_projects:collapsed:<uid> with '1'
		expect(window.localStorage.getItem('cc_projects:collapsed:p1')).toBe('1')
		expect(window.localStorage.getItem('cc_projects:collapsed:p2')).toBe('1')
		expect(window.localStorage.getItem('cc_projects:collapsed:p3')).toBe('1')

		// Expand all restores
		store.expandAll()

		expect(store.allCollapsed).toBe(false)
		expect(store.collapsedProjects.has('p1')).toBe(false)
		expect(store.collapsedProjects.has('p2')).toBe(false)
		expect(store.collapsedProjects.has('p3')).toBe(false)

		// Persists expanded state in localStorage
		expect(window.localStorage.getItem('cc_projects:collapsed:p1')).toBe('0')
		expect(window.localStorage.getItem('cc_projects:collapsed:p2')).toBe('0')
		expect(window.localStorage.getItem('cc_projects:collapsed:p3')).toBe('0')
	})

	it('toggleProjectCollapsed(uid) toggles a single project and persists in localStorage', () => {
		store.areas = [
			{
				name: 'Home',
				projects: [{ task: { uid: 'p1' }, children: [] }],
			},
		]

		store.toggleProjectCollapsed('p1')
		expect(store.collapsedProjects.has('p1')).toBe(true)
		expect(window.localStorage.getItem('cc_projects:collapsed:p1')).toBe('1')

		store.toggleProjectCollapsed('p1')
		expect(store.collapsedProjects.has('p1')).toBe(false)
		expect(window.localStorage.getItem('cc_projects:collapsed:p1')).toBe('0')
	})

	it('ProjectCard hides its TaskTree and AddTaskInput when collapsed, but keeps the header', async () => {
		const project = {
			task: { uid: 'p1', summary: 'Collapsible Project' },
			children: [
				{ task: { uid: 't1', summary: 'Task 1' }, children: [] },
			],
			progress: { done: 0, total: 1 },
		}

		store.areas = [
			{
				name: 'Home',
				projects: [project],
			},
		]

		const wrapper = mount(ProjectCard, {
			props: { project, areaName: 'Home' },
			global: { plugins: [pinia] },
		})

		// Initially expanded: header, TaskTree and AddTaskInput exist
		expect(wrapper.find('.cc-project-card__header').exists()).toBe(true)
		expect(wrapper.find('.cc-project-card__title').text()).toBe('Collapsible Project')
		expect(wrapper.findComponent(TaskTree).exists()).toBe(true)
		expect(wrapper.findComponent(AddTaskInput).exists()).toBe(true)

		// Collapse all: TaskTree and AddTaskInput hidden, header kept
		store.collapseAll()
		await wrapper.vm.$nextTick()

		expect(wrapper.find('.cc-project-card__header').exists()).toBe(true)
		expect(wrapper.find('.cc-project-card__title').text()).toBe('Collapsible Project')
		expect(wrapper.findComponent(TaskTree).exists()).toBe(false)
		expect(wrapper.findComponent(AddTaskInput).exists()).toBe(false)

		// Expand all: TaskTree and AddTaskInput restored
		store.expandAll()
		await wrapper.vm.$nextTick()

		expect(wrapper.findComponent(TaskTree).exists()).toBe(true)
		expect(wrapper.findComponent(AddTaskInput).exists()).toBe(true)
	})

	it('ProjectCard respects initial collapsed state from localStorage', () => {
		window.localStorage.setItem('cc_projects:collapsed:p-persisted', '1')

		const project = {
			task: { uid: 'p-persisted', summary: 'Persisted Collapsed Project' },
			children: [],
		}

		// Mount ProjectCard directly
		const wrapper = mount(ProjectCard, {
			props: { project, areaName: 'Home' },
			global: { plugins: [pinia] },
		})

		// Since localStorage has '1', TaskTree should be hidden
		expect(wrapper.find('.cc-project-card__header').exists()).toBe(true)
		expect(wrapper.findComponent(TaskTree).exists()).toBe(false)
	})

	it('wraps localStorage access in try/catch', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('Access denied')
		})
		expect(readProjectCollapsed('p1')).toBe(false)

		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('Quota exceeded')
		})
		expect(writeProjectCollapsed('p1', true)).toBe(false)
	})
})
