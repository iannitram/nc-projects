import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AreaSection from '../../src/components/AreaSection.vue'
import { useProjectsStore } from '../../src/store/projects.js'

describe('AreaSection', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('renders the area title and each project in area.projects in order', () => {
		const area = {
			name: 'Personal',
			calendarUrl: '/personal/',
			projects: [
				{
					task: { uid: 'p1', summary: 'Project 1', categories: ['project'], url: '/p1.ics', calendarUrl: '/personal/' },
					children: [],
					progress: { done: 1, total: 2 },
				},
				{
					task: { uid: 'p2', summary: 'Project 2', categories: ['project'], url: '/p2.ics', calendarUrl: '/personal/' },
					children: [],
					progress: { done: 0, total: 3 },
				},
			],
			done: [],
		}

		const wrapper = mount(AreaSection, {
			props: { area },
		})

		expect(wrapper.find('h3').text()).toBe('Personal')
		expect(wrapper.findAll('.cc-project-card')).toHaveLength(2)
		expect(wrapper.text()).toContain('Project 1')
		expect(wrapper.text()).toContain('Project 2')
	})

	describe('new project field', () => {
		const area = { name: 'Personal', calendarUrl: '/personal/', projects: [], done: [] }

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

			expect(store.createProject).toHaveBeenCalledWith('Personal', 'My project')
			expect(input.element.value).toBe('My project')
			expect(input.element.disabled).toBe(false)
		})

		it('clears the field after creation succeeds', async () => {
			const store = useProjectsStore()
			store.createProject = vi.fn().mockResolvedValue(undefined)
			const wrapper = mount(AreaSection, { props: { area } })

			const input = await typeAndSubmit(wrapper, 'My project')

			expect(store.createProject).toHaveBeenCalledWith('Personal', 'My project')
			expect(input.element.value).toBe('')
		})
	})
})
