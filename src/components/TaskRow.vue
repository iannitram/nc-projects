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
import { NcActionButton, NcActions, NcCheckboxRadioSwitch, NcDateTimePickerNative, NcTextField } from '@nextcloud/vue'
import { computed, nextTick, ref, toRaw } from 'vue'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').TaskNode>} */
	node: { type: Object, required: true },
})
function onCompletionChange() {
	useProjectsStore().setCompleted(props.node?.task?.uid, !isCompleted.value)
}

const PRIORITY_OPTIONS = [
	{ value: 1, label: 'High' },
	{ value: 5, label: 'Medium' },
	{ value: 9, label: 'Low' },
	{ value: 0, label: 'None' },
]

const editing = ref(false)
const titleDraft = ref('')
const titleInput = ref(null)
let titleCancelled = false

const task = computed(() => props.node?.task)
const summary = computed(() => task.value?.summary ?? '')

const isCompleted = computed(() => {
	if (!task.value) {
		return false
	}
	if (task.value.completed === true) {
		return true
	}
	if (typeof task.value.status === 'string' && task.value.status.toUpperCase() === 'COMPLETED') {
		return true
	}
	return Boolean(task.value.completed)
})

const tasksDeepLink = computed(() => getTasksDeepLink(task.value))

const dueDate = computed(() => {
	const due = task.value?.due
	if (!due) {
		return null
	}
	// The store keeps tasks in reactive state, so DUE may arrive as a proxy.
	const raw = toRaw(due)
	if (raw instanceof Date) {
		return raw
	}
	if (typeof raw.toJSDate === 'function') {
		return raw.toJSDate()
	}
	if (typeof raw === 'string') {
		const parsed = new Date(raw)
		return Number.isNaN(parsed.getTime()) ? null : parsed
	}
	return null
})

const priority = computed(() => {
	const value = Number(task.value?.priority)
	return PRIORITY_OPTIONS.some((option) => option.value === value) ? value : 0
})

const priorityLabel = computed(() => PRIORITY_OPTIONS.find((option) => option.value === priority.value)?.label ?? 'None')

/**
 * Send one quick edit through the store (it writes only that field, with If-Match).
 *
 * @param {object} changes the fields to change
 */
function update(changes) {
	const uid = task.value?.uid
	if (!uid) {
		return
	}
	try {
		const result = useProjectsStore().updateTask(uid, changes)
		if (result && typeof result.catch === 'function') {
			result.catch(() => {})
		}
	} catch {
		// Keep the row usable when no store is active.
	}
}

/** Turn the title into an input and focus it. */
function startEdit() {
	titleDraft.value = summary.value
	titleCancelled = false
	editing.value = true
	nextTick(() => titleInput.value?.focus?.())
}

/** Save the title on Enter or blur; an empty or unchanged title writes nothing. */
function saveTitle() {
	if (!editing.value) {
		return
	}
	if (titleCancelled) {
		titleCancelled = false
		editing.value = false
		return
	}
	const next = String(titleDraft.value ?? '').trim()
	editing.value = false
	if (!next || next === summary.value) {
		titleDraft.value = summary.value
		return
	}
	update({ summary: next })
}

/** Discard the title edit on Escape. */
function cancelTitle() {
	titleCancelled = true
	editing.value = false
	titleDraft.value = summary.value
}

/**
 * @param {Date|null|string} value the picked day, or null/'' when cleared
 */
function setDue(value) {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		return
	}
	update({ due: value })
}

/** Remove the due date on purpose (the only way to clear it). */
function clearDue() {
	update({ due: null })
}

/**
 * @param {number} value 1 high, 5 medium, 9 low, 0 none (as Tasks)
 */
function setPriority(value) {
	update({ priority: value })
}
</script>

<template>
	<div
		class="cc-task-row"
		:class="{ 'is-completed': isCompleted }">
		<NcCheckboxRadioSwitch
			class="cc-task-row__checkbox"
			:isChecked="isCompleted"
			:modelValue="isCompleted"
			aria-label="Task completed"
			@update:modelValue="onCompletionChange" />
		<NcTextField
			v-if="editing"
			ref="titleInput"
			v-model="titleDraft"
			class="cc-task-row__title-input cc-no-drag"
			aria-label="Task title"
			@keydown.enter.prevent="saveTitle"
			@keydown.esc.prevent="cancelTitle"
			@blur="saveTitle"
			@mousedown.stop
			@pointerdown.stop
			@touchstart.stop />
		<span
			v-else
			class="cc-task-row__title"
			role="button"
			tabindex="0"
			:aria-label="`Rename ${summary}`"
			@click="startEdit"
			@keydown.enter.prevent="startEdit"
			@keydown.space.prevent="startEdit">
			{{ summary }}
		</span>
		<NcDateTimePickerNative
			class="cc-task-row__date cc-no-drag"
			:modelValue="dueDate"
			type="date"
			label="Due date"
			hideLabel
			clearable
			aria-label="Due date"
			@update:modelValue="setDue"
			@mousedown.stop
			@pointerdown.stop
			@touchstart.stop />
		<button
			v-if="dueDate"
			type="button"
			class="cc-task-row__clear-due cc-no-drag"
			aria-label="Clear due date"
			@click="clearDue"
			@mousedown.stop
			@pointerdown.stop
			@touchstart.stop>
			Clear due date
		</button>
		<NcActions
			class="cc-task-row__priority-menu cc-no-drag"
			menuName="Priority"
			:aria-label="`Priority: ${priorityLabel}`"
			@mousedown.stop
			@pointerdown.stop
			@touchstart.stop>
			<NcActionButton
				v-for="option in PRIORITY_OPTIONS"
				:key="option.value"
				class="cc-no-drag"
				@click="setPriority(option.value)"
				@mousedown.stop
				@pointerdown.stop
				@touchstart.stop>
				{{ option.label }}
			</NcActionButton>
		</NcActions>
		<a
			v-if="task"
			:href="tasksDeepLink"
			class="cc-task-open-in-tasks cc-no-drag"
			title="Open in Tasks"
			@mousedown.stop
			@pointerdown.stop
			@touchstart.stop>
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
	cursor: text;
}

.cc-task-row__title-input {
	flex: 1;
	min-width: 8rem;
}

.cc-task-row__date {
	max-width: 10rem;
}

.cc-task-row__clear-due {
	flex-shrink: 0;
	font-size: 0.85rem;
	color: var(--color-primary-element);
	background: none;
	border: none;
	cursor: pointer;
	padding: 0;
}

.cc-task-row__clear-due:hover {
	text-decoration: underline;
}

.cc-task-row__priority-menu {
	flex-shrink: 0;
}

.cc-task-open-in-tasks {
	font-size: 0.85rem;
	color: var(--color-primary-element);
	text-decoration: none;
	white-space: nowrap;
}

.cc-task-open-in-tasks:hover {
	text-decoration: underline;
}

.cc-no-drag {
	-webkit-touch-callout: default;
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
