import { emit } from '@nextcloud/event-bus'
import { NcAppNavigationItem } from '@nextcloud/vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppNav from '../../src/components/AppNav.vue'
import { useProjectsStore } from '../../src/store/projects.js'

const mobile = vi.hoisted(() => ({ value: true }))

vi.mock('@nextcloud/event-bus', async (importOriginal) => ({
	...(await importOriginal()),
	emit: vi.fn(),
}))

vi.mock('@nextcloud/vue', async (importOriginal) => ({
	...(await importOriginal()),
	useIsMobile: () => ({
		get value() {
			return mobile.value
		},
	}),
}))

describe('AppNav', () => {
	let pinia
	let store

	beforeEach(() => {
		pinia = createPinia()
		setActivePinia(pinia)
		store = useProjectsStore()
		emit.mockClear()
		mobile.value = true
	})

	it('renders one item per area with the right count and colour dot, and Needs filing shows orphans + untaggedParents', async () => {
		store.areas = [
			{
				name: 'Home',
				calendarUrl: '/home/',
				calendar: { url: '/home/', color: '#123456' },
				projects: [
					{ task: { uid: 'p1', summary: 'Project 1' }, children: [], progress: { done: 0, total: 1 } },
					{ task: { uid: 'p2', summary: 'Project 2' }, children: [], progress: { done: 0, total: 2 } },
				],
				done: [
					{ task: { uid: 'p-done', summary: 'Done Project' }, children: [], progress: { done: 1, total: 1 } },
				],
			},
			{
				name: 'Garden',
				calendarUrl: '/garden/',
				calendar: { url: '/garden/' },
				projects: [
					{ task: { uid: 'p3', summary: 'Project 3' }, children: [], progress: { done: 0, total: 1 } },
				],
				done: [],
			},
		]
		store.areaInputs = [
			{ name: 'Home', calendar: { url: '/home/', color: '#123456' } },
			{ name: 'Garden', calendar: { url: '/garden/' } },
		]
		store.orphans = [{ uid: 'o1', summary: 'Orphan 1' }, { uid: 'o2', summary: 'Orphan 2' }]
		store.untaggedParents = [{ uid: 'u1', summary: 'Untagged parent' }]

		const wrapper = mount(AppNav, {
			global: { plugins: [pinia] },
		})

		// Area items rendered
		expect(wrapper.text()).toContain('All areas')
		expect(wrapper.text()).toContain('Home')
		expect(wrapper.text()).toContain('Garden')
		expect(wrapper.text()).toContain('Needs filing')

		// Counters
		const bubbles = wrapper.findAll('.counter-bubble__counter')
		expect(bubbles.length).toBeGreaterThanOrEqual(3)

		// Home has 2 open projects
		const homeItem = wrapper.findAllComponents(NcAppNavigationItem).find((entry) => entry.props('name') === 'Home')
		expect(homeItem.find('.counter-bubble__counter').text()).toBe('2')

		// Verify Needs filing counter shows 3 (2 orphans + 1 untaggedParent)
		const needsFilingItem = wrapper.findAll('.app-navigation-entry').find((entry) => entry.text().includes('Needs filing'))
		expect(needsFilingItem).toBeDefined()
		expect(needsFilingItem.find('.counter-bubble__counter').text()).toBe('3')
		expect(needsFilingItem.find('.counter-bubble__counter--highlighted').exists()).toBe(true)

		// Home dot has colour #123456
		const dots = wrapper.findAll('.cc-app-nav__dot')
		expect(dots).toHaveLength(2)
		expect(dots[0].attributes('style')).toContain('#123456')
		// Garden dot falls back to Nextcloud theme variable
		expect(dots[1].attributes('style')).toContain('var(--color-primary-element)')
	})

	it('calls scrollIntoView on that area section when clicking an area item', async () => {
		store.areas = [
			{
				name: 'Home',
				calendarUrl: '/home/',
				projects: [],
				done: [],
			},
		]

		const sectionEl = document.createElement('section')
		sectionEl.id = 'area-home'
		const scrollSpy = vi.fn()
		sectionEl.scrollIntoView = scrollSpy
		document.body.appendChild(sectionEl)

		try {
			const wrapper = mount(AppNav, {
				global: { plugins: [pinia] },
			})

			const homeItem = wrapper.findAllComponents(NcAppNavigationItem).find((entry) => entry.props('name') === 'Home')
			expect(homeItem).toBeDefined()

			await homeItem.find('a.app-navigation-entry-link').trigger('click')
			await flushPromises()

			expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
		} finally {
			sectionEl.remove()
		}
	})

	it('scrolls each nav item to its own section when two areas normalise to the same slug', async () => {
		store.areas = [
			{ name: 'Home/Garden', calendarUrl: '/home-slash-garden/', projects: [], done: [] },
			{ name: 'Home & Garden', calendarUrl: '/home-and-garden/', projects: [], done: [] },
		]

		const section1 = document.createElement('section')
		section1.id = 'area-home-garden'
		const scrollSpy1 = vi.fn()
		section1.scrollIntoView = scrollSpy1
		document.body.appendChild(section1)

		const section2 = document.createElement('section')
		section2.id = 'area-home-garden-2'
		const scrollSpy2 = vi.fn()
		section2.scrollIntoView = scrollSpy2
		document.body.appendChild(section2)

		try {
			const wrapper = mount(AppNav, {
				global: { plugins: [pinia] },
			})

			const items = wrapper.findAllComponents(NcAppNavigationItem)
			const item1 = items.find((entry) => entry.props('name') === 'Home/Garden')
			const item2 = items.find((entry) => entry.props('name') === 'Home & Garden')

			expect(item1).toBeDefined()
			expect(item2).toBeDefined()

			await item1.find('a.app-navigation-entry-link').trigger('click')
			await flushPromises()
			expect(scrollSpy1).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
			expect(scrollSpy2).not.toHaveBeenCalled()

			await item2.find('a.app-navigation-entry-link').trigger('click')
			await flushPromises()
			expect(scrollSpy2).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
		} finally {
			section1.remove()
			section2.remove()
		}
	})

	it('closes the navigation drawer when an area is tapped at phone width', async () => {
		mobile.value = true
		store.areas = [{ name: 'Home', calendarUrl: '/home/', projects: [], done: [] }]

		const wrapper = mount(AppNav, {
			global: { plugins: [pinia] },
		})

		const homeItem = wrapper.findAllComponents(NcAppNavigationItem).find((entry) => entry.props('name') === 'Home')
		await homeItem.find('a.app-navigation-entry-link').trigger('click')

		expect(emit).toHaveBeenCalledWith('toggle-navigation', { open: false })
	})

	it('leaves the navigation drawer open when an area is tapped at desktop width', async () => {
		mobile.value = false
		store.areas = [{ name: 'Home', calendarUrl: '/home/', projects: [], done: [] }]

		const wrapper = mount(AppNav, {
			global: { plugins: [pinia] },
		})

		const homeItem = wrapper.findAllComponents(NcAppNavigationItem).find((entry) => entry.props('name') === 'Home')
		await homeItem.find('a.app-navigation-entry-link').trigger('click')

		expect(emit).not.toHaveBeenCalledWith('toggle-navigation', { open: false })
	})

	it('switches view to needs-filing on clicking Needs filing, and All areas switches back', async () => {
		const wrapper = mount(AppNav, {
			global: { plugins: [pinia] },
		})

		expect(store.view).toBe('areas')

		const needsFilingItem = wrapper.findAllComponents(NcAppNavigationItem).find((entry) => entry.props('name') === 'Needs filing')
		await needsFilingItem.find('a.app-navigation-entry-link').trigger('click')
		expect(store.view).toBe('needs-filing')

		const allAreasItem = wrapper.findAllComponents(NcAppNavigationItem).find((entry) => entry.props('name') === 'All areas')
		await allAreasItem.find('a.app-navigation-entry-link').trigger('click')
		expect(store.view).toBe('areas')
	})

	it('sets settingsOpen to true when clicking Choose areas in footer', async () => {
		const wrapper = mount(AppNav, {
			global: { plugins: [pinia] },
		})

		expect(store.settingsOpen).toBe(false)
		const chooseAreasBtn = wrapper.find('.cc-app-nav__choose-areas button, button.cc-app-nav__choose-areas')
		expect(chooseAreasBtn.exists()).toBe(true)

		await chooseAreasBtn.trigger('click')
		expect(store.settingsOpen).toBe(true)
	})
})
