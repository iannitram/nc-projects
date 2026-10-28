import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import TaskRow, { getTasksDeepLink } from '../../src/components/TaskRow.vue'
import { useProjectsStore } from '../../src/store/projects.js'

vi.mock('@nextcloud/router', async (importOriginal) => ({
	...(await importOriginal()),
	generateUrl: vi.fn((route) => `/${route}`),
}))

describe('TaskRow', () => {
	it('checks off and reopens the task through the store', async () => {
		setActivePinia(createPinia())
		const store = useProjectsStore()
		const setCompleted = vi.spyOn(store, 'setCompleted').mockResolvedValue()
		const wrapper = mount(TaskRow, { props: { node: { task: { uid: 't1', completed: false } } } })
		await wrapper.findComponent({ name: 'NcCheckboxRadioSwitch' }).vm.$emit('update:modelValue', true)
		expect(setCompleted).toHaveBeenCalledWith('t1', true)
	})

	it('renders the task summary', () => {
		const node = {
			task: {
				uid: 't1',
				summary: 'Fix the engine',
				completed: false,
				url: '/remote.php/dav/calendars/owner/personal-1/t1.ics',
				calendarUrl: '/remote.php/dav/calendars/owner/personal-1/',
			},
			children: [],
			deeper: 0,
		}

		const wrapper = mount(TaskRow, {
			props: { node },
		})

		expect(wrapper.find('.cc-task-row__title').text()).toBe('Fix the engine')
		expect(wrapper.find('.cc-task-row__due').exists()).toBe(false)
		expect(wrapper.find('.cc-task-row__priority').exists()).toBe(false)
		expect(wrapper.find('.cc-task-row__open-in-tasks').exists()).toBe(false)
	})

	it('shows +N deeper link when node has deeper descendants', () => {
		const node = {
			task: {
				uid: 'level3-task',
				summary: 'Level 3 task',
				completed: false,
				url: '/remote.php/dav/calendars/owner/work/level3.ics',
				calendarUrl: '/remote.php/dav/calendars/owner/work/',
			},
			children: [],
			deeper: 2,
		}

		const wrapper = mount(TaskRow, {
			props: { node },
		})

		const deeperLink = wrapper.find('.cc-task-deeper')
		expect(deeperLink.exists()).toBe(true)
		expect(deeperLink.text()).toBe('+2 deeper')
		expect(deeperLink.attributes('href')).toBe('/apps/tasks/calendars/work/tasks/level3.ics')
	})

	it('formats deep links correctly without calendar', () => {
		const task = {
			uid: 'orphan-task',
			url: '/orphan.ics',
		}
		expect(getTasksDeepLink(task)).toBe('/apps/tasks/collections/all/tasks/orphan.ics')
	})
})
