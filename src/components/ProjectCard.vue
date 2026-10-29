<script setup>
import { mdiChevronDown, mdiChevronRight, mdiDragVertical } from '@mdi/js'
import { NcActionButton, NcActionCheckbox, NcActionLink, NcActions, NcButton, NcCheckboxRadioSwitch, NcDialog, NcIconSvgWrapper, NcProgressBar } from '@nextcloud/vue'
import { getActivePinia } from 'pinia'
import { computed, nextTick, ref, toRaw, watch } from 'vue'
import AddTaskInput from './AddTaskInput.vue'
import { getTasksDeepLink } from './TaskRow.vue'
import TaskTree from './TaskTree.vue'
import { n } from '../services/l10n.js'
import { readProjectCollapsed, useProjectsStore } from '../store/projects.js'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').ProjectNode>} */
	project: { type: Object, required: true },
	areaName: { type: String, default: null },
})
const store = getActivePinia() ? useProjectsStore() : null

const isCompleted = computed(() => Boolean(props.project?.task?.completed) || props.project?.task?.status?.toUpperCase() === 'COMPLETED')

const confirmCompletion = ref(false)

// The rendered tree stops at three levels. Include the full store graph so
// confirmation and next due cover deeper tasks and tasks on other lists too.
const descendants = computed(() => {
	const tasks = new Map()
	const visit = (nodes) => {
		for (const node of nodes || []) {
			tasks.set(node.task.uid, node.task)
			visit(node.children)
		}
	}
	visit(props.project.children)
	const pending = [props.project.task.uid, ...tasks.keys()]
	const visited = new Set()
	const byParent = new Map()
	for (const task of Object.values(store?.tasksByUid || {})) {
		if (!byParent.has(task.parentUid)) {
			byParent.set(task.parentUid, [])
		}
		byParent.get(task.parentUid).push(task)
	}
	while (pending.length) {
		const uid = pending.shift()
		if (visited.has(uid)) {
			continue
		}
		visited.add(uid)
		for (const task of byParent.get(uid) || []) {
			if (task.uid === props.project.task.uid) {
				continue
			}
			tasks.set(task.uid, task)
			pending.push(task.uid)
		}
	}
	return [...tasks.values()]
})
const openTasks = computed(() => descendants.value.filter((task) => !task.closed
	&& !task.completed && !['COMPLETED', 'CANCELLED'].includes(task.status?.toUpperCase())))
const nextDue = computed(() => {
	const dates = openTasks.value.flatMap((task) => {
		if (!task.due) {
			return []
		}
		const due = toRaw(task.due)
		const date = due.toJSDate?.() ?? new Date(due)
		return Number.isNaN(date.getTime()) ? [] : [date]
	})
	return dates.sort((a, b) => a - b)[0]
})
const dueLabel = computed(() => nextDue.value?.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))

/**
 * Ask before completing open descendants.
 */
function checkOffProject() {
	if (openTasks.value.length) {
		confirmCompletion.value = true
	} else {
		useProjectsStore().setCompleted(props.project.task.uid, true)
	}
}

/**
 * Route checkbox changes through the same check-off path as the menu.
 */
function onCompletionChange() {
	if (isCompleted.value) {
		useProjectsStore().setCompleted(props.project.task.uid, false)
	} else {
		checkOffProject()
	}
}

/**
 * Complete the project after confirmation.
 */
function confirmCheckOff() {
	confirmCompletion.value = false
	useProjectsStore().setCompleted(props.project.task.uid, true)
}

/**
 * Keep the native checkbox in sync when confirmation defers the model change.
 *
 * @param {Event} event The checkbox change event
 */
async function syncCompletionCheckbox(event) {
	await nextTick()
	event.target.checked = isCompleted.value
}

const confirmationButtons = [
	{ label: 'Cancel', callback: () => { confirmCompletion.value = false } },
	{ label: 'Check off', variant: 'primary', callback: confirmCheckOff },
]

const progressDone = computed(() => Number(props.project?.progress?.done) || 0)
const progressTotal = computed(() => Number(props.project?.progress?.total) || 0)

const progressValue = computed(() => {
	if (progressTotal.value <= 0) {
		return 0
	}
	return Math.round((100 * progressDone.value) / progressTotal.value)
})

const progressText = computed(() => progressTotal.value ? `${progressDone.value} of ${progressTotal.value}` : 'No tasks yet')

/**
 * Read the show-done preference for a project from localStorage.
 *
 * @param {string | undefined | null} uid The project task UID
 * @return {boolean} Whether show-done is enabled (default false on failure/missing)
 */
function readStorage(uid) {
	if (!uid) {
		return false
	}
	try {
		const storage = typeof window !== 'undefined' ? window.localStorage : null
		return storage ? storage.getItem(`cc_projects:showDone:${uid}`) === '1' : false
	} catch {
		return false
	}
}

/**
 * Persist the show-done preference for a project to localStorage.
 *
 * @param {string | undefined | null} uid The project task UID
 * @param {boolean} val The new preference value
 * @return {boolean} Whether storage succeeded
 */
function writeStorage(uid, val) {
	if (!uid) {
		return false
	}
	try {
		const storage = typeof window !== 'undefined' ? window.localStorage : null
		if (!storage) {
			return false
		}
		storage.setItem(`cc_projects:showDone:${uid}`, val ? '1' : '0')
		return true
	} catch {
		return false
	}
}

const showDoneState = ref(readStorage(props.project?.task?.uid))

watch(
	() => props.project?.task?.uid,
	(newUid) => {
		showDoneState.value = readStorage(newUid)
	},
)

const showDone = computed({
	get() {
		return showDoneState.value
	},
	set(val) {
		const ok = writeStorage(props.project?.task?.uid, val)
		if (!ok) {
			showDoneState.value = false
		} else {
			showDoneState.value = val
		}
	},
})

const categories = computed(() => {
	const cats = props.project?.task?.categories
	return Array.isArray(cats) ? cats : []
})

const isBlocked = computed(() => {
	return categories.value.some((cat) => typeof cat === 'string' && cat.toLowerCase() === 'blocked')
})

const isSomeday = computed(() => {
	return categories.value.some((cat) => typeof cat === 'string' && cat.toLowerCase() === 'someday')
})

const updatingCategory = ref(false)

/**
 * Serialize menu edits while a category write is pending.
 *
 * @param {string} category the status category
 */
async function toggleCategory(category) {
	if (updatingCategory.value) {
		return
	}
	updatingCategory.value = true
	try {
		await store?.toggleCategory(props.project.task.uid, category)
	} finally {
		updatingCategory.value = false
	}
}

watch(() => props.project.task.uid, (uid) => {
	if (store && readProjectCollapsed(uid)) {
		store.collapsedProjects.add(uid)
	}
}, { immediate: true })

/** A conflict just reloaded the project task (issue 125): tint the band for a few seconds. */
const isConflictReloaded = computed(() => Boolean(store?.conflictReloaded[props.project.task.uid]))

const isCollapsed = computed(() => store?.collapsedProjects.has(props.project.task.uid) ?? false)

/**
 * Persist disclosure through the shared collapse store.
 */
function toggleCollapsed() {
	store?.toggleProjectCollapsed(props.project.task.uid)
}

</script>

<template>
	<div
		class="cc-project-card"
		:class="{ 'cc-project-card--someday': isSomeday }">
		<header
			class="cc-project-card__header drag-handle"
			:class="{ 'cc-conflict-reloaded': isConflictReloaded }"
			:data-uid="project.task?.uid">
			<span class="cc-project-card__grip" aria-hidden="true">
				<NcIconSvgWrapper :path="mdiDragVertical" :size="20" />
			</span>
			<NcButton
				class="cc-project-card__collapse cc-no-drag"
				variant="tertiary"
				:aria-label="`${isCollapsed ? 'Expand' : 'Collapse'} ${project.task.summary}`"
				:aria-expanded="!isCollapsed"
				@mousedown.stop
				@pointerdown.stop
				@touchstart.stop
				@click="toggleCollapsed">
				<template #icon>
					<NcIconSvgWrapper :path="isCollapsed ? mdiChevronRight : mdiChevronDown" :size="20" />
				</template>
			</NcButton>
			<NcCheckboxRadioSwitch
				class="cc-project-card__completion cc-no-drag"
				:modelValue="isCompleted"
				:aria-label="`Check off ${project.task.summary}`"
				@mousedown.stop
				@pointerdown.stop
				@touchstart.stop
				@change="syncCompletionCheckbox"
				@update:modelValue="onCompletionChange" />
			<div class="cc-project-card__heading">
				<h4 class="cc-project-card__title">
					{{ project.task.summary }}
				</h4>
				<span v-if="isBlocked" class="cc-project-card__badge cc-project-card__badge--blocked">blocked</span>
				<span v-if="isSomeday" class="cc-project-card__badge cc-project-card__badge--someday">someday</span>
				<time
					v-if="isCollapsed && nextDue"
					class="cc-project-card__due"
					:datetime="nextDue.toISOString()"
					:aria-label="`Next due ${dueLabel}`">{{ dueLabel }}</time>
			</div>
			<div class="cc-project-card__progress">
				<NcProgressBar
					v-if="progressTotal > 0"
					class="cc-project-card__progress-bar"
					:value="progressValue"
					ariaLabel="Project progress"
					size="small" />
				<span class="cc-project-card__progress-text">{{ progressText }}</span>
			</div>
			<NcActions
				class="cc-project-card__menu cc-no-drag"
				:aria-label="`Actions for ${project.task.summary}`"
				@mousedown.stop
				@pointerdown.stop
				@touchstart.stop>
				<NcActionCheckbox v-model="showDone" class="cc-project-card__show-done">
					Show done tasks ({{ progressDone }})
				</NcActionCheckbox>
				<NcActionButton class="cc-project-card__check-off" @click="checkOffProject">
					Check off project…
				</NcActionButton>
				<NcActionButton :disabled="updatingCategory" @click="toggleCategory('blocked')">
					{{ isBlocked ? 'Unmark blocked' : 'Mark blocked' }}
				</NcActionButton>
				<NcActionButton :disabled="updatingCategory" @click="toggleCategory('someday')">
					{{ isSomeday ? 'Move out of Someday' : 'Move to Someday' }}
				</NcActionButton>
				<NcActionLink :href="getTasksDeepLink(project.task)">
					Open in Tasks
				</NcActionLink>
			</NcActions>
		</header>
		<div v-if="!isCollapsed" class="cc-project-card__content">
			<TaskTree
				:nodes="project.children || []"
				:showDone="showDone"
				:areaName="areaName"
				:projectUid="project.task?.uid" />
			<AddTaskInput
				v-model:showDone="showDone"
				:projectUid="project.task?.uid"
				:doneCount="progressDone" />
		</div>
		<NcDialog
			v-if="confirmCompletion"
			v-model:open="confirmCompletion"
			name="Check off project"
			:message="`Check off ${project.task.summary} and its ${n('%n open task', '%n open tasks', openTasks.length)}?`"
			:buttons="confirmationButtons" />
	</div>
</template>

<style scoped>
.cc-project-card {
	min-width: 0;
}

.cc-project-card__header {
	display: grid;
	grid-template-columns: 20px auto auto minmax(0, 1fr) auto auto;
	align-items: center;
	gap: 4px;
	padding: 4px 8px;
	border-radius: var(--border-radius-large);
	background: var(--color-background-hover);
}

.cc-project-card--someday .cc-project-card__header {
	background: transparent;
}

.cc-project-card--someday .cc-project-card__title {
	color: var(--color-text-maxcontrast);
}

.cc-project-card__heading {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	min-width: 0;
}

.cc-project-card__title {
	margin: 0;
	font-size: 16px;
	font-weight: 600;
	overflow-wrap: anywhere;
}

.cc-project-card__progress {
	display: flex;
	align-items: center;
	gap: 8px;
}

.cc-project-card__progress-bar {
	width: 64px;
}

.cc-project-card__progress-text,
.cc-project-card__due {
	font-size: 13px;
	color: var(--color-text-maxcontrast);
	white-space: nowrap;
}

.cc-project-card__badge {
	font-size: 12px;
	padding: 2px 6px;
	border-radius: var(--border-radius-pill);
	font-weight: 500;
}

.cc-project-card__badge--blocked {
	/* Error text on a light error tint: --color-error-text is the theme's readable error colour on
	   the page background, in light and dark (#145). */
	background-color: color-mix(in srgb, var(--color-error) 12%, var(--color-main-background));
	color: var(--color-error-text);
}

.cc-project-card__badge--someday {
	background-color: var(--color-background-dark);
	color: var(--color-text-maxcontrast);
}

/* Hover controls as in nc-outliner: faded out, the grip rests at 0.6 on hover or focus. */
.cc-project-card__grip {
	opacity: 0;
	transition: var(--cc-hover-reveal, opacity 0.15s);
	cursor: grab;
}

/* Keep the menu button focusable while its icon waits for hover or focus. */
.cc-project-card__menu :deep(.action-item__menutoggle > *) {
	opacity: 0;
	transition: var(--cc-hover-reveal, opacity 0.15s);
}

.cc-project-card__header:hover .cc-project-card__grip,
.cc-project-card__header:focus-within .cc-project-card__grip {
	opacity: var(--cc-grip-rest-opacity, 0.6);
}

.cc-project-card__grip:hover,
.cc-project-card__header:hover .cc-project-card__menu :deep(.action-item__menutoggle > *),
.cc-project-card__header:focus-within .cc-project-card__menu :deep(.action-item__menutoggle > *) {
	opacity: 1;
}

/* Phone and touch layout of the header: projects.css (issue 123). */
</style>
