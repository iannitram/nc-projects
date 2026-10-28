import { mdiUnfoldLessHorizontal, mdiUnfoldMoreHorizontal } from '@mdi/js'
import { NcSelect, NcTextField } from '@nextcloud/vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TopBar from '../../src/components/TopBar.vue'
import { useProjectsStore } from '../../src/store/projects.js'

describe('TopBar', () => {
	let pinia
	let store

	beforeEach(() => {
		pinia = createPinia()
		setActivePinia(pinia)
		store = useProjectsStore()
	})

	it('renders the title, the project count and the two buttons with accessible names', () => {
		store.areas = [
			{
				name: 'Home',
				projects: [
					{ task: { uid: 'p1', summary: 'Project 1' } },
					{ task: { uid: 'p2', summary: 'Project 2' } },
				],
			},
			{
				name: 'Work',
				projects: [
					{ task: { uid: 'p3', summary: 'Project 3' } },
				],
			},
		]

		const wrapper = mount(TopBar, {
			global: { plugins: [pinia] },
		})

		// Title
		const title = wrapper.find('.cc-top-bar__title')
		expect(title.exists()).toBe(true)
		expect(title.text()).toBe('All areas')

		// Muted project count
		const meta = wrapper.find('.cc-top-bar__meta')
		expect(meta.exists()).toBe(true)
		expect(meta.text()).toBe('3 projects')

		// Collapse/Expand button with accessible name
		const collapseBtn = wrapper.find('.cc-top-bar__collapse-btn')
		expect(collapseBtn.exists()).toBe(true)
		expect(collapseBtn.attributes('aria-label')).toBe('Collapse all')

		// Primary "New project" button with accessible name
		const newProjectBtn = wrapper.find('.cc-top-bar__new-project-btn')
		expect(newProjectBtn.exists()).toBe(true)
		expect(newProjectBtn.attributes('aria-label')).toBe('New project')
		expect(newProjectBtn.text()).toContain('New project')
	})

	it('formats project count properly for 1 project and 0 projects', async () => {
		store.areas = [
			{
				name: 'Home',
				projects: [{ task: { uid: 'p1', summary: 'Project 1' } }],
			},
		]
		const wrapper = mount(TopBar, {
			global: { plugins: [pinia] },
		})
		expect(wrapper.find('.cc-top-bar__meta').text()).toBe('1 project')

		store.areas = []
		await wrapper.vm.$nextTick()
		expect(wrapper.find('.cc-top-bar__meta').text()).toBe('0 projects')
	})

	it('shows Collapse all when any project is expanded, else Expand all', async () => {
		store.areas = [
			{
				name: 'Home',
				projects: [
					{ task: { uid: 'p1', summary: 'Project 1' } },
					{ task: { uid: 'p2', summary: 'Project 2' } },
				],
			},
		]

		const wrapper = mount(TopBar, {
			global: { plugins: [pinia] },
		})

		// Initially all are expanded -> button is "Collapse all" with mdiUnfoldLessHorizontal
		const collapseBtn = wrapper.find('.cc-top-bar__collapse-btn')
		expect(collapseBtn.attributes('aria-label')).toBe('Collapse all')
		expect(wrapper.find('svg path').attributes('d')).toBe(mdiUnfoldLessHorizontal)

		// Collapse one project -> still "Collapse all" because p2 is expanded
		store.collapsedProjects = new Set(['p1'])
		await wrapper.vm.$nextTick()
		expect(collapseBtn.attributes('aria-label')).toBe('Collapse all')

		// Collapse all projects -> button becomes "Expand all" with mdiUnfoldMoreHorizontal
		store.collapsedProjects = new Set(['p1', 'p2'])
		await wrapper.vm.$nextTick()
		expect(collapseBtn.attributes('aria-label')).toBe('Expand all')
		expect(wrapper.find('svg path').attributes('d')).toBe(mdiUnfoldMoreHorizontal)
	})

	it('calls store.collapseAll() when clicking Collapse all and store.expandAll() when clicking Expand all', async () => {
		store.areas = [
			{
				name: 'Home',
				projects: [
					{ task: { uid: 'p1', summary: 'Project 1' } },
				],
			},
		]
		const collapseAllSpy = vi.spyOn(store, 'collapseAll')
		const expandAllSpy = vi.spyOn(store, 'expandAll')

		const wrapper = mount(TopBar, {
			global: { plugins: [pinia] },
		})

		// Any expanded -> click triggers collapseAll()
		await wrapper.find('.cc-top-bar__collapse-btn').trigger('click')
		expect(collapseAllSpy).toHaveBeenCalledTimes(1)

		// When all are collapsed -> click triggers expandAll()
		store.collapsedProjects = new Set(['p1'])
		await wrapper.vm.$nextTick()

		await wrapper.find('.cc-top-bar__collapse-btn').trigger('click')
		expect(expandAllSpy).toHaveBeenCalledTimes(1)
	})

	it('creates a project: pick an area, type a title, Enter calls createProject(area, title)', async () => {
		store.areas = [
			{ name: 'Home', projects: [] },
			{ name: 'Work', projects: [] },
		]
		const createSpy = vi.spyOn(store, 'createProject').mockResolvedValue()

		const wrapper = mount(TopBar, {
			global: { plugins: [pinia] },
		})

		// 1. Click New project
		await wrapper.find('.cc-top-bar__new-project-btn').trigger('click')

		// Area picker (NcSelect) appears
		const select = wrapper.findComponent(NcSelect)
		expect(select.exists()).toBe(true)

		// 2. Pick an area
		await select.vm.$emit('update:modelValue', 'Home')
		await wrapper.vm.$nextTick()

		// Title field appears
		const inputComp = wrapper.findComponent(NcTextField)
		expect(inputComp.exists()).toBe(true)

		// 3. Type a title
		const inputEl = inputComp.find('input')
		await inputEl.setValue('Build bookshelf')

		// 4. Enter calls createProject(area, title)
		await inputEl.trigger('keydown.enter')
		expect(createSpy).toHaveBeenCalledWith('Home', 'Build bookshelf')

		// Form resets and closes
		await wrapper.vm.$nextTick()
		expect(wrapper.findComponent(NcTextField).exists()).toBe(false)
		expect(wrapper.find('.cc-top-bar__new-project-btn').exists()).toBe(true)
	})

	it('cancels project creation with Escape key: creates nothing', async () => {
		store.areas = [{ name: 'Home', projects: [] }]
		const createSpy = vi.spyOn(store, 'createProject').mockResolvedValue()

		const wrapper = mount(TopBar, {
			global: { plugins: [pinia] },
		})

		// Click New project
		await wrapper.find('.cc-top-bar__new-project-btn').trigger('click')

		// Area picker appears
		expect(wrapper.findComponent(NcSelect).exists()).toBe(true)

		// Escape on area picker closes without creating
		await wrapper.findComponent(NcSelect).trigger('keydown', { key: 'Escape' })
		expect(wrapper.findComponent(NcSelect).exists()).toBe(false)
		expect(createSpy).not.toHaveBeenCalled()

		// Open again and pick area
		await wrapper.find('.cc-top-bar__new-project-btn').trigger('click')
		await wrapper.findComponent(NcSelect).vm.$emit('update:modelValue', 'Home')
		await wrapper.vm.$nextTick()

		// Escape on title field closes without creating
		const inputComp = wrapper.findComponent(NcTextField)
		await inputComp.find('input').setValue('Some title')
		await inputComp.find('input').trigger('keydown', { key: 'Escape' })

		expect(wrapper.findComponent(NcTextField).exists()).toBe(false)
		expect(createSpy).not.toHaveBeenCalled()
	})

	it('cancels project creation with Cancel button: creates nothing', async () => {
		store.areas = [{ name: 'Home', projects: [] }]
		const createSpy = vi.spyOn(store, 'createProject').mockResolvedValue()

		const wrapper = mount(TopBar, {
			global: { plugins: [pinia] },
		})

		await wrapper.find('.cc-top-bar__new-project-btn').trigger('click')
		const cancelBtn = wrapper.find('button[aria-label="Cancel"]')
		expect(cancelBtn.exists()).toBe(true)
		await cancelBtn.trigger('click')

		expect(wrapper.findComponent(NcSelect).exists()).toBe(false)
		expect(createSpy).not.toHaveBeenCalled()
	})

	it('keeps typed title open when createProject fails', async () => {
		store.areas = [{ name: 'Home', projects: [] }]
		vi.spyOn(store, 'createProject').mockRejectedValue(new Error('Network error'))

		const wrapper = mount(TopBar, {
			global: { plugins: [pinia] },
		})

		await wrapper.find('.cc-top-bar__new-project-btn').trigger('click')
		await wrapper.findComponent(NcSelect).vm.$emit('update:modelValue', 'Home')
		await wrapper.vm.$nextTick()

		const inputComp = wrapper.findComponent(NcTextField)
		await inputComp.find('input').setValue('Failing project')
		await inputComp.find('input').trigger('keydown.enter')

		// Keeps form open with the typed title
		expect(wrapper.findComponent(NcTextField).exists()).toBe(true)
		expect(inputComp.find('input').element.value).toBe('Failing project')
	})
})
