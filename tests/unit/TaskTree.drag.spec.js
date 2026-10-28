import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Sortable } from 'sortablejs-vue3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskTree from '../../src/components/TaskTree.vue'
import { DRAG_OPTIONS } from '../../src/composables/useDrag.js'
import { useProjectsStore } from '../../src/store/projects.js'

function node(uid, parentUid = 'p1') {
	return {
		task: { uid, summary: `Task ${uid}`, completed: false, parentUid },
		children: [],
		deeper: 0,
	}
}

describe('TaskTree drag to reorder', () => {
	let store

	beforeEach(() => {
		setActivePinia(createPinia())
		store = useProjectsStore()
		store.reorder = vi.fn().mockResolvedValue(undefined)
	})

	it('renders the children of a project as a Sortable list with DRAG_OPTIONS and a group for that parent', () => {
		const wrapper = mount(TaskTree, {
			props: { nodes: [node('t1'), node('t2')] },
		})

		const sortable = wrapper.findComponent(Sortable)
		expect(sortable.exists()).toBe(true)
		expect(sortable.props('options')).toMatchObject({ ...DRAG_OPTIONS, group: { name: 'cc-tasks-p1' } })
		expect(sortable.props('list').map((n) => n.task.uid)).toEqual(['t1', 't2'])
	})

	it('puts a .drag-handle on each row, keyed by task uid', () => {
		const wrapper = mount(TaskTree, {
			props: { nodes: [node('t1'), node('t2')] },
		})

		const handles = wrapper.findAll('.drag-handle')
		expect(handles).toHaveLength(2)
		expect(handles.map((h) => h.attributes('data-uid'))).toEqual(['t1', 't2'])
	})

	it('calls store.reorder with the parent, null, the moved uid and the new index on a drop', async () => {
		const wrapper = mount(TaskTree, {
			props: { nodes: [node('t1'), node('t2'), node('t3')] },
		})
		const list = wrapper.find('ul').element
		const item = list.children[0]

		wrapper.findComponent(Sortable).vm.$emit('end', { item, from: list, oldIndex: 0, newIndex: 2 })
		await wrapper.vm.$nextTick()

		expect(store.reorder).toHaveBeenCalledTimes(1)
		expect(store.reorder).toHaveBeenCalledWith('p1', null, 't1', 2)
	})

	it('does not call store.reorder when the drop keeps the index', () => {
		const wrapper = mount(TaskTree, {
			props: { nodes: [node('t1'), node('t2')] },
		})
		const list = wrapper.find('ul').element

		wrapper.findComponent(Sortable).vm.$emit('end', { item: list.children[1], from: list, oldIndex: 1, newIndex: 1 })

		expect(store.reorder).not.toHaveBeenCalled()
	})

	it('puts the dropped row back in its old place so the store decides the order', () => {
		const wrapper = mount(TaskTree, {
			props: { nodes: [node('t1'), node('t2'), node('t3')] },
		})
		const list = wrapper.find('ul').element
		// Simulate Sortable moving t1 to the end of the DOM
		list.appendChild(list.children[0])

		wrapper.findComponent(Sortable).vm.$emit('end', { item: list.children[2], from: list, oldIndex: 0, newIndex: 2 })

		expect(wrapper.findAll('.drag-handle').map((h) => h.attributes('data-uid'))).toEqual(['t1', 't2', 't3'])
	})
})
