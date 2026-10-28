import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NeedsFilingTray from '../../src/components/NeedsFilingTray.vue'
import { useProjectsStore } from '../../src/store/projects.js'

const ORPHANS = Object.freeze([
	Object.freeze({
		uid: 'o1',
		summary: 'Sand window frames',
		parentUid: 'p1',
		listName: 'Home',
		reason: "Parent 'Spring clean' is done",
	}),
	Object.freeze({
		uid: 'o2',
		summary: 'Draft episode outline',
		parentUid: 'missing',
		listName: 'Studio',
		reason: 'Parent no longer exists',
	}),
])

const PARENTS = Object.freeze([
	Object.freeze({
		uid: 'u1',
		summary: 'Website refresh',
		listName: 'Work',
		reason: '4 subtasks',
	}),
])

function setup(orphans, untaggedParents) {
	const store = useProjectsStore()
	store.makeProject = vi.fn().mockResolvedValue()
	store.areas = [
		{ name: 'Home', calendar: { color: '#3d8c40' } },
		{ name: 'Studio', calendar: { color: '#b4572f' } },
		{ name: 'Work', calendar: { color: '#2f6fb5' } },
	]
	const wrapper = mount(NeedsFilingTray, { props: { orphans, untaggedParents } })
	return { store, wrapper }
}

const titles = (wrapper) => wrapper.findAll('.cc-needs-filing-tray__group-title').map((node) => node.text())
const items = (wrapper) => wrapper.findAll('.cc-needs-filing-tray__item')

describe('NeedsFilingTray', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('renders page title and one-line intro', () => {
		const { wrapper } = setup(ORPHANS, PARENTS)

		expect(wrapper.find('.cc-needs-filing-tray__title').text()).toBe('Needs filing')
		expect(wrapper.find('.cc-needs-filing-tray__intro').text()).toBe("Tasks that aren't under a project yet. File each one so it shows up in its area.")
	})

	it('shows the empty state when both lists are empty with "Everything is filed"', () => {
		const { wrapper } = setup([], [])

		expect(wrapper.find('.cc-needs-filing-tray').exists()).toBe(true)
		expect(wrapper.findComponent({ name: 'NcEmptyContent' }).exists()).toBe(true)
		expect(wrapper.text()).toContain('Everything is filed')
		expect(items(wrapper)).toHaveLength(0)
	})

	it('shows both lists with their counts in group headings, orphans first', () => {
		const { wrapper } = setup(ORPHANS, PARENTS)

		expect(wrapper.find('.cc-needs-filing-tray').exists()).toBe(true)
		expect(titles(wrapper)).toEqual([
			expect.stringContaining('Orphan tasks (2)'),
			expect.stringContaining('Parents without a project tag (1)'),
		])
		expect(wrapper.text()).toContain('their parent is missing or done')
		expect(wrapper.text()).toContain("they have subtasks but aren't projects")
		expect(items(wrapper).map((node) => node.text())).toEqual([
			expect.stringContaining('Sand window frames'),
			expect.stringContaining('Draft episode outline'),
			expect.stringContaining('Website refresh'),
		])
	})

	it('shows only the list that has something in it', () => {
		const onlyParents = setup([], PARENTS)
		expect(titles(onlyParents.wrapper)).toEqual([
			expect.stringContaining('Parents without a project tag (1)'),
		])
		expect(items(onlyParents.wrapper)).toHaveLength(1)

		const onlyOrphans = setup(ORPHANS, [])
		expect(titles(onlyOrphans.wrapper)).toEqual([
			expect.stringContaining('Orphan tasks (2)'),
		])
		expect(items(onlyOrphans.wrapper)).toHaveLength(2)
	})

	it('displays the list colour dot and name for each item', () => {
		const { wrapper } = setup(ORPHANS, PARENTS)

		const chips = wrapper.findAll('.cc-needs-filing-tray__listchip')
		expect(chips).toHaveLength(3)
		expect(chips[0].text()).toContain('Home')
		expect(chips[1].text()).toContain('Studio')
		expect(chips[2].text()).toContain('Work')

		const swatches = wrapper.findAll('.cc-needs-filing-tray__swatch')
		expect(swatches).toHaveLength(3)
		expect(swatches[0].attributes('style')).toContain('background-color: rgb(61, 140, 64)')
	})

	it('displays reason text for each item', () => {
		const { wrapper } = setup(ORPHANS, PARENTS)

		expect(wrapper.text()).toContain("Parent 'Spring clean' is done")
		expect(wrapper.text()).toContain('Parent no longer exists')
		expect(wrapper.text()).toContain('4 subtasks')
	})

	it('gives every item a "Make project" button and a "Move to project…" button', async () => {
		const { store, wrapper } = setup(ORPHANS, PARENTS)

		const makeButtons = wrapper.findAll('.cc-needs-filing-tray__actions button').filter((b) => b.text().includes('Make project'))
		expect(makeButtons).toHaveLength(3)

		const moveButtons = wrapper.findAll('.cc-needs-filing-tray__actions button').filter((b) => b.text().includes('Move to project…'))
		expect(moveButtons).toHaveLength(3)

		await makeButtons[1].trigger('click')
		await makeButtons[2].trigger('click')
		expect(store.makeProject.mock.calls).toEqual([['o2'], ['u1']])

		await moveButtons[0].trigger('click')
		expect(wrapper.emitted('openMoveDialog')).toBeTruthy()
		expect(wrapper.emitted('openMoveDialog')[0]).toEqual([ORPHANS[0]])
	})

	it('swallows a failed makeProject (the store already showed the error)', async () => {
		const { store, wrapper } = setup(ORPHANS, PARENTS)
		store.makeProject.mockRejectedValue(new Error('offline'))

		const makeButtons = wrapper.findAll('.cc-needs-filing-tray__actions button').filter((b) => b.text().includes('Make project'))
		await makeButtons[0].trigger('click')
		await flushPromises()

		expect(store.makeProject).toHaveBeenCalledWith('o1')
		expect(items(wrapper)).toHaveLength(3)
	})

	it('leaves the list after an action when the store updates props', async () => {
		let currentOrphans = [...ORPHANS]
		let currentParents = [...PARENTS]

		const store = useProjectsStore()
		store.makeProject = vi.fn().mockImplementation(async (uid) => {
			currentOrphans = currentOrphans.filter((t) => t.uid !== uid)
			currentParents = currentParents.filter((t) => t.uid !== uid)
		})

		const wrapper = mount(NeedsFilingTray, {
			props: {
				orphans: currentOrphans,
				untaggedParents: currentParents,
			},
		})

		expect(items(wrapper)).toHaveLength(3)

		const makeButtons = wrapper.findAll('.cc-needs-filing-tray__actions button').filter((b) => b.text().includes('Make project'))
		await makeButtons[0].trigger('click')
		await flushPromises()

		await wrapper.setProps({
			orphans: currentOrphans,
			untaggedParents: currentParents,
		})

		expect(items(wrapper)).toHaveLength(2)
		expect(wrapper.text()).not.toContain('Sand window frames')
	})
})
