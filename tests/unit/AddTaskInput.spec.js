import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddTaskInput from '../../src/components/AddTaskInput.vue'
import { useProjectsStore } from '../../src/store/projects.js'

enableAutoUnmount(afterEach)

describe('AddTaskInput', () => {
	let store

	beforeEach(() => {
		setActivePinia(createPinia())
		store = useProjectsStore()
		store.addTask = vi.fn().mockResolvedValue('new-uid')
	})

	async function mountInput() {
		const wrapper = mount(AddTaskInput, {
			props: { projectUid: 'p1' },
			attachTo: document.body,
		})
		expect(wrapper.find('input').exists()).toBe(false)
		await wrapper.get('button').trigger('click')
		expect(document.activeElement).toBe(wrapper.get('input').element)
		return wrapper
	}

	it('renders a ghost button that opens a focused input', async () => {
		const wrapper = await mountInput()
		expect(wrapper.find('input').attributes('placeholder')).toBe('Add task')
	})

	it('adds a trimmed task on Enter and clears the field', async () => {
		const wrapper = await mountInput()
		const input = wrapper.find('input')
		await input.setValue('  buy milk  ')
		await input.trigger('keydown', { key: 'Enter' })
		await flushPromises()

		expect(store.addTask).toHaveBeenCalledWith('p1', 'buy milk')
		expect(input.element.value).toBe('')
	})

	it('keeps the typed title when the add fails', async () => {
		store.addTask.mockResolvedValue(null)
		const wrapper = await mountInput()
		const input = wrapper.find('input')
		await input.setValue('  buy milk  ')
		await input.trigger('keydown', { key: 'Enter' })
		await flushPromises()

		expect(store.addTask).toHaveBeenCalledWith('p1', 'buy milk')
		expect(input.element.value).toBe('  buy milk  ')
	})

	it('does not add on blank Enter', async () => {
		const wrapper = await mountInput()
		const input = wrapper.find('input')
		await input.setValue('   ')
		await input.trigger('keydown', { key: 'Enter' })
		await flushPromises()

		expect(store.addTask).not.toHaveBeenCalled()
	})

	it('returns to the ghost button on Escape', async () => {
		const wrapper = await mountInput()
		const input = wrapper.find('input')
		await input.setValue('draft')
		await input.trigger('keydown', { key: 'Escape' })

		expect(wrapper.find('input').exists()).toBe(false)
		expect(document.activeElement).toBe(wrapper.get('button').element)
		expect(store.addTask).not.toHaveBeenCalled()
	})

	it('closes on empty blur but keeps a nonempty draft', async () => {
		const wrapper = await mountInput()
		await wrapper.get('input').setValue('draft')
		await wrapper.get('input').trigger('blur')
		expect(wrapper.get('input').element.value).toBe('draft')
		await wrapper.get('input').setValue('  ')
		await wrapper.get('input').trigger('blur')
		expect(wrapper.find('input').exists()).toBe(false)
	})
})
