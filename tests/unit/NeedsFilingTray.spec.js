import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NeedsFilingTray from '../../src/components/NeedsFilingTray.vue'
import { useProjectsStore } from '../../src/store/projects.js'

const ORPHANS = Object.freeze([
	Object.freeze({ uid: 'o1', summary: 'Loose one' }),
	Object.freeze({ uid: 'o2', summary: 'Loose two' }),
])
const PARENTS = Object.freeze([Object.freeze({ uid: 'u1', summary: 'Untagged parent' })])

function setup(orphans, untaggedParents) {
	const store = useProjectsStore()
	store.makeProject = vi.fn().mockResolvedValue()
	const wrapper = mount(NeedsFilingTray, { props: { orphans, untaggedParents } })
	return { store, wrapper }
}

const titles = (wrapper) => wrapper.findAll('.cc-needs-filing-tray__title').map((node) => node.text())
const items = (wrapper) => wrapper.findAll('.cc-needs-filing-tray__item')

describe('NeedsFilingTray', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('renders nothing when both lists are empty', () => {
		const { wrapper } = setup([], [])

		expect(wrapper.find('.cc-needs-filing-tray').exists()).toBe(false)
	})

	it('shows both lists with their counts, orphans first', () => {
		const { wrapper } = setup(ORPHANS, PARENTS)

		expect(wrapper.find('.cc-needs-filing-tray').exists()).toBe(true)
		expect(titles(wrapper)).toEqual(['Orphan tasks (2)', 'Parents without a project tag (1)'])
		expect(items(wrapper).map((node) => node.text())).toEqual([
			expect.stringContaining('Loose one'),
			expect.stringContaining('Loose two'),
			expect.stringContaining('Untagged parent'),
		])
	})

	it('shows only the list that has something in it', () => {
		const onlyParents = setup([], PARENTS)
		expect(titles(onlyParents.wrapper)).toEqual(['Parents without a project tag (1)'])
		expect(items(onlyParents.wrapper)).toHaveLength(1)

		const onlyOrphans = setup(ORPHANS, [])
		expect(titles(onlyOrphans.wrapper)).toEqual(['Orphan tasks (2)'])
		expect(items(onlyOrphans.wrapper)).toHaveLength(2)
	})

	it('gives every item a "Make project" button that calls the store with that task\'s uid', async () => {
		const { store, wrapper } = setup(ORPHANS, PARENTS)

		const buttons = wrapper.findAll('.cc-needs-filing-tray__item button')
		expect(buttons.map((node) => node.text())).toEqual(['Make project', 'Make project', 'Make project'])
		await buttons[1].trigger('click')
		await buttons[2].trigger('click')

		expect(store.makeProject.mock.calls).toEqual([['o2'], ['u1']])
	})

	it('swallows a failed makeProject (the store already showed the error)', async () => {
		const { store, wrapper } = setup(ORPHANS, PARENTS)
		store.makeProject.mockRejectedValue(new Error('offline'))

		await wrapper.find('.cc-needs-filing-tray__item button').trigger('click')
		await flushPromises()

		expect(store.makeProject).toHaveBeenCalledWith('o1')
		expect(items(wrapper)).toHaveLength(3)
	})
})
