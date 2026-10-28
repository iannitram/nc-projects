import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MoveToProjectDialog from '../../src/components/MoveToProjectDialog.vue'
import { useProjectsStore } from '../../src/store/projects.js'

describe('MoveToProjectDialog', () => {
	let store

	const sampleAreas = [
		{
			name: 'Home',
			calendarUrl: '/calendars/home/',
			projects: [
				{
					task: { uid: 'p-kitchen', summary: 'Kitchen refresh', calendarUrl: '/calendars/home/' },
					progress: { done: 3, total: 7 },
					children: [{ task: { uid: 'c1' } }, { task: { uid: 'c2' } }, { task: { uid: 'c3' } }],
				},
				{
					task: { uid: 'p-shed', summary: 'Garden shed', calendarUrl: '/calendars/home/' },
					progress: { done: 5, total: 9 },
					children: [],
				},
			],
		},
		{
			name: 'Studio',
			calendarUrl: '/calendars/studio/',
			projects: [
				{
					task: { uid: 'p-podcast', summary: 'Podcast season 2', calendarUrl: '/calendars/studio/' },
					progress: { done: 2, total: 11 },
					children: [{ task: { uid: 's1' } }],
				},
			],
		},
	]

	beforeEach(() => {
		setActivePinia(createPinia())
		store = useProjectsStore()
		store.areas = JSON.parse(JSON.stringify(sampleAreas))
		store.tasksByUid = {
			'p-kitchen': { uid: 'p-kitchen', summary: 'Kitchen refresh', isProject: true, calendarUrl: '/calendars/home/' },
			'p-shed': { uid: 'p-shed', summary: 'Garden shed', isProject: true, calendarUrl: '/calendars/home/' },
			'p-podcast': { uid: 'p-podcast', summary: 'Podcast season 2', isProject: true, calendarUrl: '/calendars/studio/' },
			'task-1': { uid: 'task-1', summary: 'Sand window frames', parentUid: 'p-kitchen', calendarUrl: '/calendars/home/' },
			'sub-1': { uid: 'sub-1', summary: 'Subtask 1', parentUid: 'task-1', calendarUrl: '/calendars/home/' },
			'sub-2': { uid: 'sub-2', summary: 'Subtask 2', parentUid: 'task-1', calendarUrl: '/calendars/home/' },
		}
		store.moveToProject = vi.fn().mockResolvedValue(undefined)
	})

	function mountDialog(props = {}) {
		return mount(MoveToProjectDialog, {
			props: {
				open: true,
				task: store.tasksByUid['task-1'],
				...props,
			},
		})
	}

	it('lists open projects grouped by area with progress', () => {
		const wrapper = mountDialog()

		expect(wrapper.text()).toContain('Home')
		expect(wrapper.text()).toContain('Studio')

		expect(wrapper.text()).toContain('Kitchen refresh')
		expect(wrapper.text()).toContain('3 of 7')

		expect(wrapper.text()).toContain('Garden shed')
		expect(wrapper.text()).toContain('5 of 9')

		expect(wrapper.text()).toContain('Podcast season 2')
		expect(wrapper.text()).toContain('2 of 11')
	})

	it('filters projects by title as you type in search', async () => {
		const wrapper = mountDialog()

		const input = wrapper.find('input[type="text"], input[type="search"]')
		expect(input.exists()).toBe(true)

		await input.setValue('shed')

		expect(wrapper.text()).toContain('Garden shed')
		expect(wrapper.text()).not.toContain('Kitchen refresh')
		expect(wrapper.text()).not.toContain('Podcast season 2')
		// Home area contains Garden shed, but Studio has no match
		expect(wrapper.text()).toContain('Home')
		expect(wrapper.text()).not.toContain('Studio')
	})

	it('disables the task current project', () => {
		const wrapper = mountDialog()

		const kitchenRadio = wrapper.find('input[type="radio"][value="p-kitchen"]')
		expect(kitchenRadio.exists()).toBe(true)
		expect(kitchenRadio.element.disabled).toBe(true)

		const shedRadio = wrapper.find('input[type="radio"][value="p-shed"]')
		expect(shedRadio.exists()).toBe(true)
		expect(shedRadio.element.disabled).toBe(false)
	})

	it('shows the consequence line for same-list move', async () => {
		const taskWithoutSubtasks = { uid: 'task-no-sub', summary: 'Simple task', parentUid: 'p-kitchen', calendarUrl: '/calendars/home/' }
		store.tasksByUid['task-no-sub'] = taskWithoutSubtasks

		const wrapper = mountDialog({ task: taskWithoutSubtasks })

		const shedRadio = wrapper.find('input[type="radio"][value="p-shed"]')
		await shedRadio.setValue('p-shed')

		expect(wrapper.text()).toContain("Moves under 'Garden shed'. It stays on the Home list.")
	})

	it('shows the consequence line for cross-list move with subtask count', async () => {
		// task-1 has 2 subtasks in store.tasksByUid (sub-1, sub-2)
		const wrapper = mountDialog()

		const podcastRadio = wrapper.find('input[type="radio"][value="p-podcast"]')
		await podcastRadio.setValue('p-podcast')

		expect(wrapper.text()).toContain("Moves under 'Podcast season 2' and to the Studio list, with its 2 subtasks.")
	})

	it('disables the Move button until a project is selected', async () => {
		const wrapper = mountDialog()

		const moveBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Move')
		expect(moveBtn).toBeDefined()
		expect(moveBtn.element.disabled).toBe(true)

		const shedRadio = wrapper.find('input[type="radio"][value="p-shed"]')
		await shedRadio.setValue('p-shed')

		expect(moveBtn.element.disabled).toBe(false)
	})

	it('calls store.moveToProject with task UID, target project UID, and end of target children, then closes', async () => {
		const wrapper = mountDialog()

		const shedRadio = wrapper.find('input[type="radio"][value="p-shed"]')
		await shedRadio.setValue('p-shed')

		const moveBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Move')
		await moveBtn.trigger('click')

		// p-shed has 0 children, so end index is 0
		expect(store.moveToProject).toHaveBeenCalledWith('task-1', 'p-shed', 0)
		expect(wrapper.emitted('close')).toBeTruthy()
	})

	it('keeps dialog open when store.moveToProject fails', async () => {
		store.moveToProject.mockRejectedValueOnce(new Error('Network error'))
		const wrapper = mountDialog()

		const shedRadio = wrapper.find('input[type="radio"][value="p-shed"]')
		await shedRadio.setValue('p-shed')

		const moveBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Move')
		await moveBtn.trigger('click')

		expect(store.moveToProject).toHaveBeenCalled()
		expect(wrapper.emitted('close')).toBeFalsy()
	})

	it('does not call moveToProject on Cancel and closes', async () => {
		const wrapper = mountDialog()

		const cancelBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Cancel')
		await cancelBtn.trigger('click')

		expect(store.moveToProject).not.toHaveBeenCalled()
		expect(wrapper.emitted('close')).toBeTruthy()
	})

	it('does not call moveToProject on Escape closing and closes', async () => {
		const wrapper = mountDialog()

		await wrapper.findComponent({ name: 'NcDialog' }).vm.$emit('closing')

		expect(store.moveToProject).not.toHaveBeenCalled()
		expect(wrapper.emitted('close')).toBeTruthy()
	})

	it('selects on one click and keeps selected on a second click rather than toggling off', async () => {
		const wrapper = mountDialog()

		const shedRadio = wrapper.find('input[type="radio"][value="p-shed"]')
		const shedLabel = wrapper.find(`label[for="${shedRadio.attributes('id')}"]`) || shedRadio

		await shedLabel.trigger('click')
		await shedRadio.trigger('change')

		expect(shedRadio.element.checked).toBe(true)

		// Second click must keep it selected
		await shedLabel.trigger('click')
		await shedRadio.trigger('change')

		expect(shedRadio.element.checked).toBe(true)
	})

	it('selects option on Enter and Space keydown, but ignores disabled option', async () => {
		const wrapper = mountDialog()

		const kitchenRadio = wrapper.find('input[type="radio"][value="p-kitchen"]')
		await kitchenRadio.trigger('keydown.enter')
		expect(kitchenRadio.element.checked).toBe(false)

		const podcastRadio = wrapper.find('input[type="radio"][value="p-podcast"]')
		await podcastRadio.trigger('keydown.space')
		expect(podcastRadio.element.checked).toBe(true)

		const shedRadio = wrapper.find('input[type="radio"][value="p-shed"]')
		await shedRadio.trigger('keydown.enter')
		expect(shedRadio.element.checked).toBe(true)
	})

	it('confirms move when Enter is pressed on the Move button', async () => {
		const wrapper = mountDialog()

		const shedRadio = wrapper.find('input[type="radio"][value="p-shed"]')
		await shedRadio.setValue('p-shed')

		const moveBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Move')
		await moveBtn.trigger('keydown.enter')

		expect(store.moveToProject).toHaveBeenCalledWith('task-1', 'p-shed', 0)
		expect(wrapper.emitted('close')).toBeTruthy()
	})
})
