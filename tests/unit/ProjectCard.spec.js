import { NcCheckboxRadioSwitch, NcProgressBar } from '@nextcloud/vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectCard from '../../src/components/ProjectCard.vue'
import TaskTree from '../../src/components/TaskTree.vue'
import { useProjectsStore } from '../../src/store/projects.js'

const AddTaskInputStub = {
	props: ['projectUid'],
	template: '<div class="cc-add-task-input" />',
}

describe('ProjectCard', () => {
	it('checks off and reopens the project through the store', async () => {
		setActivePinia(createPinia())
		const store = useProjectsStore()
		const setCompleted = vi.spyOn(store, 'setCompleted').mockResolvedValue()
		const wrapper = mount(ProjectCard, {
			props: { project: { task: { uid: 'p1', completed: false }, children: [] } },
			global: { stubs: { AddTaskInput: AddTaskInputStub } },
		})
		const completion = wrapper.findComponent('.cc-project-card__completion')
		await completion.vm.$emit('update:modelValue', true)
		expect(setCompleted).toHaveBeenCalledWith('p1', true)
	})

	beforeEach(() => {
		window.localStorage.clear()
		vi.restoreAllMocks()
	})

	afterEach(() => {
		window.localStorage.clear()
		vi.restoreAllMocks()
	})

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

	describe('progress bar', () => {
		it('renders progress bar with rounded percentage and done/total text', () => {
			const project = {
				task: { uid: 'p1', summary: 'Project 1' },
				children: [],
				progress: { done: 3, total: 7 },
			}

			const wrapper = mount(ProjectCard, {
				props: { project },
				global: { stubs: { AddTaskInput: AddTaskInputStub } },
			})

			const progressBar = wrapper.findComponent(NcProgressBar)
			expect(progressBar.exists()).toBe(true)
			expect(progressBar.props('value')).toBe(43) // Math.round(100 * 3 / 7)
			expect(wrapper.find('.cc-project-card__progress-text').text()).toBe('3/7')
		})

		it('shows 0/0 and value 0 when total is 0', () => {
			const project = {
				task: { uid: 'p-empty', summary: 'Empty Project' },
				children: [],
				progress: { done: 0, total: 0 },
			}

			const wrapper = mount(ProjectCard, {
				props: { project },
				global: { stubs: { AddTaskInput: AddTaskInputStub } },
			})

			const progressBar = wrapper.findComponent(NcProgressBar)
			expect(progressBar.props('value')).toBe(0)
			expect(wrapper.find('.cc-project-card__progress-text').text()).toBe('0/0')
		})

		it('handles missing progress gracefully by displaying 0/0 and value 0', () => {
			const project = {
				task: { uid: 'p-none', summary: 'No Progress Project' },
				children: [],
			}

			const wrapper = mount(ProjectCard, {
				props: { project },
				global: { stubs: { AddTaskInput: AddTaskInputStub } },
			})

			const progressBar = wrapper.findComponent(NcProgressBar)
			expect(progressBar.props('value')).toBe(0)
			expect(wrapper.find('.cc-project-card__progress-text').text()).toBe('0/0')
		})
	})

	describe('show done toggle', () => {
		it('defaults to off and passes showDone=false to TaskTree', () => {
			const project = {
				task: { uid: 'p-toggle-1', summary: 'Toggle Project' },
				children: [],
				progress: { done: 1, total: 2 },
			}

			const wrapper = mount(ProjectCard, {
				props: { project },
				global: { stubs: { AddTaskInput: AddTaskInputStub } },
			})

			const toggle = wrapper.findComponent(NcCheckboxRadioSwitch)
			expect(toggle.exists()).toBe(true)
			expect(toggle.props('type')).toBe('switch')
			expect(toggle.props('modelValue')).toBe(false)

			const tree = wrapper.findComponent(TaskTree)
			expect(tree.props('showDone')).toBe(false)
		})

		it('reads initial on state from localStorage key cc_projects:showDone:<uid>', () => {
			window.localStorage.setItem('cc_projects:showDone:p-saved', '1')

			const project = {
				task: { uid: 'p-saved', summary: 'Saved Project' },
				children: [],
			}

			const wrapper = mount(ProjectCard, {
				props: { project },
				global: { stubs: { AddTaskInput: AddTaskInputStub } },
			})

			const toggle = wrapper.findComponent(NcCheckboxRadioSwitch)
			expect(toggle.props('modelValue')).toBe(true)

			const tree = wrapper.findComponent(TaskTree)
			expect(tree.props('showDone')).toBe(true)
		})

		it('writes "1" and "0" to localStorage on toggle and updates TaskTree', async () => {
			const task = { uid: 'p-write', summary: 'Write Project' }
			const project = { task, children: [] }

			const wrapper = mount(ProjectCard, {
				props: { project },
				global: { stubs: { AddTaskInput: AddTaskInputStub } },
			})

			const toggle = wrapper.findComponent(NcCheckboxRadioSwitch)
			expect(toggle.props('modelValue')).toBe(false)
			expect(window.localStorage.getItem('cc_projects:showDone:p-write')).toBeNull()

			// Turn on
			await toggle.vm.$emit('update:modelValue', true)
			await flushPromises()

			expect(window.localStorage.getItem('cc_projects:showDone:p-write')).toBe('1')
			expect(toggle.props('modelValue')).toBe(true)
			expect(wrapper.findComponent(TaskTree).props('showDone')).toBe(true)
			// Ensure it did not touch the task object
			expect(task.X_OC_HIDECOMPLETEDSUBTASKS).toBeUndefined()

			// Turn off
			await toggle.vm.$emit('update:modelValue', false)
			await flushPromises()

			expect(window.localStorage.getItem('cc_projects:showDone:p-write')).toBe('0')
			expect(toggle.props('modelValue')).toBe(false)
			expect(wrapper.findComponent(TaskTree).props('showDone')).toBe(false)
		})

		it('behaves as off when localStorage.getItem throws', () => {
			vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
				throw new Error('SecurityError: Access Denied')
			})

			const project = {
				task: { uid: 'p-err-read', summary: 'Read Error' },
				children: [],
			}

			const wrapper = mount(ProjectCard, {
				props: { project },
				global: { stubs: { AddTaskInput: AddTaskInputStub } },
			})

			const toggle = wrapper.findComponent(NcCheckboxRadioSwitch)
			expect(toggle.props('modelValue')).toBe(false)
			expect(wrapper.findComponent(TaskTree).props('showDone')).toBe(false)
		})

		it('behaves as off when localStorage.setItem throws', async () => {
			vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
				throw new Error('QuotaExceededError')
			})

			const project = {
				task: { uid: 'p-err-write', summary: 'Write Error' },
				children: [],
			}

			const wrapper = mount(ProjectCard, {
				props: { project },
				global: { stubs: { AddTaskInput: AddTaskInputStub } },
			})

			const toggle = wrapper.findComponent(NcCheckboxRadioSwitch)
			await toggle.vm.$emit('update:modelValue', true)
			await flushPromises()

			// Write failure keeps/resets it as off
			expect(toggle.props('modelValue')).toBe(false)
			expect(wrapper.findComponent(TaskTree).props('showDone')).toBe(false)
		})
	})
})
