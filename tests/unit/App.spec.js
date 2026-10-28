import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})
