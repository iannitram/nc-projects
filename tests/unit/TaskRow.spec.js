import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TaskRow, { getTasksDeepLink } from '../../src/components/TaskRow.vue'

vi.mock('@nextcloud/router', async (importOriginal) => ({
	...(await importOriginal()),
	generateUrl: vi.fn((route) => `/${route}`),
}))

describe('TaskRow', () => {
	it('renders summary, due date, priority, and open in tasks link', () => {
		const node = {
			task: {
				uid: 't1',
				summary: 'Fix the engine',
				completed: false,
				due: '2030-03-04',
				priority: 1,
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
		expect(wrapper.find('.cc-task-row__due').text()).toBe('2030-03-04')
		expect(wrapper.find('.cc-task-row__priority').text()).toBe('P1')

		const openLink = wrapper.find('.cc-task-row__open-in-tasks')
		expect(openLink.exists()).toBe(true)
		expect(openLink.attributes('href')).toBe('/apps/tasks/calendars/personal-1/tasks/t1.ics')
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
