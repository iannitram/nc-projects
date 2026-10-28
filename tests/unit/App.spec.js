import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@nextcloud/dialogs', () => ({
	showError: vi.fn(),
	showInfo: vi.fn(),
	showSuccess: vi.fn(),
}))
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

import App from '../../src/App.vue'
import { useProjectsStore } from '../../src/store/projects.js'

describe('App', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('shows the Projects heading', () => {
		const wrapper = mount(App)
		expect(wrapper.find('h2').text()).toBe('Projects')
	})

	it('calls load() on mount and renders an AreaSection for each area', async () => {
		const pinia = createPinia()
		setActivePinia(pinia)
		const store = useProjectsStore()
		const loadSpy = vi.spyOn(store, 'load').mockResolvedValue()
		store.areas = [
			{ name: 'Home', calendarUrl: '/list-a/', projects: [], done: [] },
			{ name: 'Work', calendarUrl: '/work/', projects: [], done: [] },
		]

		const wrapper = mount(App, {
			global: { plugins: [pinia] },
		})

		expect(loadSpy).toHaveBeenCalled()
		expect(wrapper.text()).toContain('Home')
		expect(wrapper.text()).toContain('Work')
	})

	it('shows the empty state when no areas are selected', async () => {
		const pinia = createPinia()
		setActivePinia(pinia)
		const store = useProjectsStore()
		vi.spyOn(store, 'load').mockImplementation(async () => {
			store.areaLists = []
		})
		const wrapper = mount(App, { global: { plugins: [pinia] } })
		await wrapper.vm.$nextTick()
		expect(wrapper.text()).toContain('Choose your areas')
	})

	it('calls store.refresh() when window receives focus', async () => {
		vi.useFakeTimers()
		const pinia = createPinia()
		setActivePinia(pinia)
		const store = useProjectsStore()
		vi.spyOn(store, 'load').mockResolvedValue()
		const refreshSpy = vi.spyOn(store, 'refresh').mockResolvedValue()

		const wrapper = mount(App, {
			global: { plugins: [pinia] },
		})

		expect(refreshSpy).not.toHaveBeenCalled()
		window.dispatchEvent(new Event('focus'))
		expect(refreshSpy).toHaveBeenCalledTimes(1)

		window.dispatchEvent(new Event('focus'))
		expect(refreshSpy).toHaveBeenCalledTimes(2)

		wrapper.unmount()
		vi.useRealTimers()
	})

	it('calls store.refresh() every 2 minutes by default', async () => {
		vi.useFakeTimers()
		const pinia = createPinia()
		setActivePinia(pinia)
		const store = useProjectsStore()
		vi.spyOn(store, 'load').mockResolvedValue()
		const refreshSpy = vi.spyOn(store, 'refresh').mockResolvedValue()

		const wrapper = mount(App, {
			global: { plugins: [pinia] },
		})

		vi.advanceTimersByTime(119999)
		expect(refreshSpy).not.toHaveBeenCalled()

		vi.advanceTimersByTime(1)
		expect(refreshSpy).toHaveBeenCalledTimes(1)

		vi.advanceTimersByTime(120000)
		expect(refreshSpy).toHaveBeenCalledTimes(2)

		wrapper.unmount()
		vi.useRealTimers()
	})

	it('stops refresh triggers when App unmounts', async () => {
		vi.useFakeTimers()
		const pinia = createPinia()
		setActivePinia(pinia)
		const store = useProjectsStore()
		vi.spyOn(store, 'load').mockResolvedValue()
		const refreshSpy = vi.spyOn(store, 'refresh').mockResolvedValue()

		const wrapper = mount(App, {
			global: { plugins: [pinia] },
		})

		wrapper.unmount()
		window.dispatchEvent(new Event('focus'))
		vi.advanceTimersByTime(240000)

		expect(refreshSpy).not.toHaveBeenCalled()
		vi.useRealTimers()
	})

	it('keeps collapse state across a refresh in mounted App', async () => {
		const pinia = createPinia()
		setActivePinia(pinia)
		const store = useProjectsStore()
		vi.spyOn(store, 'load').mockResolvedValue()

		store.areas = [
			{
				name: 'Home',
				calendarUrl: '/home/',
				projects: [
					{
						task: { uid: 'p1', summary: 'Project One', categories: ['project'] },
						children: [
							{
								task: { uid: 't1', summary: 'Parent Task' },
								children: [
									{
										task: { uid: 't1-1', summary: 'Nested Subtask' },
										children: [],
										deeper: 0,
									},
								],
								deeper: 0,
							},
						],
					},
				],
				done: [],
			},
		]

		const wrapper = mount(App, {
			global: { plugins: [pinia] },
		})

		expect(wrapper.text()).toContain('Parent Task')
		expect(wrapper.text()).toContain('Nested Subtask')

		const toggle = wrapper.find('.cc-task-tree__collapse-toggle')
		expect(toggle.exists()).toBe(true)

		await toggle.trigger('click')
		expect(wrapper.text()).not.toContain('Nested Subtask')

		// Simulate refresh replacing tree node objects with new objects for the same task uid
		const collapseState = new Map()
		for (const area of store.areas) {
			for (const project of area.projects) {
				for (const child of project.children) {
					if (typeof child.collapsed === 'boolean') {
						collapseState.set(child.task.uid, child.collapsed)
					}
				}
			}
		}

		store.areas = [
			{
				name: 'Home',
				calendarUrl: '/home/',
				projects: [
					{
						task: { uid: 'p1', summary: 'Project One', categories: ['project'] },
						children: [
							{
								task: { uid: 't1', summary: 'Parent Task' },
								children: [
									{
										task: { uid: 't1-1', summary: 'Nested Subtask' },
										children: [],
										deeper: 0,
									},
								],
								deeper: 0,
								collapsed: collapseState.get('t1'),
							},
						],
					},
				],
				done: [],
			},
		]
		await wrapper.vm.$nextTick()

		// Nested subtask remains collapsed
		expect(wrapper.text()).not.toContain('Nested Subtask')

		// Click toggle again to expand
		const toggleAfterRefresh = wrapper.find('.cc-task-tree__collapse-toggle')
		await toggleAfterRefresh.trigger('click')
		expect(wrapper.text()).toContain('Nested Subtask')

		wrapper.unmount()
	})

	it('does not register an unhandledrejection listener on window', () => {
		const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
		const pinia = createPinia()
		setActivePinia(pinia)
		const store = useProjectsStore()
		vi.spyOn(store, 'load').mockResolvedValue()

		const wrapper = mount(App, {
			global: { plugins: [pinia] },
		})

		const registeredEvents = addEventListenerSpy.mock.calls.map(([event]) => event)
		expect(registeredEvents).not.toContain('unhandledrejection')

		wrapper.unmount()
		addEventListenerSpy.mockRestore()
	})
})
