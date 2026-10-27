import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AddTaskInput from '../../src/components/AddTaskInput.vue'
import { useProjectsStore } from '../../src/store/projects.js'

const NcTextFieldStub = {
	props: ['modelValue', 'placeholder', 'disabled'],
	emits: ['update:modelValue'],
	template: '<input :value="modelValue" :placeholder="placeholder" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)">',
}

describe('AddTaskInput', () => {
	let store

	beforeEach(() => {
		setActivePinia(createPinia())
		store = useProjectsStore()
		store.addTask = vi.fn().mockResolvedValue('new-uid')
	})

	function mountInput() {
		return mount(AddTaskInput, {
			props: { projectUid: 'p1' },
			global: { stubs: { NcTextField: NcTextFieldStub } },
		})
	}

	it('renders with the placeholder', () => {
		const wrapper = mountInput()
		expect(wrapper.find('input').attributes('placeholder')).toBe('+ Add task')
	})

	it('adds a trimmed task on Enter and clears the field', async () => {
		const wrapper = mountInput()
		const input = wrapper.find('input')
		await input.setValue('  buy milk  ')
		await input.trigger('keydown', { key: 'Enter' })
		await flushPromises()

		expect(store.addTask).toHaveBeenCalledWith('p1', 'buy milk')
		expect(input.element.value).toBe('')
	})

	it('keeps the typed title when the add fails', async () => {
		store.addTask.mockResolvedValue(null)
		const wrapper = mountInput()
		const input = wrapper.find('input')
		await input.setValue('  buy milk  ')
		await input.trigger('keydown', { key: 'Enter' })
		await flushPromises()

		expect(store.addTask).toHaveBeenCalledWith('p1', 'buy milk')
		expect(input.element.value).toBe('  buy milk  ')
	})

	it('does not add on blank Enter', async () => {
		const wrapper = mountInput()
		const input = wrapper.find('input')
		await input.setValue('   ')
		await input.trigger('keydown', { key: 'Enter' })
		await flushPromises()

		expect(store.addTask).not.toHaveBeenCalled()
	})

	it('clears the field on Escape', async () => {
		const wrapper = mountInput()
		const input = wrapper.find('input')
		await input.setValue('draft')
		await input.trigger('keydown', { key: 'Escape' })

		expect(input.element.value).toBe('')
		expect(store.addTask).not.toHaveBeenCalled()
	})
})
