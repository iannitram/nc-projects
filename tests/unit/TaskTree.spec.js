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

	describe('show done toggle behavior', () => {
		const sampleNodes = [
			{
				task: { uid: 'open-1', summary: 'Open Task 1', completed: false },
				children: [
					{
						task: { uid: 'open-1-child', summary: 'Open Child', completed: false },
						children: [
							{
								task: { uid: 'closed-3', summary: 'Closed Level 3 Subtask', completed: true },
								children: [],
								deeper: 0,
							},
						],
						deeper: 0,
					},
					{
						task: { uid: 'cancelled-child', summary: 'Cancelled Child', status: 'CANCELLED' },
						children: [],
						deeper: 0,
					},
				],
				deeper: 0,
			},
			{
				task: { uid: 'closed-1', summary: 'Closed Task 1', completed: true },
				children: [],
				deeper: 0,
			},
			{
				task: { uid: 'cancelled-1', summary: 'Cancelled Task 1', status: 'CANCELLED' },
				children: [],
				deeper: 0,
			},
			{
				task: { uid: 'open-2', summary: 'Open Task 2', completed: false },
				children: [],
				deeper: 0,
			},
		]

		it('hides closed tasks (completed or cancelled) at every level by default (showDone=false)', () => {
			const wrapper = mount(TaskTree, {
				props: { nodes: sampleNodes },
			})

			// Level 1
			expect(wrapper.text()).toContain('Open Task 1')
			expect(wrapper.text()).toContain('Open Task 2')
			expect(wrapper.text()).not.toContain('Closed Task 1')
			expect(wrapper.text()).not.toContain('Cancelled Task 1')

			// Level 2
			expect(wrapper.text()).toContain('Open Child')
			expect(wrapper.text()).not.toContain('Cancelled Child')

			// Level 3
			expect(wrapper.text()).not.toContain('Closed Level 3 Subtask')
		})

		it('shows closed tasks at every level greyed (opacity 0.6) and in sort position when showDone=true', () => {
			const wrapper = mount(TaskTree, {
				props: {
					nodes: sampleNodes,
					showDone: true,
				},
			})

			// All tasks visible
			expect(wrapper.text()).toContain('Open Task 1')
			expect(wrapper.text()).toContain('Closed Task 1')
			expect(wrapper.text()).toContain('Cancelled Task 1')
			expect(wrapper.text()).toContain('Open Task 2')
			expect(wrapper.text()).toContain('Open Child')
			expect(wrapper.text()).toContain('Cancelled Child')
			expect(wrapper.text()).toContain('Closed Level 3 Subtask')

			// Verify sort position among level 1 items
			const level1Items = wrapper.findAll('.cc-task-tree--level-1 > .cc-task-tree__item')
			expect(level1Items).toHaveLength(4)
			expect(level1Items[0].text()).toContain('Open Task 1')
			expect(level1Items[1].text()).toContain('Closed Task 1')
			expect(level1Items[2].text()).toContain('Cancelled Task 1')
			expect(level1Items[3].text()).toContain('Open Task 2')

			// Check closed tasks have is-closed class and opacity 0.6
			expect(level1Items[1].classes()).toContain('is-closed')
			expect(level1Items[1].attributes('style')).toContain('opacity: 0.6')

			expect(level1Items[2].classes()).toContain('is-closed')
			expect(level1Items[2].attributes('style')).toContain('opacity: 0.6')

			// Open task does not have is-closed class or opacity style
			expect(level1Items[0].classes()).not.toContain('is-closed')
			expect(level1Items[0].attributes('style')).toBeUndefined()
		})

		it('does not show expand toggle for parent whose only subtasks are closed when showDone=false', () => {
			const nodes = [
				{
					task: { uid: 'parent-1', summary: 'Parent with closed children', completed: false },
					children: [
						{
							task: { uid: 'child-closed', summary: 'Child Closed', completed: true },
							children: [],
							deeper: 0,
						},
					],
					deeper: 0,
				},
			]

			const wrapperOff = mount(TaskTree, {
				props: { nodes, showDone: false },
			})
			expect(wrapperOff.find('.cc-task-tree__collapse-toggle').exists()).toBe(false)

			const wrapperOn = mount(TaskTree, {
				props: { nodes, showDone: true },
			})
			expect(wrapperOn.find('.cc-task-tree__collapse-toggle').exists()).toBe(true)
		})
	})
})
