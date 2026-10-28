import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import TaskRow, { getTasksDeepLink } from '../../src/components/TaskRow.vue'
import { useProjectsStore } from '../../src/store/projects.js'

vi.mock('@nextcloud/router', async (importOriginal) => ({
	...(await importOriginal()),
	generateUrl: vi.fn((route) => `/${route}`),
}))

const TaskRowSource = readFileSync(resolve(process.cwd(), 'src/components/TaskRow.vue'), 'utf8')

describe('TaskRow', () => {
	it('checks off and reopens the task through the store', async () => {
		setActivePinia(createPinia())
		const store = useProjectsStore()
		const setCompleted = vi.spyOn(store, 'setCompleted').mockResolvedValue()
		const wrapper = mount(TaskRow, { props: { node: { task: { uid: 't1', completed: false } } } })
		await wrapper.findComponent({ name: 'NcCheckboxRadioSwitch' }).vm.$emit('update:modelValue', true)
		expect(setCompleted).toHaveBeenCalledWith('t1', true)
	})

	it.each([[1, 'high', 'error-text'], [5, 'medium', 'warning-text'], [9, 'low', 'primary-element']])(
		'marks priority %i as %s on the checkbox with the strong colour hook',
		(priority, level, variable) => {
			const wrapper = mount(TaskRow, { props: { node: { task: { uid: 't1', summary: 'A', priority } } } })
			const box = wrapper.find('.cc-task-row__checkbox')
			expect(box.classes()).toContain(`cc-task-row__checkbox--${level}`)
			expect(wrapper.classes()).toContain(`cc-task-row--priority-${level}`)
			// The ring is drawn on the SVG; the style must target it, with strong variables.
			const source = TaskRowSource
			expect(source).toContain(`.cc-task-row__checkbox--${level} {\n\t--cc-priority-color: var(--color-${variable});`)
			expect(source).toMatch(new RegExp(`checkbox--${level} :deep\\(\\.checkbox-content__icon:not\\(\\.checkbox-content__icon--checked\\) svg\\)`))
			expect(source).toContain('fill: var(--cc-priority-color)')
		},
	)

	it('names the checkbox after the task and its state', () => {
		const open = mount(TaskRow, { props: { node: { task: { uid: 't1', summary: 'Fix it', completed: false } } } })
		expect(open.find('[aria-label="Check off Fix it"]').exists()).toBe(true)
		const done = mount(TaskRow, { props: { node: { task: { uid: 't1', summary: 'Fix it', completed: true } } } })
		expect(done.find('[aria-label="Reopen Fix it"]').exists()).toBe(true)
	})

	it('renders the task summary', () => {
		const node = {
			task: {
				uid: 't1',
				summary: 'Fix the engine',
				completed: false,
				url: '/remote.php/dav/calendars/owner/list-a-1/t1.ics',
				calendarUrl: '/remote.php/dav/calendars/owner/list-a-1/',
			},
			children: [],
			deeper: 0,
		}

		const wrapper = mount(TaskRow, {
			props: { node },
		})

		expect(wrapper.find('.cc-task-row__title').text()).toBe('Fix the engine')
		expect(wrapper.find('.cc-task-row__due').exists()).toBe(false)
		expect(wrapper.find('input[type="date"]').exists()).toBe(false)
		expect(wrapper.find('.cc-task-row__priority').exists()).toBe(false)
		expect(wrapper.find('.cc-task-row__open-in-tasks').exists()).toBe(false)
	})

	it('shows an N more levels in Tasks link when node has deeper descendants', () => {
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
		expect(deeperLink.text()).toBe('2 more levels in Tasks')
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
