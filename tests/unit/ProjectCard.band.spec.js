import { NcActionButton, NcActionLink, NcActions, NcDialog } from '@nextcloud/vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectCard from '../../src/components/ProjectCard.vue'
import TaskTree from '../../src/components/TaskTree.vue'
import { Task } from '../../src/models/Task.js'
import { useProjectsStore } from '../../src/store/projects.js'

enableAutoUnmount(afterEach)

function project() {
	return {
		task: { uid: 'p-band', summary: 'Garden shed', url: '/shed.ics', calendarUrl: '/home/' },
		children: [],
		progress: { done: 0, total: 0 },
	}
}
function render(value) {
	return mount(ProjectCard, {
		props: { project: value },
		global: { stubs: { AddTaskInput: true } },
	})
}

describe('project band', () => {
	beforeEach(() => {
		window.localStorage.clear()
		setActivePinia(createPinia())
	})

	afterEach(() => {
		window.localStorage.clear()
		vi.restoreAllMocks()
	})

	it('collapses from the named button and restores after a new store and mount', async () => {
		const wrapper = render(project())
		const button = wrapper.get('button[aria-label="Collapse Garden shed"]')
		expect(button.attributes('aria-expanded')).toBe('true')
		expect(wrapper.get('.cc-project-card__completion input').attributes('aria-label')).toBe('Check off Garden shed')
		expect(wrapper.get('button[aria-label="Actions for Garden shed"]').attributes('disabled')).toBeUndefined()
		expect(wrapper.get('.cc-project-card__header').classes()).toContain('drag-handle')
		await button.trigger('click')
		expect(wrapper.findComponent(TaskTree).exists()).toBe(false)
		expect(window.localStorage.getItem('cc_projects:collapsed:p-band')).toBe('1')
		wrapper.unmount()
		setActivePinia(createPinia())
		const reloaded = render(project())
		expect(reloaded.get('button[aria-label="Expand Garden shed"]').attributes('aria-expanded')).toBe('false')
		expect(reloaded.findComponent(TaskTree).exists()).toBe(false)
		await reloaded.get('button[aria-label="Expand Garden shed"]').trigger('click')
		expect(reloaded.findComponent(TaskTree).exists()).toBe(true)
		expect(window.localStorage.getItem('cc_projects:collapsed:p-band')).toBe('0')
	})

	it('uses every descendant for open count and earliest DUE, excluding closed tasks', async () => {
		const store = useProjectsStore()
		const setCompleted = vi.spyOn(store, 'setCompleted').mockResolvedValue()
		const value = project()
		const makeTask = (uid, parentUid, due, status = 'NEEDS-ACTION') => Task.fromIcs([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'BEGIN:VTODO',
			`UID:${uid}`,
			`RELATED-TO:${parentUid}`,
			`STATUS:${status}`,
			`DUE;VALUE=DATE:${due}`,
			...(status === 'COMPLETED' ? ['COMPLETED:20261001T120000Z'] : []),
			'END:VTODO',
			'END:VCALENDAR',
			'',
		].join('\r\n'))
		const tasks = [
			makeTask('a', 'p-band', '20261120'),
			makeTask('b', 'a', '20261119'),
			makeTask('c', 'b', '20261118'),
			makeTask('deep', 'c', '20261101'),
			makeTask('done', 'p-band', '20261001', 'COMPLETED'),
			makeTask('cancelled', 'p-band', '20261002', 'CANCELLED'),
			makeTask('unrelated', 'elsewhere', '20261003'),
		]
		store.tasksByUid = Object.fromEntries(tasks.map((task) => [task.uid, task]))
		const wrapper = render(value)
		expect(wrapper.find('time').exists()).toBe(false)
		await wrapper.get('button[aria-label="Collapse Garden shed"]').trigger('click')
		expect(wrapper.get('time').attributes('datetime').slice(0, 10)).toBe('2026-11-01')
		await wrapper.get('.cc-project-card__completion input').setValue(true)
		expect(wrapper.findComponent(NcDialog).props('message')).toBe('Check off Garden shed and its 4 open tasks?')
		expect(setCompleted).not.toHaveBeenCalled()
	})

	it.each([{ children: [] }, { children: [
		{ task: { uid: 'done', completed: true, due: '2026-11-01' }, children: [] },
		{ task: { uid: 'cancelled', status: 'CANCELLED', due: '2026-11-02' }, children: [] },
	] }])('checks off directly when there are no open tasks (%j)', async ({ children }) => {
		const store = useProjectsStore()
		const setCompleted = vi.spyOn(store, 'setCompleted').mockResolvedValue()
		const wrapper = render({ ...project(), children })
		await wrapper.get('button[aria-label="Collapse Garden shed"]').trigger('click')
		expect(wrapper.find('time').exists()).toBe(false)
		await wrapper.get('.cc-project-card__completion input').setValue(true)
		expect(wrapper.findComponent(NcDialog).exists()).toBe(false)
		expect(setCompleted).toHaveBeenCalledExactlyOnceWith('p-band', true)
		await wrapper.findComponent(NcActions).find('button').trigger('click')
		await vi.waitFor(() => expect(wrapper.findComponent(NcActionLink).exists()).toBe(true))
		expect(wrapper.findComponent(NcActionLink).props('href')).toContain('/calendars/home/tasks/shed.ics')
		await wrapper.findComponent(NcActionButton).find('button').trigger('click')
		expect(wrapper.findComponent(NcDialog).exists()).toBe(false)
		expect(setCompleted).toHaveBeenCalledTimes(2)
	})
})
