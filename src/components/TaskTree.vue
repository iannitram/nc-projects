<script setup>
import { computed, ref } from 'vue'
import TaskRow from './TaskRow.vue'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').TaskNode[]>} */
	nodes: { type: Array, required: true },
	showDone: { type: Boolean, default: true },
	depth: { type: Number, default: 1 },
})

/**
 *
 * @param {import('../models/Task.js').Task | null | undefined} task
 */
function isTaskCompleted(task) {
	if (!task) {
		return false
	}
	if (task.completed === true) {
		return true
	}
	if (typeof task.status === 'string' && task.status.toUpperCase() === 'COMPLETED') {
		return true
	}
	return Boolean(task.completed)
}

const visibleNodes = computed(() => {
	if (props.showDone) {
		return props.nodes || []
	}
	return (props.nodes || []).filter((node) => !isTaskCompleted(node.task))
})

const collapsedKeys = ref(new Set())

/**
 *
 * @param {import('../models/tree.js').TaskNode} node
 */
function getNodeKey(node) {
	return node.task?.uid || node.task?.summary || null
}

/**
 *
 * @param {import('../models/tree.js').TaskNode} node
 */
function isCollapsed(node) {
	if (node.collapsed === true) {
		return true
	}
	const key = getNodeKey(node)
	return key ? collapsedKeys.value.has(key) : false
}

/**
 *
 * @param {import('../models/tree.js').TaskNode} node
 */
function toggleCollapse(node) {
	if (typeof node.collapsed === 'boolean') {
		node.collapsed = !node.collapsed
	}
	const key = getNodeKey(node)
	if (!key) {
		return
	}
	const next = new Set(collapsedKeys.value)
	if (next.has(key)) {
		next.delete(key)
	} else {
		next.add(key)
	}
	collapsedKeys.value = next
}

/**
 *
 * @param {import('../models/tree.js').TaskNode} node
 */
function hasVisibleChildren(node) {
	if (!node.children || node.children.length === 0) {
		return false
	}
	if (props.showDone) {
		return true
	}
	return node.children.some((child) => !isTaskCompleted(child.task))
}
</script>

<template>
	<ul class="cc-task-tree" :class="`cc-task-tree--level-${depth}`">
		<li
			v-for="node in visibleNodes"
			:key="getNodeKey(node) || node"
			class="cc-task-tree__item">
			<div class="cc-task-tree__row-wrapper">
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
					:showDone="showDone"
					:depth="depth + 1" />
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
