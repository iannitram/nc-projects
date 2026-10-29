import { mount } from '@vue/test-utils'
import fs from 'node:fs'
import path from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { Sortable } from 'sortablejs-vue3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import TaskRow from '../../src/components/TaskRow.vue'
import TaskTree from '../../src/components/TaskTree.vue'
import {
	DRAG_OPTIONS,
	LONG_PRESS_HINT_KEY,
	LONG_PRESS_MS,
	longPressHintVisible,
	onLongPressChoose,
	onLongPressRelease,
} from '../../src/composables/useDrag.js'
import { useProjectsStore } from '../../src/store/projects.js'

vi.mock('@nextcloud/router', async (importOriginal) => ({
	...(await importOriginal()),
	generateUrl: vi.fn((route) => `/${route}`),
}))

const NcActionsStub = {
	template: '<div class="nc-actions-stub"><slot /></div>',
}

const NcActionLinkStub = {
	props: ['href'],
	template: '<a class="nc-action-link-stub" :href="href"><slot /></a>',
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

const css = fs.readFileSync(path.resolve(__dirname, '../../src/styles/projects.css'), 'utf8')
const PHONE_QUERY = '@media (max-width: 600px), (pointer: coarse)'
const HOVER_QUERY = '@media (hover: none)'

/**
 * The text of the block that follows `query` (between its braces).
 *
 * @param {string} query the media query that opens the block
 * @return {string} the block body
 */
function blockAfter(query) {
	const open = css.indexOf('{', css.indexOf(query))
	let depth = 0
	for (let i = open; i < css.length; i++) {
		if (css[i] === '{') {
			depth++
		} else if (css[i] === '}' && --depth === 0) {
			return css.slice(open + 1, i)
		}
	}
	throw new Error('unclosed block')
}

/**
 * The text of the phone and touch block (between its braces).
 *
 * @return {string} the block body
 */
function phoneBlock() {
	return blockAfter(PHONE_QUERY)
}

/**
 * The declarations of every rule in the phone block whose selector list holds `selector`.
 *
 * @param {string} selector the selector to look for
 * @return {string} the declarations
 */
function ruleFor(selector) {
	const rules = [...phoneBlock().replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
	const matching = rules.filter(([, selectors]) => selectors.split(',').some((s) => s.trim() === selector))
	expect(matching.length, selector).toBeGreaterThan(0)
	return matching.map((rule) => rule[2]).join(' ')
}

describe('phone layout and long-press drag (#123)', () => {
	describe('the stylesheet', () => {
		it('has exactly one phone and touch block, and no other media query but the hover one', () => {
			expect(css.split(PHONE_QUERY)).toHaveLength(2)
			expect(css.match(/@media/g)).toHaveLength(2)
			expect(css.split(HOVER_QUERY)).toHaveLength(2)
		})

		it('keeps the menus visible on any screen that cannot hover, and nothing else', () => {
			// The row and card components ruled "(hover: none)" before #123 moved their media
			// queries here. A no-hover screen with a fine pointer must not get the phone block:
			// it would lose the grip, and useDrag long-presses only from a touch pointer.
			const block = blockAfter(HOVER_QUERY).replace(/\/\*[\s\S]*?\*\//g, '')
			const rules = [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
			expect(rules).toHaveLength(1)
			const [, selectors, declarations] = rules[0]
			expect(selectors.split(',').map((s) => s.trim())).toEqual([
				'.cc-column .cc-task-row .cc-task-row__menu',
				'.cc-column .cc-project-card__header .cc-project-card__menu .action-item__menutoggle > *',
			])
			expect(declarations).toMatch(/visibility:\s*visible/)
			expect(declarations).toMatch(/opacity:\s*1/)
			expect(block).not.toMatch(/grip|--cc-target|--cc-row-height|display:\s*none/)
		})

		it('sets the row height to 48 px and the touch target to 44 px as variables', () => {
			const column = ruleFor('.cc-column')
			expect(column).toMatch(/--cc-row-height:\s*48px/)
			expect(column).toMatch(/--cc-target:\s*44px/)
			expect(column).toMatch(/--default-clickable-area:\s*var\(--cc-target\)/)
		})

		it('replaces the per-element 44 px overrides with the variables', () => {
			expect(css).not.toMatch(/min-(height|width):\s*44px/)
			for (const selector of [
				'button.cc-task-tree__collapse-toggle',
				'.cc-task-row__checkbox',
				'.cc-task-row__menu',
				'.cc-task-row__menu .action-item__menutoggle',
			]) {
				expect(ruleFor(selector)).toMatch(/min-width:\s*var\(--cc-target\)/)
				expect(ruleFor(selector)).toMatch(/min-height:\s*var\(--cc-target\)/)
			}
			for (const selector of [
				'.cc-task-deeper',
				'.cc-add-task-input input',
				'.cc-done-strip__toggle',
				'.cc-task-row__title-input .input-field__input',
			]) {
				expect(ruleFor(selector)).toMatch(/min-height:\s*var\(--cc-target\)/)
			}
			expect(ruleFor('.cc-task-row')).toMatch(/min-height:\s*var\(--cc-row-height\)/)
		})

		it('never wraps a row: titles are cut with an ellipsis', () => {
			expect(phoneBlock()).not.toMatch(/flex-wrap:\s*wrap/)
			expect(phoneBlock()).not.toMatch(/white-space:\s*normal/)
			expect(ruleFor('.cc-task-row')).toMatch(/flex-wrap:\s*nowrap/)
			const title = ruleFor('.cc-task-row__title')
			expect(title).toMatch(/white-space:\s*nowrap/)
			expect(title).toMatch(/text-overflow:\s*ellipsis/)
			expect(title).toMatch(/overflow:\s*hidden/)
		})

		it('keeps the page from scrolling sideways', () => {
			expect(ruleFor('.cc-projects-scroll')).toMatch(/overflow-x:\s*hidden/)
			expect(ruleFor('.cc-task-row')).toMatch(/max-width:\s*100%/)
		})

		it('always shows the menu and hides the grip', () => {
			expect(ruleFor('.cc-column .cc-task-row .cc-task-row__menu')).toMatch(/visibility:\s*visible/)
			expect(ruleFor('.cc-column .cc-project-card__header .cc-project-card__grip')).toMatch(/display:\s*none/)
		})

		it('renders row menus as a bottom sheet: full width, bottom, rounded top, 48 px items', () => {
			const sheet = ruleFor('.v-popper__popper.action-item__popper')
			expect(sheet).toMatch(/position:\s*fixed !important/)
			expect(sheet).toMatch(/inset:\s*auto 0 0 0 !important/)
			expect(sheet).toMatch(/width:\s*100% !important/)
			expect(sheet).toMatch(/z-index:\s*\d{4,}/)
			expect(ruleFor('.action-item__popper .v-popper__inner')).toMatch(/overflow-y:\s*auto/)
			expect(ruleFor('.action-item__popper .v-popper__wrapper')).toMatch(/border-radius:.*16px\) 0 0/)
			expect(ruleFor('.action-item__popper li')).toMatch(/min-height:\s*var\(--cc-row-height, 48px\)/)
		})

		it('the real menu popover carries the bottom-sheet class and the button keeps its name', async () => {
			const wrapper = mount(TaskRow, { props: { node: sampleNode() }, attachTo: document.body })
			const button = wrapper.find('.action-item__menutoggle')
			expect(button.attributes('aria-label')).toBe('Actions for Fix the engine')
			await button.trigger('click')
			await vi.waitFor(() => expect(document.querySelector('.v-popper__popper.action-item__popper')).not.toBeNull())
			expect(button.attributes('aria-label')).toBe('Actions for Fix the engine')
			wrapper.unmount()
		})

		it('styles the lifted row (chosenClass) and the drop line (ghostClass)', () => {
			expect(css).toMatch(/\.cc-drag-chosen > \.cc-task-tree__row-wrapper[^{]*\{[^}]*transform:\s*scale\(1\.02\)[^}]*box-shadow/)
			expect(css).toMatch(/\.cc-drag-ghost::before\s*\{[^}]*height:\s*2px[^}]*background:\s*var\(--color-primary-element\)/)
		})

		it('leaves no phone-width overrides in the row, tree and card components', () => {
			for (const file of ['TaskRow.vue', 'TaskTree.vue', 'ProjectCard.vue']) {
				const source = fs.readFileSync(path.resolve(__dirname, `../../src/components/${file}`), 'utf8')
				expect(source, file).not.toMatch(/@media/)
			}
		})
	})

	describe('long press', () => {
		let store

		beforeEach(() => {
			vi.useFakeTimers()
			setActivePinia(createPinia())
			store = useProjectsStore()
			store.reorder = vi.fn().mockResolvedValue(undefined)
			window.localStorage.clear()
			longPressHintVisible.value = false
		})

		afterEach(() => {
			vi.useRealTimers()
			vi.restoreAllMocks()
		})

		it('waits about 300 ms, on touch only, and names the lift and drop classes', () => {
			expect(LONG_PRESS_MS).toBe(300)
			expect(DRAG_OPTIONS).toMatchObject({
				delay: 300,
				delayOnTouchOnly: true,
				touchStartThreshold: 3,
				handle: '.drag-handle',
				chosenClass: 'cc-drag-chosen',
				ghostClass: 'cc-drag-ghost',
			})
		})

		/**
		 * Put a finger down on an element, the way Sortable listens for it in this browser.
		 *
		 * @param {HTMLElement} element the element under the finger
		 */
		function fingerDown(element) {
			const usePointer = 'PointerEvent' in window
			const evt = new Event(usePointer ? 'pointerdown' : 'touchstart', { bubbles: true, cancelable: true })
			const point = { clientX: 10, clientY: 10 }
			Object.assign(evt, usePointer ? { ...point, pointerType: 'touch', button: 0 } : { touches: [{ ...point, target: element }] })
			element.dispatchEvent(evt)
		}

		it('lifts a row after a 300 ms press, shows the hint, then reorders on the drop', async () => {
			const nodes = ['t1', 't2', 't3'].map((uid) => ({
				task: { uid, summary: uid, completed: false, parentUid: 'p1' },
				children: [],
				deeper: 0,
			}))
			const wrapper = mount(TaskTree, { props: { nodes }, attachTo: document.body })
			await nextTick()
			const list = wrapper.find('ul').element
			const item = list.children[0]

			fingerDown(item.querySelector('.drag-handle'))
			vi.advanceTimersByTime(LONG_PRESS_MS - 1)
			expect(item.classList.contains('cc-drag-chosen')).toBe(false)
			expect(longPressHintVisible.value).toBe(false)

			vi.advanceTimersByTime(1)
			expect(item.classList.contains('cc-drag-chosen')).toBe(true)
			expect(longPressHintVisible.value).toBe(true)

			// The drop: Sortable reports the move, the tree turns it into a reorder.
			const sortable = wrapper.findComponent(Sortable)
			sortable.vm.$emit('unchoose', { item })
			sortable.vm.$emit('end', { item, from: list, to: list, oldIndex: 0, newIndex: 2 })
			await nextTick()
			expect(longPressHintVisible.value).toBe(false)
			expect(store.reorder).toHaveBeenCalledWith('p1', null, 't1', 2)
			wrapper.unmount()
		})

		it('shows the hint for the first three long presses only', () => {
			const touch = { originalEvent: { type: 'touchstart', touches: [{}] } }
			const shown = []
			for (let i = 0; i < 5; i++) {
				onLongPressChoose(touch)
				shown.push(longPressHintVisible.value)
				onLongPressRelease()
			}
			expect(shown).toEqual([true, true, true, false, false])
			expect(window.localStorage.getItem(LONG_PRESS_HINT_KEY)).toBe('3')
		})

		it('counts a touch pointer as a long press, but not a mouse', () => {
			onLongPressChoose({ originalEvent: { type: 'pointerdown', pointerType: 'mouse' } })
			expect(longPressHintVisible.value).toBe(false)
			onLongPressChoose({ originalEvent: { type: 'pointerdown', pointerType: 'touch' } })
			expect(longPressHintVisible.value).toBe(true)
		})

		it('does not throw when storage is blocked', () => {
			vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
				throw new Error('blocked')
			})
			vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
				throw new Error('blocked')
			})
			expect(() => onLongPressChoose({ originalEvent: { type: 'touchstart', touches: [{}] } })).not.toThrow()
			expect(longPressHintVisible.value).toBe(false)
		})
	})

	it('a touchstart on an edit control does not reach the row', async () => {
		const wrapper = mount(TaskRow, {
			props: { node: sampleNode() },
			global: {
				stubs: {
					NcActions: NcActionsStub,
					NcActionButton: NcActionButtonStub,
					NcActionLink: NcActionLinkStub,
				},
			},
		})

		const rowTouchstart = vi.fn()
		wrapper.element.addEventListener('touchstart', rowTouchstart)

		// 1. Open in Tasks (menu link)
		const link = wrapper.find('.nc-action-link-stub')
		expect(link.exists()).toBe(true)
		await link.trigger('touchstart')
		expect(rowTouchstart).not.toHaveBeenCalled()

		// 2. Actions menu
		const priorityMenu = wrapper.find('.cc-task-row__menu')
		expect(priorityMenu.exists()).toBe(true)
		await priorityMenu.trigger('touchstart')
		expect(rowTouchstart).not.toHaveBeenCalled()

		// 3. Title editor input
		await wrapper.find('.cc-task-row__title').trigger('click')
		await nextTick()
		const titleInput = wrapper.find('.cc-task-row__title-input input')
		expect(titleInput.exists()).toBe(true)
		await titleInput.trigger('touchstart')
		expect(rowTouchstart).not.toHaveBeenCalled()
	})
})
