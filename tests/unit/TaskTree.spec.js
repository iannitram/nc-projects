import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TaskTree from '../../src/components/TaskTree.vue'

describe('TaskTree', () => {
	it('renders tasks and nested subtasks', () => {
		const nodes = [
			{
				task: { uid: 't1', summary: 'Level 1 Task', completed: false },
				children: [
					{
						task: { uid: 't1-1', summary: 'Level 2 Subtask', completed: false },
						children: [],
						deeper: 0,
					},
				],
				deeper: 0,
			},
		]

		const wrapper = mount(TaskTree, {
			props: { nodes },
		})

		expect(wrapper.text()).toContain('Level 1 Task')
		expect(wrapper.text()).toContain('Level 2 Subtask')
	})

	it('collapses subtasks when toggle button is clicked', async () => {
		const nodes = [
			{
				task: { uid: 't1', summary: 'Parent Task', completed: false },
				children: [
					{
						task: { uid: 't1-1', summary: 'Child Subtask', completed: false },
						children: [],
						deeper: 0,
					},
				],
				deeper: 0,
			},
		]

		const wrapper = mount(TaskTree, {
			props: { nodes },
		})

		expect(wrapper.text()).toContain('Child Subtask')

		const toggle = wrapper.find('.cc-task-tree__collapse-toggle')
		expect(toggle.exists()).toBe(true)

		await toggle.trigger('click')
		expect(wrapper.text()).not.toContain('Child Subtask')

		await toggle.trigger('click')
		expect(wrapper.text()).toContain('Child Subtask')
	})
})
