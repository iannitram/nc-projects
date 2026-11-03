import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import UndoToast, { UNDO_TOAST_MS } from '../../src/components/UndoToast.vue'
import { useProjectsStore } from '../../src/store/projects.js'

/** @param {string} label @return {import('../../src/models/undo.js').UndoEntry} */
const change = (label) => ({ label, items: [] })

describe('UndoToast', () => {
	let pinia
	let store

	beforeEach(() => {
		vi.useFakeTimers()
		pinia = createPinia()
		setActivePinia(pinia)
		store = useProjectsStore()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	/** Mount the toast and push one change onto the stack, as a recorded action does. */
	async function recordChange(label = 'Completed "Buy milk"') {
		const wrapper = mount(UndoToast, { global: { plugins: [pinia] } })
		store.undoStack = [...store.undoStack, change(label)]
		await nextTick()
		return wrapper
	}

	const undoButton = (wrapper) => wrapper.find('.cc-undo-toast__undo')
	const dismissButton = (wrapper) => wrapper.find('.cc-undo-toast__dismiss')

	it('shows nothing while the stack is empty', () => {
		const wrapper = mount(UndoToast, { global: { plugins: [pinia] } })
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(false)
	})

	it('shows the newest change label with Undo and dismiss after a change', async () => {
		const wrapper = await recordChange()
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(true)
		expect(wrapper.text()).toContain('Completed "Buy milk"')
		expect(undoButton(wrapper).text()).toBe('Undo')
		expect(dismissButton(wrapper).exists()).toBe(true)
	})

	it('shows the newest label, not an older one, and "+N earlier" for the rest of the stack', async () => {
		const wrapper = mount(UndoToast, { global: { plugins: [pinia] } })
		store.undoStack = [change('First'), change('Second'), change('Third')]
		await nextTick()
		expect(wrapper.find('.cc-undo-toast__text').text()).toContain('Third')
		expect(wrapper.find('.cc-undo-toast__text').text()).not.toContain('First')
		expect(wrapper.find('.cc-undo-toast__earlier').text()).toBe('+2 earlier')
	})

	it('leaves out "+N earlier" when the stack holds one change', async () => {
		const wrapper = await recordChange()
		expect(wrapper.find('.cc-undo-toast__earlier').exists()).toBe(false)
	})

	it('Undo calls store.undo()', async () => {
		const undo = vi.spyOn(store, 'undo').mockResolvedValue()
		const wrapper = await recordChange()
		await undoButton(wrapper).trigger('click')
		expect(undo).toHaveBeenCalledTimes(1)
	})

	it('is disabled and reads "Undoing..." while an undo runs', async () => {
		const wrapper = await recordChange()
		store.undoing = true
		await nextTick()
		expect(undoButton(wrapper).text()).toBe('Undoing...')
		expect(undoButton(wrapper).attributes('disabled')).toBeDefined()
		store.undoing = false
		await nextTick()
		expect(undoButton(wrapper).text()).toBe('Undo')
		expect(undoButton(wrapper).attributes('disabled')).toBeUndefined()
	})

	it('dismiss clears the stack and hides the toast', async () => {
		const wrapper = await recordChange()
		await dismissButton(wrapper).trigger('click')
		await nextTick()
		expect(store.undoStack).toEqual([])
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(false)
	})

	it('hides 10 s after the last change', async () => {
		const wrapper = await recordChange()
		vi.advanceTimersByTime(UNDO_TOAST_MS - 1)
		await nextTick()
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(true)
		vi.advanceTimersByTime(1)
		await nextTick()
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(false)
	})

	it('a newer change restarts the 10 s from that change', async () => {
		const wrapper = await recordChange('First')
		vi.advanceTimersByTime(8000)
		store.undoStack = [...store.undoStack, change('Second')]
		await nextTick()
		vi.advanceTimersByTime(8000)
		await nextTick()
		expect(wrapper.text()).toContain('Second')
		vi.advanceTimersByTime(2000)
		await nextTick()
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(false)
	})

	it('hover holds the toast past 10 s and hides it when the pointer leaves', async () => {
		const wrapper = await recordChange()
		await wrapper.find('.cc-undo-toast').trigger('mouseenter')
		vi.advanceTimersByTime(UNDO_TOAST_MS * 3)
		await nextTick()
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(true)
		await wrapper.find('.cc-undo-toast').trigger('mouseleave')
		await nextTick()
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(false)
	})

	it('focus inside the toast holds it past 10 s and hides it when focus leaves', async () => {
		const wrapper = await recordChange()
		await undoButton(wrapper).trigger('focusin')
		vi.advanceTimersByTime(UNDO_TOAST_MS * 3)
		await nextTick()
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(true)
		await undoButton(wrapper).trigger('focusout', { relatedTarget: null })
		await nextTick()
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(false)
	})

	it('moving focus between the toast buttons keeps it open', async () => {
		const wrapper = await recordChange()
		await undoButton(wrapper).trigger('focusin')
		await undoButton(wrapper).trigger('focusout', { relatedTarget: dismissButton(wrapper).element })
		vi.advanceTimersByTime(UNDO_TOAST_MS * 2)
		await nextTick()
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(true)
	})

	it('an undo error stays until dismissed, past the 10 s', async () => {
		const wrapper = await recordChange()
		store.undoError = 'Could not undo'
		await nextTick()
		vi.advanceTimersByTime(UNDO_TOAST_MS * 3)
		await nextTick()
		expect(wrapper.find('.cc-undo-toast__text').text()).toBe('Could not undo')
		expect(undoButton(wrapper).exists()).toBe(true)
		await dismissButton(wrapper).trigger('click')
		await nextTick()
		expect(store.undoError).toBeNull()
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(false)
	})

	it('announces politely through a live status region that exists before any change', () => {
		const wrapper = mount(UndoToast, { global: { plugins: [pinia] } })
		const region = wrapper.find('.cc-undo-toast')
		expect(region.attributes('role')).toBe('status')
		expect(region.attributes('aria-live')).toBe('polite')
	})

	it('the buttons are native buttons, so keyboard users reach them with Tab', async () => {
		const wrapper = await recordChange()
		expect(undoButton(wrapper).element.tagName).toBe('BUTTON')
		expect(dismissButton(wrapper).element.tagName).toBe('BUTTON')
		expect(dismissButton(wrapper).attributes('aria-label')).toBe('Dismiss')
	})

	it('a change recorded before mount still shows and times out', async () => {
		store.undoStack = [change('Earlier session change')]
		const wrapper = mount(UndoToast, { global: { plugins: [pinia] } })
		await nextTick()
		expect(wrapper.text()).toContain('Earlier session change')
		vi.advanceTimersByTime(UNDO_TOAST_MS)
		await nextTick()
		expect(wrapper.find('.cc-undo-toast__card').exists()).toBe(false)
	})
})
