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
			{ name: 'Personal', calendarUrl: '/personal/', projects: [], done: [] },
			{ name: 'Work', calendarUrl: '/work/', projects: [], done: [] },
		]

		const wrapper = mount(App, {
			global: { plugins: [pinia] },
		})

		expect(loadSpy).toHaveBeenCalled()
		expect(wrapper.text()).toContain('Personal')
		expect(wrapper.text()).toContain('Work')
	})
})
