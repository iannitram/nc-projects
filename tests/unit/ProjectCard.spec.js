import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import ProjectCard from '../../src/components/ProjectCard.vue'

describe('ProjectCard', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('renders project summary, progress bar and text, and task tree', () => {
		const project = {
			task: { uid: 'p1', summary: 'My Project', categories: ['project'], url: '/p1.ics', calendarUrl: '/personal/' },
			children: [
				{
					task: { uid: 't1', summary: 'Task 1', completed: false, url: '/t1.ics', calendarUrl: '/personal/' },
					children: [],
					deeper: 0,
				},
			],
			progress: { done: 4, total: 10 },
		}

		const wrapper = mount(ProjectCard, {
			props: { project },
		})

		expect(wrapper.find('.cc-project-card__title').text()).toBe('My Project')
		expect(wrapper.find('.cc-project-card__progress-text').text()).toBe('4/10')
		expect(wrapper.text()).toContain('Task 1')
	})

	it('shows blocked badge when project is blocked', () => {
		const project = {
			task: { uid: 'p2', summary: 'Blocked Project', categories: ['project', 'blocked'] },
			children: [],
			progress: { done: 0, total: 1 },
		}

		const wrapper = mount(ProjectCard, {
			props: { project },
		})

		expect(wrapper.find('.cc-badge--blocked').exists()).toBe(true)
		expect(wrapper.find('.cc-badge--blocked').text()).toBe('blocked')
	})

	it('toggles show-done and updates task visibility', async () => {
		const project = {
			task: { uid: 'p3', summary: 'Done Project', categories: ['project'] },
			children: [
				{
					task: { uid: 'open1', summary: 'Open Task', completed: false },
					children: [],
					deeper: 0,
				},
				{
					task: { uid: 'done1', summary: 'Done Task', completed: true },
					children: [],
					deeper: 0,
				},
			],
			progress: { done: 1, total: 2 },
		}

		const wrapper = mount(ProjectCard, {
			props: { project },
		})

		expect(wrapper.text()).toContain('Open Task')
		expect(wrapper.text()).not.toContain('Done Task')

		const toggleBtn = wrapper.find('.cc-project-card__show-done-toggle')
		await toggleBtn.trigger('click')

		expect(wrapper.text()).toContain('Open Task')
		expect(wrapper.text()).toContain('Done Task')
	})
})
