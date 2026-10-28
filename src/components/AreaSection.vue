<script setup>
import { NcTextField } from '@nextcloud/vue'
import { Sortable } from 'sortablejs-vue3'
import { computed, ref } from 'vue'
import DoneStrip from './DoneStrip.vue'
import ProjectCard from './ProjectCard.vue'
import { DRAG_OPTIONS, onSiblingDrop } from '../composables/useDrag.js'
import { areaId, isSomeday } from '../models/tree.js'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').AreaNode>} */
	area: { type: Object, required: true },
})

const store = useProjectsStore()
const newProject = ref('')
const creating = ref(false)

const sortableProjects = computed(() => {
	return (props.area?.projects || []).filter((project) => !isSomeday(project.task))
})

const somedayProjects = computed(() => {
	return (props.area?.projects || []).filter((project) => isSomeday(project.task))
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

const sectionId = computed(() => {
	const allAreas = store?.areas || []
	const index = allAreas.findIndex((a) => a === props.area || a.name === props.area?.name)
	return areaId(props.area?.name, index >= 0 ? index : 0, allAreas)
})

</script>

<template>
	<section :id="sectionId" class="cc-area-section">
		<h3 class="cc-area-section__title">
			{{ area.name }}
		</h3>
		<div class="cc-area-section__projects">
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
		<DoneStrip :projects="area.done || []" />
		<NcTextField
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

.cc-area-section__title {
	margin-bottom: calc(var(--default-grid-baseline, 4px) * 3);
	font-size: 1.25rem;
	font-weight: 600;
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
</style>
