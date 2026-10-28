import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Sortable } from 'sortablejs-vue3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskTree from '../../src/components/TaskTree.vue'
import { DRAG_OPTIONS } from '../../src/composables/useDrag.js'
import { useProjectsStore } from '../../src/store/projects.js'

function node(uid, parentUid = 'p1', extra = {}) {
	return {
		task: { uid, summary: `Task ${uid}`, completed: false, parentUid, ...extra },
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
		store.moveToProject = vi.fn().mockResolvedValue(undefined)
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

	describe('cross-project dragging in same area (issue #25 / P12)', () => {
		it('configures top-level lists in the same area to share a sortable group, keeps another area out, and keeps subtasks per-parent', () => {
			const wrapperA = mount(TaskTree, {
				props: { projectUid: 'pA', areaName: 'Personal', nodes: [node('a1', 'pA')] },
			})
			const wrapperB = mount(TaskTree, {
				props: { projectUid: 'pB', areaName: 'Personal', nodes: [node('b1', 'pB')] },
			})
			const wrapperOther = mount(TaskTree, {
				props: { projectUid: 'pC', areaName: 'Work', nodes: [node('c1', 'pC')] },
			})
			const wrapperSub = mount(TaskTree, {
				props: { depth: 2, projectUid: 'pA', areaName: 'Personal', nodes: [node('s1', 'a1')] },
			})

			const sortableA = wrapperA.findComponent(Sortable)
			const sortableB = wrapperB.findComponent(Sortable)
			const sortableOther = wrapperOther.findComponent(Sortable)
			const sortableSub = wrapperSub.findComponent(Sortable)

			// Same area shares group name
			expect(sortableA.props('options').group.name).toBe('cc-tasks-area-Personal')
			expect(sortableB.props('options').group.name).toBe('cc-tasks-area-Personal')
			expect(sortableA.props('options').group.name).toBe(sortableB.props('options').group.name)

			// Different area has different group name
			expect(sortableOther.props('options').group.name).toBe('cc-tasks-area-Work')
			expect(sortableA.props('options').group.name).not.toBe(sortableOther.props('options').group.name)

			// Subtask list keeps per-parent group name
			expect(sortableSub.props('options').group.name).toBe('cc-tasks-a1')
			expect(sortableSub.props('options').group.name).not.toBe(sortableA.props('options').group.name)
		})

		it('calls store.moveToProject with moved uid, target project uid and fullIndex on cross-list drop, and not reorder', async () => {
			const wrapperA = mount(TaskTree, {
				props: { projectUid: 'pA', areaName: 'Personal', nodes: [node('a1', 'pA'), node('a2', 'pA')] },
			})
			const wrapperB = mount(TaskTree, {
				props: { projectUid: 'pB', areaName: 'Personal', nodes: [node('b1', 'pB'), node('b2', 'pB')] },
			})
			const listA = wrapperA.find('ul').element
			const listB = wrapperB.find('ul').element
			const item = listA.children[0]

			wrapperA.findComponent(Sortable).vm.$emit('end', {
				item,
				from: listA,
				to: listB,
				oldIndex: 0,
				newIndex: 1,
			})
			await wrapperA.vm.$nextTick()

			expect(store.moveToProject).toHaveBeenCalledTimes(1)
			expect(store.moveToProject).toHaveBeenCalledWith('a1', 'pB', 1)
			expect(store.reorder).not.toHaveBeenCalled()
		})

		it('calculates the target fullIndex using fullIndexForDrop when target project has hidden closed tasks', async () => {
			const wrapperA = mount(TaskTree, {
				props: { projectUid: 'pA', areaName: 'Personal', nodes: [node('a1', 'pA')] },
			})
			const wrapperB = mount(TaskTree, {
				props: {
					projectUid: 'pB',
					areaName: 'Personal',
					nodes: [
						node('b1', 'pB'),
						node('b2', 'pB', { completed: true }),
						node('b3', 'pB'),
					],
				},
			})
			const listA = wrapperA.find('ul').element
			const listB = wrapperB.find('ul').element
			const item = listA.children[0]

			// In wrapperB, visible tasks are b1 and b3.
			// Dropping at newIndex: 2 places it after b3, which is fullIndex 3 among [b1, b2, b3]
			wrapperA.findComponent(Sortable).vm.$emit('end', {
				item,
				from: listA,
				to: listB,
				oldIndex: 0,
				newIndex: 2,
			})
			await wrapperA.vm.$nextTick()

			expect(store.moveToProject).toHaveBeenCalledWith('a1', 'pB', 3)
			expect(store.reorder).not.toHaveBeenCalled()
		})

		it('calls reorder and not moveToProject when dropping within the same list', async () => {
			const wrapper = mount(TaskTree, {
				props: { projectUid: 'p1', areaName: 'Personal', nodes: [node('t1'), node('t2'), node('t3')] },
			})
			const list = wrapper.find('ul').element
			const item = list.children[0]

			wrapper.findComponent(Sortable).vm.$emit('end', {
				item,
				from: list,
				to: list,
				oldIndex: 0,
				newIndex: 2,
			})
			await wrapper.vm.$nextTick()

			expect(store.reorder).toHaveBeenCalledTimes(1)
			expect(store.reorder).toHaveBeenCalledWith('p1', null, 't1', 2)
			expect(store.moveToProject).not.toHaveBeenCalled()
		})

		it('restores the dropped element back to its source list on cross-project drop before store update', () => {
			const wrapperA = mount(TaskTree, {
				props: { projectUid: 'pA', areaName: 'Personal', nodes: [node('a1', 'pA'), node('a2', 'pA')] },
			})
			const wrapperB = mount(TaskTree, {
				props: { projectUid: 'pB', areaName: 'Personal', nodes: [node('b1', 'pB'), node('b2', 'pB')] },
			})
			const listA = wrapperA.find('ul').element
			const listB = wrapperB.find('ul').element
			const item = listA.children[0]

			// Simulate Sortable moving item from listA into listB
			listB.appendChild(item)

			wrapperA.findComponent(Sortable).vm.$emit('end', {
				item,
				from: listA,
				to: listB,
				oldIndex: 0,
				newIndex: 2,
			})

			// item should be restored back into listA at oldIndex 0
			expect(wrapperA.findAll('.drag-handle').map((h) => h.attributes('data-uid'))).toEqual(['a1', 'a2'])
			expect(wrapperB.findAll('.drag-handle').map((h) => h.attributes('data-uid'))).toEqual(['b1', 'b2'])
		})
	})
})
