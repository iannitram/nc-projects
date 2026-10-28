import { NcCheckboxRadioSwitch, NcDialog } from '@nextcloud/vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import ProjectCard from '../../src/components/ProjectCard.vue'
import { Task } from '../../src/models/Task.js'
import { putTodo } from '../../src/services/dav.js'
import { useProjectsStore } from '../../src/store/projects.js'

vi.mock('../../src/services/dav.js', () => ({
	listTaskCalendars: vi.fn(),
	fetchTodos: vi.fn(),
	fetchTodo: vi.fn(),
	createTodo: vi.fn(),
	putTodo: vi.fn(),
	getDavSession: vi.fn(() => ({})),
	ConflictError: class ConflictError extends Error {},
}))

function task(uid, fields) {
	const ics = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'BEGIN:VTODO',
		`UID:${uid}`,
		`SUMMARY:${uid}`,
		'STATUS:NEEDS-ACTION',
		'DTSTAMP:20260101T000000Z',
		...fields,
		'END:VTODO',
		'END:VCALENDAR',
		'',
	].join('\r\n')
	return Task.fromIcs(ics, { url: `/list-a/${uid}.ics`, etag: '"e1"', calendarUrl: '/list-a/' })
}

// Follow rebuilt nodes as the panel does, preserving the mounted card and row.
const Panel = defineComponent({
	components: { ProjectCard },
	setup: () => ({ store: useProjectsStore() }),
	template: '<ProjectCard :project="store.areas[0].projects[0] || store.areas[0].done[0]" />',
})

let wrapper

beforeEach(() => {
	setActivePinia(createPinia())
	vi.clearAllMocks()
	putTodo.mockResolvedValue({ etag: '"e2"' })
	window.localStorage.setItem('cc_projects:showDone:P', '1')
})

afterEach(() => {
	wrapper?.unmount()
	window.localStorage.clear()
	vi.restoreAllMocks()
})

function mountPanel() {
	const store = useProjectsStore()
	store.areaLists = ['/list-a/']
	store.areaInputs = [{ name: 'Area A', calendar: { url: '/list-a/' } }]
	store.tasksByUid = {
		P: task('P', ['CATEGORIES:project']),
		T: task('T', ['RELATED-TO:P']),
	}
	store.rebuildTree()
	wrapper = mount(Panel, { attachTo: document.body, global: { stubs: { AddTaskInput: true } } })
	return store
}

describe('panel edits with reactive Tasks and real Pinia actions', () => {
	it('checks off and reopens a visible TaskRow with Show done on', async () => {
		const store = mountPanel()
		const setCompleted = vi.spyOn(store, 'setCompleted')
		const row = wrapper.find('.cc-task-row')
		const checkbox = () => row.find('input[type="checkbox"]')
		expect(checkbox().element.checked).toBe(false)

		await checkbox().trigger('click')
		await flushPromises()

		expect(wrapper.find('.cc-project-card__progress-text').text()).toBe('1 of 1')
		expect(checkbox().element.checked).toBe(true)
		expect(row.findComponent(NcCheckboxRadioSwitch).props('modelValue')).toBe(true)
		expect(row.classes()).toContain('is-completed')

		await checkbox().trigger('click')
		await flushPromises()

		expect(checkbox().element.checked).toBe(false)
		expect(row.findComponent(NcCheckboxRadioSwitch).props('modelValue')).toBe(false)
		expect(row.classes()).not.toContain('is-completed')
		expect(wrapper.find('.cc-project-card__progress-text').text()).toBe('0 of 1')
		expect(setCompleted.mock.calls).toEqual([['T', true], ['T', false]])
		expect(putTodo).toHaveBeenCalledTimes(2)
	})

	it('checks off and reopens the project checkbox with Show done on', async () => {
		const store = mountPanel()
		const setCompleted = vi.spyOn(store, 'setCompleted')
		const checkbox = () => wrapper.find('.cc-project-card__completion input[type="checkbox"]')
		expect(checkbox().element.checked).toBe(false)

		await checkbox().trigger('click')
		await flushPromises()

		expect(setCompleted).not.toHaveBeenCalled()
		expect(putTodo).not.toHaveBeenCalled()
		expect(checkbox().element.checked).toBe(false)
		expect(wrapper.findComponent(NcDialog).exists()).toBe(true)
		const confirm = [...document.querySelectorAll('[role="dialog"] button')]
			.find((button) => button.textContent.trim() === 'Check off')
		confirm.click()
		await flushPromises()

		expect(checkbox().element.checked).toBe(true)
		expect(wrapper.findComponent('.cc-project-card__completion').props('modelValue')).toBe(true)
		expect(wrapper.find('.cc-task-row').classes()).toContain('is-completed')

		await checkbox().trigger('click')
		await flushPromises()

		expect(checkbox().element.checked).toBe(false)
		expect(wrapper.findComponent('.cc-project-card__completion').props('modelValue')).toBe(false)
		expect(setCompleted.mock.calls).toEqual([['P', true], ['P', false]])
		expect(putTodo).toHaveBeenCalledTimes(3)
	})

	it('renders an inline title edit after updateTask without remounting', async () => {
		const store = mountPanel()
		const updateTask = vi.spyOn(store, 'updateTask')
		const row = wrapper.find('.cc-task-row')
		expect(row.find('.cc-task-row__title').text()).toBe('T')
		await row.find('.cc-task-row__title').trigger('click')
		const input = row.find('input[aria-label="Task title"]')
		await input.setValue('Renamed task')
		await input.trigger('keydown.enter')
		await flushPromises()

		expect(updateTask).toHaveBeenCalledWith('T', { summary: 'Renamed task' })
		expect(row.find('.cc-task-row__title').text()).toBe('Renamed task')
		expect(putTodo).toHaveBeenCalledOnce()
	})
})
