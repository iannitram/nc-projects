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
import { mdiDotsHorizontal } from '@mdi/js'
import { NcActionButton, NcActionInput, NcActionLink, NcActionRadio, NcActions, NcActionSeparator, NcCheckboxRadioSwitch, NcIconSvgWrapper, NcTextField } from '@nextcloud/vue'
import { getActivePinia } from 'pinia'
import { computed, nextTick, ref, toRaw } from 'vue'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').TaskNode>} */
	node: { type: Object, required: true },
})
/**
 *
 */
function onCompletionChange() {
	useProjectsStore().setCompleted(props.node?.task?.uid, !isCompleted.value)
}

const PRIORITY_OPTIONS = [
	{ value: 1, level: 'high', label: 'High' },
	{ value: 5, level: 'medium', label: 'Medium' },
	{ value: 9, level: 'low', label: 'Low' },
	{ value: 0, level: 'none', label: 'None' },
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

/** A conflict just reloaded this task (#125): tint the row for a few seconds. */
const isConflictReloaded = computed(() => {
	const uid = task.value?.uid
	return Boolean(uid && getActivePinia() && useProjectsStore().conflictReloaded[uid])
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

/** The priority bucket as Tasks reads it: 1-4 high, 5 medium, 6-9 low, anything else none. */
const priorityLevel = computed(() => {
	const value = Number(task.value?.priority)
	if (value >= 1 && value <= 4) {
		return 'high'
	}
	if (value === 5) {
		return 'medium'
	}
	if (value >= 6 && value <= 9) {
		return 'low'
	}
	return 'none'
})

/** The due date as a short chip ("Fri 31 Oct"), and whether it is past (open tasks only). */
const dueLabel = computed(() => dueDate.value?.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) ?? '')
const isOverdue = computed(() => {
	if (!dueDate.value || isCompleted.value) {
		return false
	}
	const endOfDueDay = new Date(dueDate.value)
	endOfDueDay.setHours(23, 59, 59, 999)
	return endOfDueDay.getTime() < Date.now()
})

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
		:class="{ 'is-completed': isCompleted, 'cc-conflict-reloaded': isConflictReloaded, [`cc-task-row--priority-${priorityLevel}`]: true }">
		<NcCheckboxRadioSwitch
			class="cc-task-row__checkbox"
			:class="`cc-task-row__checkbox--${priorityLevel}`"
			:isChecked="isCompleted"
			:modelValue="isCompleted"
			:aria-label="isCompleted ? `Reopen ${summary}` : `Check off ${summary}`"
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
		<span
			v-if="dueDate"
			class="cc-task-row__due"
			:class="{ 'is-overdue': isOverdue }">
			{{ dueLabel }}<span v-if="isOverdue" class="hidden-visually"> (overdue)</span>
		</span>
		<a
			v-if="node.deeper && node.deeper > 0"
			:href="tasksDeepLink"
			class="cc-task-deeper cc-no-drag"
			@mousedown.stop
			@pointerdown.stop
			@touchstart.stop>
			{{ node.deeper }} more {{ node.deeper === 1 ? 'level' : 'levels' }} in Tasks
		</a>
		<NcActions
			class="cc-task-row__menu cc-no-drag"
			:aria-label="`Actions for ${summary}`"
			@mousedown.stop
			@pointerdown.stop
			@touchstart.stop>
			<template #icon>
				<NcIconSvgWrapper :path="mdiDotsHorizontal" :size="20" />
			</template>
			<NcActionInput
				class="cc-no-drag"
				type="date"
				label="Due date…"
				:modelValue="dueDate"
				@update:modelValue="setDue"
				@mousedown.stop
				@pointerdown.stop
				@touchstart.stop>
				Due date…
			</NcActionInput>
			<NcActionButton
				v-if="dueDate"
				class="cc-no-drag"
				@click="clearDue"
				@mousedown.stop
				@pointerdown.stop
				@touchstart.stop>
				Clear due date
			</NcActionButton>
			<NcActionSeparator />
			<NcActionRadio
				v-for="option in PRIORITY_OPTIONS"
				:key="option.value"
				class="cc-no-drag"
				name="cc-task-priority"
				:modelValue="priorityLevel"
				:value="option.level"
				@update:modelValue="setPriority(option.value)"
				@mousedown.stop
				@pointerdown.stop
				@touchstart.stop>
				{{ option.label }}
			</NcActionRadio>
			<NcActionSeparator />
			<!-- "Move to project…" goes here (the dialog is #120, cluster P3). -->
			<NcActionLink
				v-if="task"
				class="cc-no-drag cc-task-open-in-tasks"
				:href="tasksDeepLink"
				@mousedown.stop
				@pointerdown.stop
				@touchstart.stop>
				Open in Tasks
			</NcActionLink>
		</NcActions>
	</div>
</template>

<style scoped>
.cc-task-row {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	min-height: var(--cc-row-height, var(--default-clickable-area, 44px));
	padding: 0 6px;
	border-radius: var(--border-radius-element, 4px);
	flex: 1;
	min-width: 0;
}

.cc-task-row:hover,
.cc-task-row:focus-within {
	background: var(--color-background-hover);
}

.cc-task-row.is-completed .cc-task-row__title {
	text-decoration: line-through;
	color: var(--color-text-maxcontrast);
}

/*
 * Priority ring, as in Tasks. NcCheckboxRadioSwitch draws the box as an inline
 * SVG that carries its own fill, so colour the SVG and its path (not only the
 * wrapper). Strong text-level variables: --color-error is a pale tint here.
 * The checked state is left alone.
 */
.cc-task-row__checkbox--high,
.cc-task-row__checkbox--medium,
.cc-task-row__checkbox--low {
	--cc-priority-color: var(--color-primary-element);
}

.cc-task-row__checkbox--high {
	--cc-priority-color: var(--color-error-text);
}

.cc-task-row__checkbox--medium {
	--cc-priority-color: var(--color-warning-text);
}

.cc-task-row__checkbox--low {
	--cc-priority-color: var(--color-primary-element);
}

.cc-task-row__checkbox--high :deep(.checkbox-content__icon:not(.checkbox-content__icon--checked) svg),
.cc-task-row__checkbox--medium :deep(.checkbox-content__icon:not(.checkbox-content__icon--checked) svg),
.cc-task-row__checkbox--low :deep(.checkbox-content__icon:not(.checkbox-content__icon--checked) svg),
.cc-task-row__checkbox--high :deep(.checkbox-content__icon:not(.checkbox-content__icon--checked) svg path),
.cc-task-row__checkbox--medium :deep(.checkbox-content__icon:not(.checkbox-content__icon--checked) svg path),
.cc-task-row__checkbox--low :deep(.checkbox-content__icon:not(.checkbox-content__icon--checked) svg path) {
	color: var(--cc-priority-color);
	fill: var(--cc-priority-color);
}

/* Priority ring, as in Tasks: high, medium, low. Theme variables only. */
.cc-task-row__checkbox--high :deep(.checkbox-content__icon:not(.checkbox-content__icon--checked)) {
	color: var(--color-error);
}

.cc-task-row__checkbox--medium :deep(.checkbox-content__icon:not(.checkbox-content__icon--checked)) {
	color: var(--color-warning);
}

.cc-task-row__checkbox--low :deep(.checkbox-content__icon:not(.checkbox-content__icon--checked)) {
	color: var(--color-primary-element);
}

.cc-task-row__title {
	flex: 1;
	min-width: 0;
	font-size: 0.95rem;
	cursor: text;
}

.cc-task-row__title-input {
	flex: 1;
	min-width: 8rem;
}

/* Same height as the row, so the list does not jump while renaming. */
.cc-task-row__title-input :deep(input) {
	height: var(--default-clickable-area, 44px);
	margin: 0;
}

.cc-task-row__due {
	flex-shrink: 0;
	font-size: 0.85rem;
	white-space: nowrap;
	color: var(--color-text-maxcontrast);
}

.cc-task-row__due.is-overdue {
	color: var(--color-error-text);
	font-weight: 600;
}

/* The menu shows on hover or focus with a pointer; always on touch (projects.css, #123). */
.cc-task-row__menu {
	flex-shrink: 0;
	visibility: hidden;
}

.cc-task-row:hover .cc-task-row__menu,
.cc-task-row:focus-within .cc-task-row__menu,
.cc-task-row__menu:has([aria-expanded='true']) {
	visibility: visible;
}

.cc-no-drag {
	-webkit-touch-callout: default;
}

.cc-task-deeper {
	flex-shrink: 0;
	font-size: 0.85rem;
	color: var(--color-text-maxcontrast);
	text-decoration: none;
	white-space: nowrap;
}

.cc-task-deeper:hover,
.cc-task-deeper:focus-visible {
	color: var(--color-main-text);
	text-decoration: underline;
}
</style>
