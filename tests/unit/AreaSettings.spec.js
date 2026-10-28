import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaSettings from '../../src/components/AreaSettings.vue'
import { useProjectsStore } from '../../src/store/projects.js'

vi.mock('../../src/services/dav.js', () => ({
	listTaskCalendars: vi.fn(),
}))

import { listTaskCalendars } from '../../src/services/dav.js'

/**
 * Text of the element that names an input through aria-labelledby.
 *
 * @param {import('@vue/test-utils').VueWrapper} wrapper The mounted wrapper
 * @param {import('@vue/test-utils').DOMWrapper} input The checkbox input
 * @return {string} The label text
 */
function accessibleName(wrapper, input) {
	const id = input.element.getAttribute('aria-labelledby')
	return wrapper.find(`[id="${id}"]`).text()
}

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
		// The accessible name comes from the component's label (aria-labelledby) that contains the area name
		expect(accessibleName(wrapper, inputs[0])).toContain('Home')
		expect(accessibleName(wrapper, inputs[1])).toContain('Work')
		expect(inputs[1].element.checked).toBe(false)

		// Clicking the name (not the input) toggles the checkbox
		await wrapper.findAll('.cc-area-settings__lbl')[1].trigger('click')
		await wrapper.vm.$nextTick()
		expect(inputs[1].element.checked).toBe(true)

		await wrapper.findAll('.cc-area-settings__lbl')[0].trigger('click')
		await wrapper.vm.$nextTick()
		expect(inputs[0].element.checked).toBe(false)
	})

	it('toggles exactly once per real mouse click on the name, swatch or box', async () => {
		store.settingsOpen = true
		store.availableLists = [
			{ url: '/home/', displayName: 'Home', color: '#3d8c40' },
			{ url: '/work/', displayName: 'Work', color: '#2f6fb5' },
		]
		store.areaLists = []
		listTaskCalendars.mockResolvedValue([])

		const wrapper = mount(AreaSettings, {
			props: { container: null },
			global: { plugins: [pinia] },
		})
		await wrapper.vm.$nextTick()

		const rows = wrapper.findAllComponents({ name: 'NcCheckboxRadioSwitch' })
		const inputs = wrapper.findAll('input[type="checkbox"]')
		const fullClick = (element) => {
			// A real click is mousedown, mouseup, then click; only the click should toggle.
			for (const type of ['mousedown', 'mouseup', 'click']) {
				element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }))
			}
		}
		const targets = [
			wrapper.findAll('.cc-area-settings__lbl')[1].element, // name
			wrapper.findAll('.cc-area-settings__swatch')[1].element, // swatch
			wrapper.findAll('.checkbox-radio-switch__icon')[1].element, // box
		]

		// Nothing wraps the row in a <label>: a label would forward the click to the input and toggle twice
		for (const target of targets) {
			expect(target.closest('label')).toBeNull()
		}
		const inputClicks = vi.fn()
		const inputChanges = vi.fn()
		inputs[1].element.addEventListener('click', inputClicks)
		inputs[1].element.addEventListener('change', inputChanges)

		for (const [index, target] of targets.entries()) {
			const before = inputs[1].element.checked
			const emittedBefore = rows[1].emitted('update:modelValue')?.length ?? 0
			fullClick(target)
			await wrapper.vm.$nextTick()
			expect(rows[1].emitted('update:modelValue')?.length ?? 0, `click ${index}`).toBe(emittedBefore + 1)
			expect(inputs[1].element.checked, `click ${index}`).toBe(!before)
		}
		expect(rows[1].emitted('update:modelValue').at(-1)[0]).toEqual(['/work/'])
		expect(inputs[1].element.checked).toBe(true)
		expect(inputs[0].element.checked).toBe(false)
		expect(inputClicks).not.toHaveBeenCalled()
		expect(inputChanges).not.toHaveBeenCalled()

		// The accessible name still carries the area name
		expect(accessibleName(wrapper, inputs[1])).toContain('Work')
	})
})
