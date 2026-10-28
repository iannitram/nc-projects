<script setup>
import { mdiCheck, mdiInformationOutline } from '@mdi/js'
import { NcButton, NcDialog, NcIconSvgWrapper, NcTextField } from '@nextcloud/vue'
import { computed, ref } from 'vue'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	open: { type: Boolean, default: false },
	/** @type {import('vue').PropType<import('../models/Task.js').Task>} */
	task: { type: Object, default: null },
	container: { type: [String, Object], default: 'body' },
})

const emit = defineEmits(['close', 'update:open'])

const store = useProjectsStore()

const searchQuery = ref('')
const selectedProjectUid = ref('')

/**
 * Get display name of list for a task.
 *
 * @param {import('../models/Task.js').Task} task task to inspect
 * @return {string}
 */
function getTaskListName(task) {
	if (!task) {
		return ''
	}
	if (task.listName) {
		return task.listName
	}
	if (task.calendarName) {
		return task.calendarName
	}
	if (task.calendarUrl && store.areas) {
		const normalized = task.calendarUrl.replace(/\/+$/, '')
		const area = store.areas.find((a) => (a.calendarUrl || '').replace(/\/+$/, '') === normalized)
		if (area?.name) {
			return area.name
		}
	}
	if (task.parentUid && store.tasksByUid) {
		const parent = store.tasksByUid[task.parentUid]
		if (parent) {
			return getTaskListName(parent)
		}
	}
	return ''
}

/**
 * Get display name of list for a project.
 *
 * @param {import('../models/tree.js').ProjectNode} project project node
 * @return {string}
 */
function getProjectListName(project) {
	for (const area of store.areas || []) {
		if (area.projects?.some((p) => p.task?.uid === project.task?.uid)) {
			return area.name
		}
		if (area.done?.some((p) => p.task?.uid === project.task?.uid)) {
			return area.name
		}
	}
	if (project.task?.calendarUrl && store.areas) {
		const normalized = project.task.calendarUrl.replace(/\/+$/, '')
		const area = store.areas.find((a) => (a.calendarUrl || '').replace(/\/+$/, '') === normalized)
		if (area?.name) {
			return area.name
		}
	}
	return project.task?.listName || project.task?.calendarName || ''
}

/**
 * Recursively count subtasks under a task.
 *
 * @param {import('../models/Task.js').Task} task task to inspect
 * @return {number}
 */
function getSubtaskCount(task) {
	if (!task?.uid || !store.tasksByUid) {
		return 0
	}
	let count = 0
	const queue = [task.uid]
	const visited = new Set(queue)
	const allTasks = Object.values(store.tasksByUid)
	while (queue.length > 0) {
		const currentId = queue.shift()
		for (const t of allTasks) {
			if (t.parentUid === currentId && !visited.has(t.uid)) {
				visited.add(t.uid)
				queue.push(t.uid)
				count++
			}
		}
	}
	return count
}

/**
 * Find the project UID the task currently belongs to.
 */
const currentProjectUid = computed(() => {
	if (!props.task) {
		return null
	}
	let currentUid = props.task.parentUid
	const visited = new Set()
	while (currentUid && !visited.has(currentUid)) {
		visited.add(currentUid)
		for (const area of store.areas || []) {
			const found = [...(area.projects || []), ...(area.done || [])].find((p) => p.task?.uid === currentUid)
			if (found) {
				return found.task.uid
			}
		}
		const parent = store.tasksByUid?.[currentUid]
		if (!parent) {
			break
		}
		currentUid = parent.parentUid
	}
	return null
})

/**
 * Check if a project is the task's current project.
 *
 * @param {import('../models/tree.js').ProjectNode} project project to test
 * @return {boolean}
 */
function isCurrentProject(project) {
	return project.task?.uid === currentProjectUid.value
}

/**
 * Filter open projects by area and search query.
 */
const filteredAreas = computed(() => {
	const query = searchQuery.value.trim().toLowerCase()
	const results = []
	for (const area of store.areas || []) {
		const openProjects = area.projects || []
		const matching = openProjects.filter((p) => {
			if (!query) {
				return true
			}
			return (p.task?.summary || '').toLowerCase().includes(query)
		})
		if (matching.length > 0) {
			results.push({
				name: area.name,
				projects: matching,
			})
		}
	}
	return results
})

/**
 * Currently selected project node.
 */
const selectedProject = computed(() => {
	if (!selectedProjectUid.value) {
		return null
	}
	for (const area of store.areas || []) {
		const found = (area.projects || []).find((p) => p.task?.uid === selectedProjectUid.value)
		if (found) {
			return found
		}
	}
	return null
})

/**
 * Determine if target project is on the same list as the task.
 */
const isSameList = computed(() => {
	if (!props.task || !selectedProject.value) {
		return false
	}
	const taskCal = props.task.calendarUrl?.replace(/\/+$/, '')
	const projCal = selectedProject.value.task?.calendarUrl?.replace(/\/+$/, '')
	if (taskCal && projCal && taskCal === projCal) {
		return true
	}
	const taskList = getTaskListName(props.task)
	const projList = getProjectListName(selectedProject.value)
	if (taskList && projList && taskList === projList) {
		return true
	}
	return false
})

/**
 * Consequence sentence explaining the move.
 */
const consequenceLine = computed(() => {
	if (!selectedProject.value || !props.task) {
		return ''
	}
	const targetTitle = selectedProject.value.task?.summary || ''
	const targetListName = getProjectListName(selectedProject.value)
	const sourceListName = getTaskListName(props.task)

	const subtasks = getSubtaskCount(props.task)
	const subtaskPhrase = subtasks > 0
		? `, with its ${subtasks} ${subtasks === 1 ? 'subtask' : 'subtasks'}`
		: ''

	if (isSameList.value) {
		return `Moves under '${targetTitle}'. It stays on the ${targetListName || sourceListName} list${subtaskPhrase}.`
	}
	return `Moves under '${targetTitle}' and to the ${targetListName} list${subtaskPhrase}.`
})

/**
 * Select a project if not disabled.
 *
 * @param {import('../models/tree.js').ProjectNode} project project to select
 */
function selectProject(project) {
	if (!isCurrentProject(project)) {
		selectedProjectUid.value = project.task.uid
	}
}

/**
 * Close the dialog without performing any action.
 */
function onCancel() {
	emit('close')
	emit('update:open', false)
}

/**
 * Execute the move and close on success.
 */
async function onMove() {
	if (!selectedProject.value || !props.task?.uid) {
		return
	}
	try {
		const targetChildren = selectedProject.value.children || []
		await store.moveToProject(props.task.uid, selectedProject.value.task.uid, targetChildren.length)
		emit('close')
		emit('update:open', false)
	} catch {
		// Error is shown by the store toast, dialog stays open.
	}
}
</script>

<template>
	<NcDialog
		:open="open"
		name="Move to project"
		size="normal"
		:container="container"
		:closeOnClickOutside="false"
		@closing="onCancel"
		@update:open="(val) => { if (!val) onCancel() }">
		<div class="cc-move-to-project" @keydown.esc.stop="onCancel">
			<NcTextField
				v-model="searchQuery"
				class="cc-move-to-project__search"
				label="Find a project"
				placeholder="Find a project"
				autofocus />

			<div class="cc-move-to-project__list-container" role="region" aria-label="Available projects">
				<div
					v-for="area in filteredAreas"
					:key="area.name"
					class="cc-move-to-project__area-group">
					<div class="cc-move-to-project__area-title" role="heading" aria-level="3">
						{{ area.name }}
					</div>
					<ul class="cc-move-to-project__projects" role="radiogroup" :aria-label="area.name">
						<li
							v-for="project in area.projects"
							:key="project.task.uid"
							class="cc-move-to-project__item">
							<label
								class="cc-move-to-project__row"
								:class="{
									'is-selected': selectedProjectUid === project.task.uid,
									'is-disabled': isCurrentProject(project),
								}"
								:for="`move-target-${project.task.uid}`"
								@click="selectProject(project)">
								<input
									:id="`move-target-${project.task.uid}`"
									v-model="selectedProjectUid"
									type="radio"
									name="target-project"
									:value="project.task.uid"
									:disabled="isCurrentProject(project)"
									class="cc-move-to-project__radio"
									@keydown.enter.prevent="selectProject(project)"
									@keydown.space.prevent="selectProject(project)">
								<span class="cc-move-to-project__label">{{ project.task.summary }}</span>
								<span class="cc-move-to-project__meta">
									{{ project.progress?.done ?? 0 }} of {{ project.progress?.total ?? 0 }}
								</span>
								<NcIconSvgWrapper
									v-if="selectedProjectUid === project.task.uid"
									class="cc-move-to-project__check"
									:path="mdiCheck"
									:size="16" />
							</label>
						</li>
					</ul>
				</div>
			</div>

			<div v-if="consequenceLine" class="cc-move-to-project__consequence" role="status">
				<NcIconSvgWrapper
					class="cc-move-to-project__info-icon"
					:path="mdiInformationOutline"
					:size="16" />
				<span>{{ consequenceLine }}</span>
			</div>
		</div>

		<template #actions>
			<NcButton @click="onCancel">
				Cancel
			</NcButton>
			<NcButton
				variant="primary"
				:disabled="!selectedProject"
				@click="onMove"
				@keydown.enter.prevent="onMove">
				Move
			</NcButton>
		</template>
	</NcDialog>
</template>

<style scoped>
.cc-move-to-project {
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	min-width: 320px;
	max-width: 480px;
}

.cc-move-to-project__search {
	margin-bottom: calc(var(--default-grid-baseline, 4px) * 1);
}

.cc-move-to-project__list-container {
	max-height: 360px;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
}

.cc-move-to-project__area-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--color-text-maxcontrast);
	padding: calc(var(--default-grid-baseline, 4px) * 2) calc(var(--default-grid-baseline, 4px) * 2) calc(var(--default-grid-baseline, 4px) * 0.5);
}

.cc-move-to-project__projects {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.cc-move-to-project__item {
	display: flex;
	align-items: stretch;
}

.cc-move-to-project__row {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2.5);
	min-height: var(--default-clickable-area, 40px);
	padding: 0 calc(var(--default-grid-baseline, 4px) * 2.5);
	border-radius: var(--border-radius-element);
	width: 100%;
	box-sizing: border-box;
	cursor: pointer;
	color: var(--color-main-text);
}

.cc-move-to-project__row:hover:not(.is-disabled) {
	background-color: var(--color-background-hover);
}

.cc-move-to-project__row.is-selected {
	background-color: var(--color-primary-element-light);
	color: var(--color-primary-element-light-text);
	font-weight: 600;
}

.cc-move-to-project__row.is-disabled {
	color: var(--color-text-maxcontrast);
	cursor: not-allowed;
	opacity: 0.6;
}

.cc-move-to-project__radio {
	accent-color: var(--color-primary-element);
	cursor: pointer;
	margin: 0;
}

.cc-move-to-project__row.is-disabled .cc-move-to-project__radio {
	cursor: not-allowed;
}

.cc-move-to-project__label {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.cc-move-to-project__meta {
	font-size: 13px;
	color: var(--color-text-maxcontrast);
	font-weight: 400;
	white-space: nowrap;
}

.cc-move-to-project__row.is-selected .cc-move-to-project__meta {
	color: inherit;
}

.cc-move-to-project__check {
	flex-shrink: 0;
	color: var(--color-primary-element);
}

.cc-move-to-project__consequence {
	margin-top: calc(var(--default-grid-baseline, 4px) * 2);
	padding: calc(var(--default-grid-baseline, 4px) * 2.5) calc(var(--default-grid-baseline, 4px) * 3);
	border-radius: var(--border-radius-element);
	background-color: var(--color-band, var(--color-background-hover));
	font-size: 13px;
	color: var(--color-main-text);
	display: flex;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	align-items: flex-start;
	line-height: 1.4;
}

.cc-move-to-project__info-icon {
	flex-shrink: 0;
	margin-top: 2px;
	color: var(--color-text-maxcontrast);
}
</style>
