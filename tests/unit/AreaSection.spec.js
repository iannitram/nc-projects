import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaSection from '../../src/components/AreaSection.vue'
import DoneStrip from '../../src/components/DoneStrip.vue'
import ProjectCard from '../../src/components/ProjectCard.vue'
import { useProjectsStore } from '../../src/store/projects.js'

const AddTaskInputStub = {
	props: ['projectUid'],
	template: '<div class="cc-add-task-input" />',
}

describe('AreaSection', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('renders the area title and each project in area.projects in order', () => {
		const area = {
			name: 'Home',
			calendarUrl: '/list-a/',
			projects: [
				{
					task: { uid: 'p1', summary: 'Project 1', categories: ['project'], url: '/p1.ics', calendarUrl: '/list-a/' },
					children: [],
					progress: { done: 1, total: 2 },
				},
				{
					task: { uid: 'p2', summary: 'Project 2', categories: ['project'], url: '/p2.ics', calendarUrl: '/list-a/' },
					children: [],
					progress: { done: 0, total: 3 },
				},
			],
			done: [],
		}

		const wrapper = mount(AreaSection, {
			props: { area },
			global: { stubs: { AddTaskInput: AddTaskInputStub } },
		})

		expect(wrapper.find('h3').text()).toBe('Home')
		expect(wrapper.find('section').attributes('id')).toBe('area-home')
		expect(wrapper.findAll('.cc-project-card')).toHaveLength(2)
		expect(wrapper.text()).toContain('Project 1')
		expect(wrapper.text()).toContain('Project 2')
	})

	it('renders its ProjectCards then the DoneStrip', () => {
		const area = {
			name: 'Home',
			calendarUrl: '/list-a/',
			projects: [
				{
					task: { uid: 'p1', summary: 'Active Project', categories: ['project'], url: '/p1.ics', calendarUrl: '/list-a/' },
					children: [],
					progress: { done: 0, total: 1 },
				},
			],
			done: [
				{
					task: { uid: 'p-done', summary: 'Completed Project', categories: ['project'], url: '/p-done.ics', calendarUrl: '/list-a/' },
					children: [],
					progress: { done: 1, total: 1 },
				},
			],
		}

		const wrapper = mount(AreaSection, {
			props: { area },
			global: { stubs: { AddTaskInput: AddTaskInputStub } },
		})

		const projectCards = wrapper.findAllComponents(ProjectCard)
		expect(projectCards).toHaveLength(1)
		expect(projectCards[0].text()).toContain('Active Project')

		const doneStrip = wrapper.findComponent(DoneStrip)
		expect(doneStrip.exists()).toBe(true)
		expect(doneStrip.text()).toContain('Done (1)')

		// Verify DOM order: ProjectCards container is before DoneStrip
		const projectsEl = wrapper.find('.cc-area-section__projects').element
		const doneStripEl = doneStrip.element
		expect(projectsEl.compareDocumentPosition(doneStripEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
	})

	it('renders empty area state with one line, new project button, and DoneStrip', () => {
		const area = {
			name: 'Studio',
			calendarUrl: '/studio/',
			projects: [],
			done: [
				{
					task: { uid: 'p-done', summary: 'Done Project', categories: ['project'] },
					children: [],
					progress: { done: 1, total: 1 },
				},
			],
		}

		const wrapper = mount(AreaSection, {
			props: { area },
		})

		expect(wrapper.find('h3').text()).toBe('Studio')
		expect(wrapper.find('.cc-area-section__meta').text()).toBe('no open projects')
		expect(wrapper.text()).toContain('Nothing open in Studio. Start a project, or tag an existing task as a project in Tasks.')
		const newBtn = wrapper.find('.cc-area-section__empty-new-btn')
		expect(newBtn.exists()).toBe(true)
		expect(newBtn.text()).toContain('New project in Studio')
		const doneStrip = wrapper.findComponent(DoneStrip)
		expect(doneStrip.exists()).toBe(true)
		expect(doneStrip.text()).toContain('Done (1)')
	})

	it('renders skeleton rows under the area heading when loading is true', () => {
		const area = {
			name: 'Studio',
			calendarUrl: '/studio/',
			projects: [],
			done: [],
		}

		const wrapper = mount(AreaSection, {
			props: { area, loading: true },
		})

		expect(wrapper.find('h3').text()).toBe('Studio')
		const skeletons = wrapper.findAll('.cc-skeleton-row')
		expect(skeletons).toHaveLength(3)
		expect(wrapper.find('.cc-area-section__empty').exists()).toBe(false)
	})

	it('focuses the new project input when the empty new project button is clicked', async () => {
		const area = {
			name: 'Studio',
			calendarUrl: '/studio/',
			projects: [],
			done: [],
		}

		const wrapper = mount(AreaSection, {
			props: { area },
			attachTo: document.body,
		})

		const newBtn = wrapper.find('.cc-area-section__empty-new-btn')
		const input = wrapper.find('input')
		const focusSpy = vi.spyOn(input.element, 'focus')

		await newBtn.trigger('click')
		expect(focusSpy).toHaveBeenCalled()

		wrapper.unmount()
	})

	describe('new project field', () => {
		const area = { name: 'Home', calendarUrl: '/list-a/', projects: [], done: [] }

		async function typeAndSubmit(wrapper, value) {
			const input = wrapper.find('input')
			await input.setValue(value)
			await input.trigger('keydown.enter')
			await flushPromises()
			return input
		}

		it('keeps the typed title and swallows the rejection when creation fails', async () => {
			const store = useProjectsStore()
			store.createProject = vi.fn().mockRejectedValue(new Error('offline'))
			const wrapper = mount(AreaSection, { props: { area } })

			const input = await typeAndSubmit(wrapper, 'My project')

			expect(store.createProject).toHaveBeenCalledWith('Home', 'My project')
			expect(input.element.value).toBe('My project')
			expect(input.element.disabled).toBe(false)
		})

		it('clears the field after creation succeeds', async () => {
			const store = useProjectsStore()
			store.createProject = vi.fn().mockResolvedValue(undefined)
			const wrapper = mount(AreaSection, { props: { area } })

			const input = await typeAndSubmit(wrapper, 'My project')

			expect(store.createProject).toHaveBeenCalledWith('Home', 'My project')
			expect(input.element.value).toBe('')
		})
	})
})
