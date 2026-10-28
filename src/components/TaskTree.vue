<script>
/**
 * Determine whether a task is closed (completed or cancelled).
 *
 * @param {import('../models/Task.js').Task | object | null | undefined} task The task to check
 * @return {boolean} True if completed or cancelled
 */
export function isTaskClosed(task) {
	if (!task) {
		return false
	}
	if (task.closed === true || task.completed === true) {
		return true
	}
	if (typeof task.status === 'string') {
		const status = task.status.toUpperCase()
		if (status === 'COMPLETED' || status === 'CANCELLED') {
			return true
		}
	}
	return Boolean(task.completed)
}
</script>

<script setup>
import { Sortable } from 'sortablejs-vue3'
import { computed, ref } from 'vue'
import TaskRow from './TaskRow.vue'
import { DRAG_OPTIONS, fullIndexForDrop, onSiblingDrop } from '../composables/useDrag.js'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').TaskNode[]>} */
	nodes: { type: Array, required: true },
	depth: { type: Number, default: 1 },
	showDone: { type: Boolean, default: false },
	areaName: { type: String, default: null },
	projectUid: { type: String, default: null },
})

const collapsedKeys = ref(new Set())

/**
 * Return a stable key for a task node.
 *
 * @param {import('../models/tree.js').TaskNode} node The task node
 * @return {string | null} Unique key
 */
function getNodeKey(node) {
	return node.task?.uid || node.task?.summary || null
}

/**
 * Check if a task node's children are collapsed.
 *
 * @param {import('../models/tree.js').TaskNode} node The task node
 * @return {boolean} True if collapsed
 */
function isCollapsed(node) {
	if (typeof node.collapsed === 'boolean') {
		return node.collapsed
	}
	const key = getNodeKey(node)
	return key ? collapsedKeys.value.has(key) : false
}

/**
 * Toggle the collapse state of a task node's subtasks.
 *
 * @param {import('../models/tree.js').TaskNode} node The task node
 */
function toggleCollapse(node) {
	const collapsing = !isCollapsed(node)
	try {
		node.collapsed = collapsing
	} catch {
		// In case node is frozen
	}
	const key = getNodeKey(node)
	if (!key) {
		return
	}
	const next = new Set(collapsedKeys.value)
	if (collapsing) {
		next.add(key)
	} else {
		next.delete(key)
	}
	collapsedKeys.value = next
}

/**
 * Check if a task node has visible children under the current showDone setting.
 *
 * @param {import('../models/tree.js').TaskNode} node The task node
 * @return {boolean} True if there are visible children
 */
function hasVisibleChildren(node) {
	if (!node?.children || node.children.length === 0) {
		return false
	}
	if (props.showDone) {
		return true
	}
	return node.children.some((child) => !isTaskClosed(child?.task))
}

const visibleNodes = computed(() => {
	const list = props.nodes || []
	if (props.showDone) {
		return list
	}
	return list.filter((node) => !isTaskClosed(node?.task))
})

/** The project or task whose children these are: every child carries it as its parent. */
const parentUid = computed(() => props.nodes?.[0]?.task?.parentUid || null)
const effectiveProjectUid = computed(() => props.projectUid || parentUid.value)

/** Sortable options: Tasks' options, and group configuration (shared across same-area projects for top-level tasks). */
const sortOptions = computed(() => {
	if (props.depth === 1 && props.areaName) {
		return {
			...DRAG_OPTIONS,
			group: {
				name: `cc-tasks-area-${props.areaName}`,
				pull: true,
				put: true,
			},
		}
	}
	return {
		...DRAG_OPTIONS,
		group: { name: `cc-tasks-${parentUid.value ?? 'none'}` },
	}
})

/**
 * Row key for the sortable list (the same key the rows had before).
 *
 * @param {import('../models/tree.js').TaskNode} node The task node
 * @return {string | import('../models/tree.js').TaskNode} Unique key
 */
function rowKey(node) {
	return getNodeKey(node) || node
}

/**
 * Put a dropped row back where Vue has it, so the store's list (after reorder,
 * or after a rollback) is what the DOM shows.
 *
 * @param {{item: HTMLElement, from: HTMLElement, oldIndex: number}} evt The sortable end event
 */
function restoreDomPosition(evt) {
	const { item, from, oldIndex } = evt
	if (!item || !from) {
		return
	}
	item.remove()
	from.insertBefore(item, from.children[oldIndex] ?? null)
}

/**
 * Read a comma-separated uid list off a list element's data attribute.
 *
 * @param {HTMLElement} element The list element
 * @param {string} name The dataset key
 * @return {string[]} The uids
 */
function uidsOf(element, name) {
	return (element.dataset[name] || '').split(',').filter(Boolean)
}

/**
 * Turn a finished drag into a reorder or a move to another project.
 *
 * @param {object} evt The sortable end event
 * @return {Promise<void> | undefined} The store's reorder or moveToProject
 */
function onDrop(evt) {
	if (!evt.to || evt.from === evt.to) {
		restoreDomPosition(evt)
		const targetParent = parentUid.value || effectiveProjectUid.value
		if (!targetParent) {
			return undefined
		}
		return onSiblingDrop(
			useProjectsStore(),
			{
				parentUid: targetParent,
				allUids: (props.nodes || []).map((node) => node.task?.uid),
				visibleUids: visibleNodes.value.map((node) => node.task?.uid),
			},
			evt,
		)
	}

	// Cross-list: Sortable moved the row's element into the target list. Take it out again and
	// let Vue render the moved task in the target from the store. (Putting it back in the source
	// list does not work: Vue keeps each row between two anchor nodes, and an element re-inserted
	// by index lands outside the anchors of its own row, so Vue never removes it and the row
	// stays in the source list until a reload. Without the element in the source DOM, Vue's
	// removal of the row is a no-op.)
	evt.item.remove()

	const movedUid = visibleNodes.value[evt.oldIndex]?.task?.uid
	const targetProjectUid = evt.to.dataset.projectUid
	if (!movedUid || !targetProjectUid) {
		return undefined
	}
	const allUids = uidsOf(evt.to, 'allUids')
	const visibleUids = uidsOf(evt.to, 'visibleUids')
	const fullIndex = fullIndexForDrop(allUids, visibleUids, movedUid, evt.newIndex)
	return useProjectsStore().moveToProject(movedUid, targetProjectUid, fullIndex)
}
</script>

<template>
	<Sortable
		tag="ul"
		class="cc-task-tree"
		:class="`cc-task-tree--level-${depth}`"
		:list="visibleNodes"
		:itemKey="rowKey"
		:options="sortOptions"
		:data-project-uid="effectiveProjectUid"
		:data-all-uids="(nodes || []).map((node) => node.task?.uid).filter(Boolean).join(',')"
		:data-visible-uids="visibleNodes.map((node) => node.task?.uid).filter(Boolean).join(',')"
		@end="onDrop">
		<template #item="{ element: node }">
			<li
				class="cc-task-tree__item"
				:class="{ 'is-closed': isTaskClosed(node?.task), 'cc-task-tree__item--closed': isTaskClosed(node?.task) }"
				:style="isTaskClosed(node?.task) ? { opacity: 0.6 } : undefined">
				<div
					class="cc-task-tree__row-wrapper drag-handle"
					:class="{ 'is-closed': isTaskClosed(node?.task) }"
					:data-uid="node.task?.uid">
					<button
						v-if="hasVisibleChildren(node)"
						type="button"
						class="cc-task-tree__collapse-toggle"
						:aria-expanded="!isCollapsed(node)"
						:aria-label="isCollapsed(node) ? 'Expand subtasks' : 'Collapse subtasks'"
						@click="toggleCollapse(node)">
						<span class="cc-task-tree__collapse-icon">{{ isCollapsed(node) ? '▶' : '▼' }}</span>
					</button>
					<span v-else class="cc-task-tree__collapse-placeholder" />
					<TaskRow :node="node" />
				</div>
				<div
					v-if="hasVisibleChildren(node) && !isCollapsed(node)"
					class="cc-task-tree__children">
					<TaskTree
						:nodes="node.children"
						:depth="depth + 1"
						:showDone="showDone"
						:areaName="areaName"
						:projectUid="effectiveProjectUid" />
				</div>
			</li>
		</template>
	</Sortable>
</template>

<style scoped>
.cc-task-tree {
	list-style: none;
	margin: 0;
	padding: 0;
}

.cc-task-tree__item {
	margin: calc(var(--default-grid-baseline, 4px) * 1) 0;
}

.cc-task-tree__item.is-closed,
.cc-task-tree__item--closed {
	opacity: 0.6;
}

.cc-task-tree__row-wrapper {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 1);
}

.cc-task-tree__collapse-toggle {
	background: transparent;
	border: none;
	cursor: pointer;
	padding: 2px 4px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--color-text-maxcontrast, #777);
	font-size: 0.75rem;
	width: 20px;
	height: 20px;
}

.cc-task-tree__collapse-placeholder {
	width: 20px;
	height: 20px;
	display: inline-block;
}

.cc-task-tree__children {
	margin-left: calc(var(--default-grid-baseline, 4px) * 5);
}

@media (max-width: 600px) {
	.cc-task-tree__collapse-toggle,
	button.cc-task-tree__collapse-toggle {
		min-height: 44px;
		min-width: 44px;
	}
}
</style>
