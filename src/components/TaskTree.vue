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
import { computed, ref } from 'vue'
import TaskRow from './TaskRow.vue'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').TaskNode[]>} */
	nodes: { type: Array, required: true },
	depth: { type: Number, default: 1 },
	showDone: { type: Boolean, default: false },
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
</script>

<template>
	<ul class="cc-task-tree" :class="`cc-task-tree--level-${depth}`">
		<li
			v-for="node in visibleNodes"
			:key="getNodeKey(node) || node"
			class="cc-task-tree__item"
			:class="{ 'is-closed': isTaskClosed(node?.task), 'cc-task-tree__item--closed': isTaskClosed(node?.task) }"
			:style="isTaskClosed(node?.task) ? { opacity: 0.6 } : undefined">
			<div
				class="cc-task-tree__row-wrapper"
				:class="{ 'is-closed': isTaskClosed(node?.task) }">
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
					:showDone="showDone" />
			</div>
		</li>
	</ul>
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
</style>
