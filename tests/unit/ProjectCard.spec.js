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
	})
})
