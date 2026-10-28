import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaSettings from '../../src/components/AreaSettings.vue'
import { useProjectsStore } from '../../src/store/projects.js'

vi.mock('../../src/services/dav.js', () => ({
	listTaskCalendars: vi.fn(),
}))

import { listTaskCalendars } from '../../src/services/dav.js'

describe('AreaSettings', () => {
	let pinia
	let store

	beforeEach(() => {
		pinia = createPinia()
		setActivePinia(pinia)
		store = useProjectsStore()
		vi.clearAllMocks()
	})

	it('renders dialog with help sentence and candidate lists when open', async () => {
		store.settingsOpen = true
		store.availableLists = [
			{ url: '/home/', displayName: 'Home', color: '#3d8c40' },
			{ url: '/work/', displayName: 'Work', color: '#2f6fb5' },
		]
		store.areaLists = ['/home/']
		listTaskCalendars.mockResolvedValue([])

		const wrapper = mount(AreaSettings, {
			props: { container: null },
			global: { plugins: [pinia] },
		})
		await wrapper.vm.$nextTick()

		expect(wrapper.text()).toContain('Choose areas')
		expect(wrapper.text()).toContain('Each area you tick becomes a section of the panel. Untick one to hide it; nothing on the list changes.')
		expect(wrapper.text()).toContain('Home')
		expect(wrapper.text()).toContain('Work')
	})

	it('renders list colors for each candidate list', async () => {
		store.settingsOpen = true
		store.availableLists = [
			{ url: '/home/', displayName: 'Home', color: '#3d8c40' },
			{ url: '/work/', displayName: 'Work', color: '#2f6fb5' },
		]
		store.areaLists = ['/home/']
		listTaskCalendars.mockResolvedValue([])

		const wrapper = mount(AreaSettings, {
			props: { container: null },
			global: { plugins: [pinia] },
		})
		await wrapper.vm.$nextTick()

		const swatches = wrapper.findAll('.cc-area-settings__swatch')
		expect(swatches).toHaveLength(2)
		expect(swatches[0].attributes('style')).toContain('background-color: rgb(61, 140, 64)')
		expect(swatches[1].attributes('style')).toContain('background-color: rgb(47, 111, 181)')
	})

	it('renders open task count for already-loaded areas', async () => {
		store.settingsOpen = true
		store.availableLists = [
			{ url: '/home/', displayName: 'Home', color: '#3d8c40' },
			{ url: '/reading/', displayName: 'Reading', color: '#8a5fb0' },
		]
		store.areaLists = ['/home/']
		store.areas = [
			{
				name: 'Home',
				calendarUrl: '/home/',
				projects: [
					{ progress: { total: 30, done: 6 } },
				],
			},
		]
		listTaskCalendars.mockResolvedValue([])

		const wrapper = mount(AreaSettings, {
			props: { container: null },
			global: { plugins: [pinia] },
		})
		await wrapper.vm.$nextTick()

		expect(wrapper.text()).toContain('24 open tasks')
		// Reading is not loaded in store.areas, so it should not render a task count
		expect(wrapper.text()).not.toContain('0 open tasks')
	})

	it('renders excluded lists note with counts of shared lists, agent queues and Deck boards', async () => {
		store.settingsOpen = true
		store.availableLists = [
			{ url: '/home/', displayName: 'Home' },
		]
		listTaskCalendars.mockResolvedValue([
			{ url: '/home/', displayName: 'Home', ownedByMe: true },
			{ url: '/shared1/', displayName: 'Shared 1', ownedByMe: false },
			{ url: '/shared2/', displayName: 'Shared 2', ownedByMe: false },
			{ url: '/queue_shared_by_agent/', displayName: 'Queue', ownedByMe: true },
			{ url: '/app-generated--deck--board/', displayName: 'Deck', ownedByMe: true },
		])

		const wrapper = mount(AreaSettings, {
			props: { container: null },
			global: { plugins: [pinia] },
		})
		// Wait for fetchExcludedCounts
		await wrapper.vm.$nextTick()
		await wrapper.vm.$nextTick()

		const expectedNote = "Shared lists, agent queues and Deck boards can't be areas, so they aren't listed (2 shared lists, 1 agent queue, 1 Deck board)."
		expect(wrapper.find('.cc-area-settings__excluded').text()).toBe(expectedNote)
	})

	it('Cancel discards changes and closes the dialog', async () => {
		store.settingsOpen = true
		store.availableLists = [
			{ url: '/home/', displayName: 'Home' },
			{ url: '/work/', displayName: 'Work' },
		]
		store.areaLists = ['/home/']
		store.saveAreaLists = vi.fn()
		listTaskCalendars.mockResolvedValue([])

		const wrapper = mount(AreaSettings, {
			props: { container: null },
			global: { plugins: [pinia] },
		})
		await wrapper.vm.$nextTick()

		// Change selection
		wrapper.vm.selected = ['/home/', '/work/']

		// Click Cancel button
		const buttons = wrapper.findAll('button')
		const cancelButton = buttons.find((b) => b.text().includes('Cancel'))
		expect(cancelButton.exists()).toBe(true)
		await cancelButton.trigger('click')

		expect(store.saveAreaLists).not.toHaveBeenCalled()
		expect(store.settingsOpen).toBe(false)
		expect(wrapper.vm.selected).toEqual(['/home/'])
	})

	it('Save commits selected areas in candidateLists order and closes the dialog', async () => {
		store.settingsOpen = true
		store.availableLists = [
			{ url: '/home/', displayName: 'Home' },
			{ url: '/work/', displayName: 'Work' },
			{ url: '/studio/', displayName: 'Studio' },
		]
		store.areaLists = ['/home/']
		store.saveAreaLists = vi.fn()
		listTaskCalendars.mockResolvedValue([])

		const wrapper = mount(AreaSettings, {
			props: { container: null },
			global: { plugins: [pinia] },
		})
		await wrapper.vm.$nextTick()

		// Change selection to Work and Home (in different order)
		wrapper.vm.selected = ['/work/', '/home/']

		// Click Save button
		const buttons = wrapper.findAll('button')
		const saveButton = buttons.find((b) => b.text().includes('Save'))
		expect(saveButton.exists()).toBe(true)
		await saveButton.trigger('click')

		// Should preserve store.availableLists order: '/home/', then '/work/'
		expect(store.saveAreaLists).toHaveBeenCalledWith(['/home/', '/work/'])
	})

	it('names each checkbox after its area and toggles it from the name', async () => {
		store.settingsOpen = true
		store.availableLists = [
			{ url: '/home/', displayName: 'Home', color: '#3d8c40' },
			{ url: '/work/', displayName: 'Work', color: '#2f6fb5' },
		]
		store.areaLists = ['/home/']
		listTaskCalendars.mockResolvedValue([])

		const wrapper = mount(AreaSettings, {
			props: { container: null },
			global: { plugins: [pinia] },
		})
		await wrapper.vm.$nextTick()

		const inputs = wrapper.findAll('input[type="checkbox"]')
		expect(inputs).toHaveLength(2)
		// The accessible name comes from a label that contains the area name
		expect(inputs[0].element.labels).toHaveLength(1)
		expect(inputs[0].element.labels[0].textContent).toContain('Home')
		expect(inputs[1].element.labels[0].textContent).toContain('Work')
		expect(inputs[1].element.checked).toBe(false)

		// Clicking the name (not the input) toggles the checkbox
		await wrapper.findAll('.cc-area-settings__lbl')[1].trigger('click')
		await wrapper.vm.$nextTick()
		expect(inputs[1].element.checked).toBe(true)

		await wrapper.findAll('.cc-area-settings__lbl')[0].trigger('click')
		await wrapper.vm.$nextTick()
		expect(inputs[0].element.checked).toBe(false)
	})
})
