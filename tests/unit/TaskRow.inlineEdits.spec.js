import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { Task } from '../../src/models/Task.js'

const { updateTask } = vi.hoisted(() => ({ updateTask: vi.fn() }))

vi.mock('../../src/store/projects.js', () => ({
	useProjectsStore: () => ({ updateTask }),
}))

vi.mock('@nextcloud/router', async (importOriginal) => ({
	...(await importOriginal()),
	generateUrl: vi.fn((route) => `/${route}`),
}))

import TaskRow from '../../src/components/TaskRow.vue'

// NcActions renders its items only when the menu is open, so the tests render them inline.
const NcActionsStub = {
	template: '<div class="nc-actions-stub"><slot /></div>',
}

const NcActionInputStub = {
	name: 'NcActionInput',
	props: ['modelValue', 'type', 'label'],
	emits: ['update:modelValue'],
	template: '<div class="nc-action-input-stub" :aria-label="label"><slot /></div>',
}

const NcActionButtonStub = {
	emits: ['click'],
	template: '<button class="nc-action-button-stub" @click="$emit(\'click\')"><slot /></button>',
}

const NcActionRadioStub = {
	name: 'NcActionRadio',
	props: ['modelValue', 'value'],
	emits: ['update:modelValue'],
	template: '<label class="nc-action-radio-stub"><input type="radio" :checked="modelValue === value" @change="$emit(\'update:modelValue\', value)"><slot /></label>',
}

const NcActionLinkStub = {
	props: ['href'],
	template: '<a class="nc-action-link-stub" :href="href"><slot /></a>',
}

const menuStubs = {
	NcActions: NcActionsStub,
	NcActionInput: NcActionInputStub,
	NcActionButton: NcActionButtonStub,
	NcActionRadio: NcActionRadioStub,
	NcActionLink: NcActionLinkStub,
}

function node(overrides = {}) {
	return {
		task: {
			uid: 't1',
			summary: 'Fix the engine',
			completed: false,
			due: null,
			priority: null,
			url: '/remote.php/dav/calendars/owner/list-a/t1.ics',
			calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
			...overrides,
		},
		children: [],
		deeper: 0,
	}
}

function mountRow(task = node()) {
	return mount(TaskRow, { props: { node: task }, global: { stubs: menuStubs } })
}

async function openTitleEditor(wrapper) {
	await wrapper.find('.cc-task-row__title').trigger('click')
	await nextTick()
	return wrapper.find('input[aria-label="Task title"]')
}

describe('TaskRow inline edits', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('rename', () => {
		it('saves the new title on Enter', async () => {
			const wrapper = mountRow()
			const input = await openTitleEditor(wrapper)

			await input.setValue('New title')
			await input.trigger('keydown.enter')

			expect(updateTask).toHaveBeenCalledTimes(1)
			expect(updateTask).toHaveBeenCalledWith('t1', { summary: 'New title' })
		})

		it('cancels on Escape without writing', async () => {
			const wrapper = mountRow()
			const input = await openTitleEditor(wrapper)

			await input.setValue('Discarded')
			await input.trigger('keydown.esc')

			expect(updateTask).not.toHaveBeenCalled()
			expect(wrapper.find('.cc-task-row__title').text()).toBe('Fix the engine')
		})

		it('saves the new title on blur', async () => {
			const wrapper = mountRow()
			const input = await openTitleEditor(wrapper)

			await input.setValue('Blurred title')
			await input.trigger('blur')

			expect(updateTask).toHaveBeenCalledTimes(1)
			expect(updateTask).toHaveBeenCalledWith('t1', { summary: 'Blurred title' })
		})

		it('does not write an unchanged title', async () => {
			const wrapper = mountRow()
			const input = await openTitleEditor(wrapper)

			await input.trigger('keydown.enter')

			expect(updateTask).not.toHaveBeenCalled()
		})

		it('does not write an empty title', async () => {
			const wrapper = mountRow()
			const input = await openTitleEditor(wrapper)

			await input.setValue('   ')
			await input.trigger('keydown.enter')

			expect(updateTask).not.toHaveBeenCalled()
		})

		it('makes the title focusable with a button role and an accessible name', () => {
			const wrapper = mountRow()
			const title = wrapper.find('.cc-task-row__title')

			expect(title.attributes('tabindex')).toBe('0')
			expect(title.attributes('role')).toBe('button')
			expect(title.attributes('aria-label')).toBe('Rename Fix the engine')
		})

		it('opens the rename field on Enter', async () => {
			const wrapper = mountRow()

			await wrapper.find('.cc-task-row__title').trigger('keydown.enter')
			await nextTick()

			expect(wrapper.find('input[aria-label="Task title"]').exists()).toBe(true)
		})

		it('opens the rename field on Space', async () => {
			const wrapper = mountRow()

			await wrapper.find('.cc-task-row__title').trigger('keydown.space')
			await nextTick()

			expect(wrapper.find('input[aria-label="Task title"]').exists()).toBe(true)
		})
	})

	describe('due date', () => {
		const due = new Date(Date.UTC(2026, 10, 5, 12, 0, 0))

		it('renders no date input and no chip at rest', () => {
			const wrapper = mount(TaskRow, { props: { node: node() } })

			expect(wrapper.find('input[type="date"]').exists()).toBe(false)
			expect(wrapper.find('.cc-task-row__due').exists()).toBe(false)
			expect(wrapper.find('.cc-task-row__clear-due').exists()).toBe(false)
			expect(wrapper.find('.cc-task-open-in-tasks').exists()).toBe(false)
		})

		it('shows a due chip only when a date is set, overdue in the error class', () => {
			const future = new Date(Date.now() + 5 * 86400000)
			const wrapper = mountRow(node({ due: future }))
			const chip = wrapper.find('.cc-task-row__due')

			expect(chip.exists()).toBe(true)
			expect(chip.classes()).not.toContain('is-overdue')

			const overdue = mountRow(node({ due: new Date(2020, 0, 3) })).find('.cc-task-row__due')
			expect(overdue.classes()).toContain('is-overdue')
			expect(overdue.text()).toContain('overdue')
		})

		it('does not mark a completed task overdue', () => {
			const wrapper = mountRow(node({ due: new Date(2020, 0, 3), completed: true }))

			expect(wrapper.find('.cc-task-row__due').classes()).not.toContain('is-overdue')
		})

		it('has a "Due date…" menu input of type date', () => {
			const input = mountRow().findComponent(NcActionInputStub)

			expect(input.props('type')).toBe('date')
			expect(input.attributes('aria-label')).toBe('Due date…')
		})

		it('sets DUE with the picked date', async () => {
			const wrapper = mountRow()

			await wrapper.findComponent(NcActionInputStub).vm.$emit('update:modelValue', due)

			expect(updateTask).toHaveBeenCalledTimes(1)
			expect(updateTask).toHaveBeenCalledWith('t1', { due })
		})

		it('does not write an empty value', async () => {
			const wrapper = mountRow(node({ due }))

			await wrapper.findComponent(NcActionInputStub).vm.$emit('update:modelValue', null)

			expect(updateTask).not.toHaveBeenCalled()
		})

		it('does not write an invalid date', async () => {
			const wrapper = mountRow()

			await wrapper.findComponent(NcActionInputStub).vm.$emit('update:modelValue', new Date(NaN))

			expect(updateTask).not.toHaveBeenCalled()
		})

		it('clears the due date from the menu and changes nothing else (M15)', async () => {
			const wrapper = mountRow(node({ due }))
			const clear = wrapper.findAll('.nc-action-button-stub').find((item) => item.text() === 'Clear due date')

			expect(clear).toBeTruthy()
			await clear.trigger('click')

			expect(updateTask).toHaveBeenCalledTimes(1)
			expect(updateTask).toHaveBeenCalledWith('t1', { due: null })
		})

		it('hides "Clear due date" when there is no due date', () => {
			const wrapper = mountRow()

			expect(wrapper.findAll('.nc-action-button-stub').some((item) => item.text() === 'Clear due date')).toBe(false)
		})

		it('hands the task DUE date to the menu input', () => {
			const ics = [
				'BEGIN:VCALENDAR',
				'VERSION:2.0',
				'BEGIN:VTODO',
				'UID:t1',
				'SUMMARY:Fix the engine',
				'DUE;VALUE=DATE:20300304',
				'END:VTODO',
				'END:VCALENDAR',
				'',
			].join('\r\n')
			const task = reactive(Task.fromIcs(ics, {
				url: '/remote.php/dav/calendars/owner/list-a/t1.ics',
				etag: '"e1"',
				calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
			}))
			const wrapper = mount(TaskRow, {
				props: { node: { task, children: [], deeper: 0 } },
				global: { stubs: menuStubs },
			})

			const value = wrapper.findComponent(NcActionInputStub).props('modelValue')
			expect(value).toBeInstanceOf(Date)
			expect(value.getFullYear()).toBe(2030)
			expect(value.getMonth()).toBe(2)
			expect(value.getDate()).toBe(4)
			expect(wrapper.find('.cc-task-row__due').text()).toMatch(/Mar/)
		})
	})

	describe('priority', () => {
		const labels = [
			['High', 1],
			['Medium', 5],
			['Low', 9],
			['None', 0],
		]

		it('offers four radios with names', () => {
			const radios = mountRow().findAll('.nc-action-radio-stub')

			expect(radios.map((item) => item.text())).toEqual(['High', 'Medium', 'Low', 'None'])
		})

		it.each(labels)('sets %s to %i and writes only the priority', async (label, value) => {
			const wrapper = mountRow()

			const radio = wrapper.findAll('.nc-action-radio-stub').find((item) => item.text() === label)
			await radio.find('input').trigger('change')

			expect(updateTask).toHaveBeenCalledTimes(1)
			expect(updateTask).toHaveBeenCalledWith('t1', { priority: value })
		})

		it.each([
			[1, 'high'],
			[4, 'high'],
			[5, 'medium'],
			[6, 'low'],
			[9, 'low'],
			[0, 'none'],
			[null, 'none'],
		])('priority %s gives the %s ring and checks that radio', (priority, level) => {
			const wrapper = mountRow(node({ priority }))

			expect(wrapper.find('.cc-task-row__checkbox').classes()).toContain(`cc-task-row__checkbox--${level}`)
			const checked = wrapper.findAll('.nc-action-radio-stub').filter((item) => item.find('input').element.checked)
			expect(checked.map((item) => item.text())).toEqual([{ high: 'High', medium: 'Medium', low: 'Low', none: 'None' }[level]])
		})
	})

	it('links to the task in Tasks from the menu', () => {
		const wrapper = mountRow()

		const link = wrapper.find('.nc-action-link-stub')
		expect(link.exists()).toBe(true)
		expect(link.text()).toBe('Open in Tasks')
		expect(link.attributes('href')).toBe('/apps/tasks/calendars/list-a/tasks/t1.ics')
	})

	it('names the menu button after the task', () => {
		const wrapper = mount(TaskRow, { props: { node: node() } })

		expect(wrapper.find(`[aria-label="Actions for ${node().task.summary}"]`).exists()).toBe(true)
	})

	it('does not let mousedown on an edit control bubble to the row', async () => {
		const wrapper = mountRow()
		const rowMousedown = vi.fn()
		wrapper.element.addEventListener('mousedown', rowMousedown)

		const input = await openTitleEditor(wrapper)
		await input.trigger('mousedown')

		expect(rowMousedown).not.toHaveBeenCalled()
	})

	it('stops pointerdown and touchstart on the title input too', async () => {
		const wrapper = mountRow()
		const rowEvent = vi.fn()
		wrapper.element.addEventListener('pointerdown', rowEvent)
		wrapper.element.addEventListener('touchstart', rowEvent)

		const input = await openTitleEditor(wrapper)
		await input.trigger('pointerdown')
		await input.trigger('touchstart')

		expect(rowEvent).not.toHaveBeenCalled()
	})

	it('lets touchstart on the title bubble to the row', async () => {
		const wrapper = mountRow()
		const rowTouchstart = vi.fn()
		wrapper.element.addEventListener('touchstart', rowTouchstart)

		await wrapper.find('.cc-task-row__title').trigger('touchstart')

		expect(rowTouchstart).toHaveBeenCalledOnce()
	})
})
