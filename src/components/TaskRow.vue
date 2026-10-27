<script>
import { generateUrl } from '@nextcloud/router'

/**
 *
 * @param {import('../models/Task.js').Task | null | undefined} task
 */
export function getTasksDeepLink(task) {
	if (!task) {
		return '#'
	}
	let base
	try {
		base = generateUrl('apps/tasks') || ''
	} catch {
		base = '/apps/tasks'
	}
	base = base.replace(/\/+$/, '')

	let fileName = ''
	if (task.url) {
		const parts = task.url.split('/')
		fileName = parts[parts.length - 1] || ''
	}
	if (!fileName && task.uid) {
		fileName = task.uid
	}
	if (fileName && !fileName.endsWith('.ics')) {
		fileName += '.ics'
	}

	let calendarSegment = ''
	if (task.calendarUrl) {
		const parts = task.calendarUrl.replace(/\/+$/, '').split('/')
		calendarSegment = parts[parts.length - 1] || ''
	}

	if (calendarSegment && fileName) {
		return `${base}/calendars/${calendarSegment}/tasks/${fileName}`
	}
	if (fileName) {
		return `${base}/collections/all/tasks/${fileName}`
	}
	return `${base}/`
}
</script>

<script setup>
import { NcCheckboxRadioSwitch } from '@nextcloud/vue'
import { computed } from 'vue'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').TaskNode>} */
	node: { type: Object, required: true },
})

const isCompleted = computed(() => {
	const task = props.node?.task
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
})

const formattedDue = computed(() => {
	const due = props.node?.task?.due
	if (!due) {
		return ''
	}
	if (typeof due === 'string') {
		return due
	}
	if (typeof due.toString === 'function') {
		return due.toString()
	}
	return String(due)
})

const priority = computed(() => {
	const p = props.node?.task?.priority
	return p !== null && p !== undefined ? Number(p) : null
})

const tasksDeepLink = computed(() => getTasksDeepLink(props.node?.task))
</script>

<template>
	<div
		class="cc-task-row"
		:class="{ 'is-completed': isCompleted }">
		<NcCheckboxRadioSwitch
			class="cc-task-row__checkbox"
			:isChecked="isCompleted"
			:modelValue="isCompleted"
			:disabled="true"
			aria-label="Task completed" />
		<span class="cc-task-row__title">
			{{ node.task?.summary }}
		</span>
		<span
			v-if="formattedDue"
			class="cc-task-row__due">
			{{ formattedDue }}
		</span>
		<span
			v-if="priority"
			class="cc-task-row__priority">
			P{{ priority }}
		</span>
		<a
			:href="tasksDeepLink"
			class="cc-task-row__open-in-tasks"
			title="Open in Tasks">
			Open in Tasks
		</a>
		<a
			v-if="node.deeper && node.deeper > 0"
			:href="tasksDeepLink"
			class="cc-task-deeper"
			:title="`Open task in Tasks (${node.deeper} deeper subtasks)`">
			+{{ node.deeper }} deeper
		</a>
	</div>
</template>

<style scoped>
.cc-task-row {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	padding: 4px 6px;
	border-radius: var(--border-radius-element, 4px);
	flex: 1;
}

.cc-task-row.is-completed .cc-task-row__title {
	text-decoration: line-through;
	color: var(--color-text-maxcontrast, #777);
}

.cc-task-row__title {
	flex: 1;
	font-size: 0.95rem;
}

.cc-task-row__due {
	font-size: 0.8rem;
	color: var(--color-text-maxcontrast, #777);
	padding: 2px 6px;
	background: var(--color-background-hover, #f0f0f0);
	border-radius: var(--border-radius-pill, 10px);
}

.cc-task-row__priority {
	font-size: 0.8rem;
	font-weight: 600;
	color: var(--color-primary, #0082c9);
}

.cc-task-row__open-in-tasks {
	font-size: 0.8rem;
	color: var(--color-primary, #0082c9);
	text-decoration: none;
	opacity: 0.7;
}

.cc-task-row__open-in-tasks:hover {
	opacity: 1;
	text-decoration: underline;
}

.cc-task-deeper {
	font-size: 0.85rem;
	font-weight: 600;
	color: var(--color-primary, #0082c9);
	text-decoration: none;
	padding: 2px 6px;
	border: 1px dashed var(--color-primary, #0082c9);
	border-radius: var(--border-radius-element, 4px);
}

.cc-task-deeper:hover {
	background: var(--color-primary-element-light, rgba(0, 130, 201, 0.1));
}
</style>
