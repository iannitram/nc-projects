<script setup>
import { mdiPlus, mdiUnfoldLessHorizontal, mdiUnfoldMoreHorizontal } from '@mdi/js'
import { NcButton, NcIconSvgWrapper, NcSelect, NcTextField } from '@nextcloud/vue'
import { getActivePinia } from 'pinia'
import { computed, ref } from 'vue'
import { useProjectsStore } from '../store/projects.js'

const store = getActivePinia() ? useProjectsStore() : null

const isCreating = ref(false)
const chosenArea = ref(null)
const newProjectTitle = ref('')
const creating = ref(false)

const totalProjects = computed(() => {
	if (!store) {
		return 0
	}
	if (typeof store.totalOpenProjects === 'number') {
		return store.totalOpenProjects
	}
	return typeof store.openProjectCount === 'function' ? store.openProjectCount() : 0
})

const projectCountText = computed(() => {
	const count = totalProjects.value
	return `${count} ${count === 1 ? 'project' : 'projects'}`
})

const anyProjectExpanded = computed(() => {
	const projects = (store?.areas || []).flatMap((area) => area.projects || [])
	if (projects.length === 0) {
		return false
	}
	return projects.some((project) => !store?.collapsedProjects?.has(project.task?.uid))
})

const collapseLabel = computed(() => (anyProjectExpanded.value ? 'Collapse all' : 'Expand all'))
const collapseIcon = computed(() => (anyProjectExpanded.value ? mdiUnfoldLessHorizontal : mdiUnfoldMoreHorizontal))

/**
 * Toggle collapse state across all projects.
 */
function onToggleCollapse() {
	if (!store) {
		return
	}
	if (anyProjectExpanded.value) {
		store.collapseAll()
	} else {
		store.expandAll()
	}
}

const areaOptions = computed(() => {
	const areas = store?.areas || []
	return areas.map((area) => ({
		id: area.name,
		label: area.name,
	}))
})

/**
 * Open the new project creation form.
 */
function openNewProject() {
	isCreating.value = true
	chosenArea.value = null
	newProjectTitle.value = ''
}

/**
 * Cancel project creation and close form.
 */
function cancelNewProject() {
	isCreating.value = false
	chosenArea.value = null
	newProjectTitle.value = ''
	creating.value = false
}

/**
 * Handle area selection.
 *
 * @param {string | { id?: string, label?: string, name?: string } | null} val The selected option
 */
function onSelectArea(val) {
	if (!val) {
		chosenArea.value = null
		return
	}
	chosenArea.value = typeof val === 'object' ? (val.id || val.label || val.name || String(val)) : String(val)
}

/**
 * Submit and create new project.
 */
async function submitNewProject() {
	const summary = newProjectTitle.value.trim()
	if (!summary || !chosenArea.value || creating.value || !store) {
		return
	}
	creating.value = true
	try {
		await store.createProject(chosenArea.value, summary)
		cancelNewProject()
	} catch {
		// The store already showed the error toast; keep the typed title.
	} finally {
		creating.value = false
	}
}
</script>

<template>
	<div class="cc-top-bar">
		<h1 class="cc-top-bar__title">
			All areas
		</h1>
		<span class="cc-top-bar__meta">
			{{ projectCountText }}
		</span>
		<div class="cc-top-bar__spacer" />
		<div class="cc-top-bar__actions" :class="{ 'cc-top-bar__actions--creating': isCreating }">
			<NcButton
				class="cc-top-bar__collapse-btn"
				variant="tertiary"
				:aria-label="collapseLabel"
				:title="collapseLabel"
				@click="onToggleCollapse">
				<template #icon>
					<NcIconSvgWrapper :path="collapseIcon" :size="20" />
				</template>
			</NcButton>

			<!-- Creation area: closed state -->
			<NcButton
				v-if="!isCreating"
				class="cc-top-bar__new-project-btn"
				variant="primary"
				aria-label="New project"
				title="New project"
				@click="openNewProject">
				<template #icon>
					<NcIconSvgWrapper :path="mdiPlus" :size="20" />
				</template>
				<span class="cc-top-bar__new-label">New project</span>
			</NcButton>

			<!-- Creation area: pick an area -->
			<div
				v-else-if="!chosenArea"
				class="cc-top-bar__area-picker">
				<NcSelect
					class="cc-top-bar__select"
					:options="areaOptions"
					:modelValue="chosenArea"
					placeholder="Select area"
					aria-label="Select area"
					@update:modelValue="onSelectArea"
					@keydown.esc="cancelNewProject" />
				<NcButton
					aria-label="Cancel"
					@click="cancelNewProject">
					Cancel
				</NcButton>
			</div>

			<!-- Creation area: enter title -->
			<div
				v-else
				class="cc-top-bar__title-form">
				<NcTextField
					v-model="newProjectTitle"
					class="cc-top-bar__title-input"
					:placeholder="`New project in ${chosenArea}`"
					aria-label="New project title"
					:disabled="creating"
					autofocus
					@keydown.enter.prevent="submitNewProject"
					@keydown.esc="cancelNewProject" />
				<NcButton
					aria-label="Cancel"
					:disabled="creating"
					@click="cancelNewProject">
					Cancel
				</NcButton>
			</div>
		</div>
	</div>
</template>

<style scoped>
.cc-top-bar {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	min-height: var(--cc-top-bar-height, 52px);
	/* clear the navigation toggle (absolutely positioned over the content's top-left) */
	padding: 0 0 0 calc(var(--default-clickable-area, 34px) + var(--default-grid-baseline, 4px) * 2);
	border-bottom: 1px solid var(--color-border);
	flex: none;
	box-sizing: border-box;
	background: var(--color-main-background);
}

.cc-top-bar__title {
	font-size: 20px;
	font-weight: 650;
	margin: 0;
	line-height: 1.2;
	/* One line: at 390 px "All areas" must not wrap; a long title ends in an ellipsis. */
	min-width: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	color: var(--color-main-text);
}

.cc-top-bar__meta {
	color: var(--color-text-maxcontrast);
	font-size: 14px;
	white-space: nowrap;
	/* The count gives way before the title does. */
	min-width: 0;
	flex-shrink: 4;
	overflow: hidden;
	text-overflow: ellipsis;
}

.cc-top-bar__spacer {
	flex: 1;
}

.cc-top-bar__actions {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
}

.cc-top-bar__area-picker,
.cc-top-bar__title-form {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
}

.cc-top-bar__select {
	min-width: 160px;
}

.cc-top-bar__title-input {
	min-width: 200px;
}

@media (max-width: 600px) {
	.cc-top-bar {
		min-height: var(--cc-top-bar-height, 52px);
		padding: 0 calc(var(--default-grid-baseline, 4px) * 1.5) 0 calc(var(--default-clickable-area, 34px) + var(--default-grid-baseline, 4px) * 2);
		gap: calc(var(--default-grid-baseline, 4px) * 0.5);
	}

	.cc-top-bar__title {
		font-size: 18px;
	}

	.cc-top-bar__select {
		min-width: 120px;
	}

	.cc-top-bar__title-input {
		min-width: 140px;
	}
}

/* Narrow phones: "New project" is icon-only (its aria-label and title stay), so the title and
   the count fit on one line and the button never cuts into them. */
@media (max-width: 420px) {
	.cc-top-bar__new-label {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.cc-top-bar__new-project-btn {
		width: 44px;
		min-width: 44px;
		height: 44px;
		min-height: 44px;
		padding: 0;
		flex-shrink: 0;
	}
}

/* While the creation form is open on a phone it takes its own full-width line. */
@media (max-width: 600px) {
	.cc-top-bar {
		flex-wrap: wrap;
	}

	.cc-top-bar__actions--creating {
		flex: 1 0 100%;
		min-width: 0;
		padding-bottom: calc(var(--default-grid-baseline, 4px) * 2);
	}

	.cc-top-bar__actions--creating .cc-top-bar__select,
	.cc-top-bar__actions--creating .cc-top-bar__title-input {
		min-width: 0;
		flex: 1;
	}

	.cc-top-bar__area-picker,
	.cc-top-bar__title-form {
		flex: 1;
		min-width: 0;
	}
}
</style>
