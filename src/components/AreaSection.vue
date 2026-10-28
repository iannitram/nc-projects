<script setup>
import { mdiPlus } from '@mdi/js'
import { NcButton, NcIconSvgWrapper, NcTextField } from '@nextcloud/vue'
import { Sortable } from 'sortablejs-vue3'
import { computed, ref } from 'vue'
import DoneStrip from './DoneStrip.vue'
import ProjectCard from './ProjectCard.vue'
import { DRAG_OPTIONS, onSiblingDrop } from '../composables/useDrag.js'
import { areaSlug, isSomeday } from '../models/tree.js'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').AreaNode>} */
	area: { type: Object, required: true },
	/** Whether tasks/projects are currently loading */
	loading: { type: Boolean, default: false },
})

const store = useProjectsStore()
const newProject = ref('')
const creating = ref(false)
const newProjectInputRef = ref(null)

const sortableProjects = computed(() => {
	return (props.area?.projects || []).filter((project) => !isSomeday(project.task))
})

const somedayProjects = computed(() => {
	return (props.area?.projects || []).filter((project) => isSomeday(project.task))
})

const hasOpenProjects = computed(() => {
	return (props.area?.projects || []).length > 0
})

const sortOptions = computed(() => ({
	...DRAG_OPTIONS,
	group: { name: `cc-projects-${props.area?.name || 'none'}` },
}))

/**
 * Return a stable key for a project.
 *
 * @param {import('../models/tree.js').ProjectNode} project The project node
 * @return {string | null} Unique key
 */
function projectKey(project) {
	return project?.task?.uid || project?.task?.summary || null
}

/**
 * Put a dropped card back where Vue has it, so the store's list (after reorder,
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
 * Turn a finished drag into a reorder of projects in this area.
 *
 * @param {object} evt The sortable end event
 * @return {Promise<void> | undefined} The store's reorder, when the drop changed the order
 */
function onDrop(evt) {
	restoreDomPosition(evt)
	return onSiblingDrop(
		store,
		{
			parentUid: null,
			areaName: props.area?.name,
			allUids: sortableProjects.value.map((project) => project.task?.uid),
			visibleUids: sortableProjects.value.map((project) => project.task?.uid),
		},
		evt,
	)
}

/**
 * Create a new project in this area.
 *
 * @param {import('../models/tree.js').AreaNode} area The area
 */
async function createProject(area) {
	const summary = newProject.value.trim()
	if (!summary || creating.value) {
		return
	}
	creating.value = true
	try {
		await store.createProject(area.name, summary)
		newProject.value = ''
	} catch {
		// The store already showed the error toast; keep the typed title.
	} finally {
		creating.value = false
	}
}

/**
 * Clear the new project input field.
 */
function clearProject() {
	newProject.value = ''
}

/**
 * Focus the new project input field.
 */
function focusNewProject() {
	const el = newProjectInputRef.value?.$el?.querySelector('input') || newProjectInputRef.value
	el?.focus?.()
}

</script>

<template>
	<section :id="`area-${areaSlug(area.name)}`" class="cc-area-section">
		<div class="cc-area-section__header">
			<h3 class="cc-area-section__title">
				{{ area.name }}
			</h3>
			<span v-if="!loading && !hasOpenProjects" class="cc-area-section__meta">
				no open projects
			</span>
		</div>
		<div v-if="loading" class="cc-skeleton-rows" aria-busy="true">
			<div v-for="i in 3" :key="i" class="cc-skeleton-row" />
		</div>
		<div v-else-if="hasOpenProjects" class="cc-area-section__projects">
			<Sortable
				tag="div"
				class="cc-area-section__sortable"
				:list="sortableProjects"
				:itemKey="projectKey"
				:options="sortOptions"
				@end="onDrop">
				<template #item="{ element: project }">
					<ProjectCard
						:key="project.task?.uid || project.task?.summary"
						:project="project"
						:areaName="area.name" />
				</template>
			</Sortable>
			<ProjectCard
				v-for="project in somedayProjects"
				:key="project.task?.uid || project.task?.summary"
				:project="project"
				:areaName="area.name" />
		</div>
		<div v-else class="cc-area-section__empty">
			<p class="cc-area-section__empty-text">
				Nothing open in {{ area.name }}. Start a project, or tag an existing task as a project in Tasks.
			</p>
			<NcButton
				class="cc-area-section__empty-new-btn"
				@click="focusNewProject">
				<template #icon>
					<NcIconSvgWrapper :path="mdiPlus" :size="16" />
				</template>
				New project in {{ area.name }}
			</NcButton>
		</div>
		<DoneStrip :projects="area.done || []" />
		<NcTextField
			ref="newProjectInputRef"
			v-model="newProject"
			class="cc-area-section__new-project"
			placeholder="+ New project"
			:disabled="creating"
			@keydown.enter.prevent="createProject(area)"
			@keydown.esc="clearProject" />
	</section>
</template>

<style scoped>
.cc-area-section {
	margin-bottom: calc(var(--default-grid-baseline, 4px) * 6);
}

.cc-area-section__header {
	display: flex;
	align-items: baseline;
	gap: calc(var(--default-grid-baseline, 4px) * 2.5);
	margin-bottom: calc(var(--default-grid-baseline, 4px) * 3);
}

.cc-area-section__title {
	margin: 0;
	font-size: 1.25rem;
	font-weight: 600;
}

.cc-area-section__meta {
	font-size: 13px;
	color: var(--color-text-maxcontrast);
}

.cc-area-section__projects {
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline, 4px) * 3);
}

.cc-area-section__sortable {
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline, 4px) * 3);
}

.cc-area-section__empty {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	text-align: left;
	padding: calc(var(--default-grid-baseline, 4px) * 3) 0 calc(var(--default-grid-baseline, 4px) * 3) calc(var(--default-grid-baseline, 4px) * 1);
	gap: calc(var(--default-grid-baseline, 4px) * 1.5);
}

.cc-area-section__empty-text {
	margin: 0;
	color: var(--color-text-maxcontrast);
	font-size: 14px;
	text-wrap: pretty;
}

.cc-area-section__empty-new-btn {
	margin-top: calc(var(--default-grid-baseline, 4px) * 1);
}

.cc-skeleton-rows {
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	margin-bottom: calc(var(--default-grid-baseline, 4px) * 3);
}

.cc-skeleton-row {
	height: 44px;
	border-radius: var(--border-radius-element, 8px);
	background: var(--color-background-dark, #ededed);
	opacity: 0.6;
}
</style>
