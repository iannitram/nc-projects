import { NcDateTimePickerNative } from '@nextcloud/vue'
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

const NcActionsStub = {
	template: '<div class="nc-actions-stub"><slot /></div>',
}

const NcActionButtonStub = {
	emits: ['click'],
	template: '<button class="nc-action-button-stub" @click="$emit(\'click\')"><slot /></button>',
}

function node(overrides = {}) {
	return {
		task: {
			uid: 't1',
			summary: 'Fix the engine',
			completed: false,
			due: null,
			priority: null,
			url: '/remote.php/dav/calendars/owner/personal-1/t1.ics',
			calendarUrl: '/remote.php/dav/calendars/owner/personal-1/',
			...overrides,
		},
		children: [],
		deeper: 0,
	}
}

function mountRow(task = node()) {
	return mount(TaskRow, { props: { node: task } })
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
		it('sets DUE with the picked date', async () => {
			const wrapper = mountRow()
			const picker = wrapper.findComponent(NcDateTimePickerNative)
			const due = new Date(Date.UTC(2026, 10, 5, 12, 0, 0))

			await picker.vm.$emit('update:modelValue', due)

			expect(updateTask).toHaveBeenCalledTimes(1)
			expect(updateTask).toHaveBeenCalledWith('t1', { due })
		})

		it('does not write an empty value', async () => {
			const wrapper = mountRow(node({ due: new Date(Date.UTC(2026, 10, 5, 12, 0, 0)) }))
			const picker = wrapper.findComponent(NcDateTimePickerNative)

			await picker.vm.$emit('update:modelValue', null)

			expect(updateTask).not.toHaveBeenCalled()
		})

		it('does not write an invalid date', async () => {
			const wrapper = mountRow()
			const picker = wrapper.findComponent(NcDateTimePickerNative)

			await picker.vm.$emit('update:modelValue', new Date(NaN))

			expect(updateTask).not.toHaveBeenCalled()
		})

		it('clears the due date with the Clear action', async () => {
			const wrapper = mountRow(node({ due: new Date(Date.UTC(2026, 10, 5, 12, 0, 0)) }))
			const clear = wrapper.find('.cc-task-row__clear-due')

			expect(clear.exists()).toBe(true)
			await clear.trigger('click')

			expect(updateTask).toHaveBeenCalledTimes(1)
			expect(updateTask).toHaveBeenCalledWith('t1', { due: null })
		})

		it('hides the Clear action when there is no due date', () => {
			const wrapper = mountRow()

			expect(wrapper.find('.cc-task-row__clear-due').exists()).toBe(false)
		})

		it('renders the task DUE date in the picker', () => {
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
				url: '/remote.php/dav/calendars/owner/personal-1/t1.ics',
				etag: '"e1"',
				calendarUrl: '/remote.php/dav/calendars/owner/personal-1/',
			}))
			const wrapper = mount(TaskRow, {
				props: { node: { task, children: [], deeper: 0 } },
			})

			const value = wrapper.findComponent(NcDateTimePickerNative).props('modelValue')
			expect(value).toBeInstanceOf(Date)
			expect(value.getFullYear()).toBe(2030)
			expect(value.getMonth()).toBe(2)
			expect(value.getDate()).toBe(4)
		})
	})

	describe('priority', () => {
		const labels = [
			['High', 1],
			['Medium', 5],
			['Low', 9],
			['None', 0],
		]

		it.each(labels)('sets %s to %i', async (label, value) => {
			const wrapper = mount(TaskRow, {
				props: { node: node() },
				global: {
					stubs: {
						NcActions: NcActionsStub,
						NcActionButton: NcActionButtonStub,
					},
				},
			})

			const button = wrapper.findAll('.nc-action-button-stub').find((item) => item.text() === label)
			await button.trigger('click')

			expect(updateTask).toHaveBeenCalledTimes(1)
			expect(updateTask).toHaveBeenCalledWith('t1', { priority: value })
		})
	})

	it('links to the task in Tasks', () => {
		const wrapper = mountRow()

		const link = wrapper.find('.cc-task-open-in-tasks')
		expect(link.exists()).toBe(true)
		expect(link.text()).toBe('Open in Tasks')
		expect(link.attributes('href')).toBe('/apps/tasks/calendars/personal-1/tasks/t1.ics')
	})

	it('does not let mousedown on an edit control bubble to the row', async () => {
		const wrapper = mountRow()
		const rowMousedown = vi.fn()
		wrapper.element.addEventListener('mousedown', rowMousedown)

		const input = await openTitleEditor(wrapper)
		await input.trigger('mousedown')

		const dateInput = wrapper.findComponent(NcDateTimePickerNative).find('input')
		await dateInput.trigger('mousedown')

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
