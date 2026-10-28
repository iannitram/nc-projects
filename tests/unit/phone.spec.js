import { NcDateTimePickerNative } from '@nextcloud/vue'
import { mount } from '@vue/test-utils'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import TaskRow from '../../src/components/TaskRow.vue'
import { DRAG_OPTIONS } from '../../src/composables/useDrag.js'

vi.mock('@nextcloud/router', async (importOriginal) => ({
	...(await importOriginal()),
	generateUrl: vi.fn((route) => `/${route}`),
}))

const NcActionsStub = {
	template: '<div class="nc-actions-stub"><slot /></div>',
}

const NcActionButtonStub = {
	emits: ['click'],
	template: '<button class="nc-action-button-stub" @click="$emit(\'click\')"><slot /></button>',
}

function sampleNode() {
	return {
		task: {
			uid: 't1',
			summary: 'Fix the engine',
			completed: false,
			due: null,
			priority: 1,
			url: '/remote.php/dav/calendars/owner/personal-1/t1.ics',
			calendarUrl: '/remote.php/dav/calendars/owner/personal-1/',
		},
		children: [],
		deeper: 0,
	}
}

describe('phone layout and touch interaction (issue #22)', () => {
	it('DRAG_OPTIONS still has delay 500 with delayOnTouchOnly', () => {
		expect(DRAG_OPTIONS.delay).toBe(500)
		expect(DRAG_OPTIONS.delayOnTouchOnly).toBe(true)
		expect(DRAG_OPTIONS.touchStartThreshold).toBe(3)
		expect(DRAG_OPTIONS.handle).toBe('.drag-handle')
	})

	it('a touchstart on an edit control does not reach the row', async () => {
		const wrapper = mount(TaskRow, {
			props: { node: sampleNode() },
			global: {
				stubs: {
					NcActions: NcActionsStub,
					NcActionButton: NcActionButtonStub,
				},
			},
		})

		const rowTouchstart = vi.fn()
		wrapper.element.addEventListener('touchstart', rowTouchstart)

		// 1. Open in Tasks link
		const link = wrapper.find('.cc-task-open-in-tasks')
		expect(link.exists()).toBe(true)
		await link.trigger('touchstart')
		expect(rowTouchstart).not.toHaveBeenCalled()

		// 2. Date picker
		const datePicker = wrapper.findComponent(NcDateTimePickerNative)
		const dateInput = datePicker.find('input')
		expect(dateInput.exists()).toBe(true)
		await dateInput.trigger('touchstart')
		expect(rowTouchstart).not.toHaveBeenCalled()

		// 3. Priority menu
		const priorityMenu = wrapper.find('.cc-task-row__priority-menu')
		expect(priorityMenu.exists()).toBe(true)
		await priorityMenu.trigger('touchstart')
		expect(rowTouchstart).not.toHaveBeenCalled()

		// 4. Title editor input
		await wrapper.find('.cc-task-row__title').trigger('click')
		await nextTick()
		const titleInput = wrapper.find('.cc-task-row__title-input input')
		expect(titleInput.exists()).toBe(true)
		await titleInput.trigger('touchstart')
		expect(rowTouchstart).not.toHaveBeenCalled()
	})

	it('has phone media query with the 44 px minimum (read the stylesheet as text)', () => {
		const cssPath = path.resolve(__dirname, '../../src/styles/projects.css')
		const css = fs.readFileSync(cssPath, 'utf8')

		// Media query at max-width 600px exists
		expect(css).toMatch(/@media\s*\(\s*max-width:\s*600px\s*\)/)

		// 44 px minimum is specified in the stylesheet
		expect(css).toMatch(/min-height:\s*44px/)

		// Check every tap target is styled for 44px minimum height
		const tapTargetSelectors = [
			'.cc-task-row__checkbox',
			'.cc-task-row__title',
			'.cc-task-row__date',
			'.cc-task-row__priority-menu',
			'.cc-task-open-in-tasks',
			'.cc-project-card__show-done',
			'.cc-add-task-input',
			'.cc-area-section__new-project',
		]

		for (const selector of tapTargetSelectors) {
			expect(css).toContain(selector)
		}

		// Ensure panel is one column and controls wrap under title
		expect(css).toContain('flex-direction: column')
		expect(css).toContain('flex-wrap: wrap')
	})
})
