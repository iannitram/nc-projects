import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProjectCard from '../../src/components/ProjectCard.vue'

const AddTaskInputStub = {
	props: ['projectUid'],
	template: '<div class="cc-add-task-input" />',
}

describe('ProjectCard', () => {
	it('renders project summary and task tree', () => {
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
			global: { stubs: { AddTaskInput: AddTaskInputStub } },
		})

		expect(wrapper.find('.cc-project-card__title').text()).toBe('My Project')
		expect(wrapper.text()).toContain('Task 1')
		expect(wrapper.find('.cc-project-card__badge--blocked').exists()).toBe(false)
		expect(wrapper.find('.cc-project-card__badge--someday').exists()).toBe(false)
		expect(wrapper.classes()).not.toContain('cc-project-card--someday')
	})

	it('shows a red badge "blocked" after its title when categories include blocked', () => {
		const project = {
			task: {
				uid: 'p-blocked',
				summary: 'Blocked Project',
				categories: ['project', 'blocked'],
				url: '/p-blocked.ics',
				calendarUrl: '/personal/',
			},
			children: [],
			progress: { done: 0, total: 2 },
		}

		const wrapper = mount(ProjectCard, {
			props: { project },
			global: { stubs: { AddTaskInput: AddTaskInputStub } },
		})

		const badge = wrapper.find('.cc-project-card__badge--blocked')
		expect(badge.exists()).toBe(true)
		expect(badge.text()).toBe('blocked')
		expect(wrapper.find('.cc-project-card__badge--someday').exists()).toBe(false)
		expect(wrapper.classes()).not.toContain('cc-project-card--someday')
	})

	it('shows a grey badge "someday" and greys the card when categories include someday', () => {
		const project = {
			task: {
				uid: 'p-someday',
				summary: 'Someday Project',
				categories: ['project', 'someday'],
				url: '/p-someday.ics',
				calendarUrl: '/personal/',
			},
			children: [],
			progress: { done: 0, total: 1 },
		}

		const wrapper = mount(ProjectCard, {
			props: { project },
			global: { stubs: { AddTaskInput: AddTaskInputStub } },
		})

		const badge = wrapper.find('.cc-project-card__badge--someday')
		expect(badge.exists()).toBe(true)
		expect(badge.text()).toBe('someday')
		expect(wrapper.classes()).toContain('cc-project-card--someday')
		expect(wrapper.find('.cc-project-card__badge--blocked').exists()).toBe(false)
	})

	it('shows both badges and greys the card when categories include blocked and someday', () => {
		const project = {
			task: {
				uid: 'p-both',
				summary: 'Both Badges Project',
				categories: ['project', 'blocked', 'someday'],
				url: '/p-both.ics',
				calendarUrl: '/personal/',
			},
			children: [],
			progress: { done: 0, total: 0 },
		}

		const wrapper = mount(ProjectCard, {
			props: { project },
			global: { stubs: { AddTaskInput: AddTaskInputStub } },
		})

		expect(wrapper.find('.cc-project-card__badge--blocked').exists()).toBe(true)
		expect(wrapper.find('.cc-project-card__badge--someday').exists()).toBe(true)
		expect(wrapper.classes()).toContain('cc-project-card--someday')
	})
})
