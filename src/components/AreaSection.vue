<script setup>
import { NcTextField } from '@nextcloud/vue'
import Sortable, { VuedraggableNext as Draggable } from 'sortablejs-vue3'
import { ref } from 'vue'
import DoneStrip from './DoneStrip.vue'
import ProjectCard from './ProjectCard.vue'
import { DRAG_OPTIONS } from '../composables/useDrag.js'
import { isSomeday } from '../models/tree.js'
import { useProjectsStore } from '../store/projects.js'

defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').AreaNode>} */
	area: { type: Object, required: true },
})

const store = useProjectsStore()
const newProject = ref('')
const creating = ref(false)

/**
 *
 * @param area
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
 *
 */
function clearProject() {
	newProject.value = ''
}

</script>

<template>
	<section class="cc-area-section">
		<h3 class="cc-area-section__title">
			{{ area.name }}
		</h3>
		<div class="cc-area-section__projects">
			<Draggable
				v-model="area.projects"
				:options="DRAG_OPTIONS"
				itemKey="task.uid"
				tag="div"
				class="sortable-list"
				handle=".drag-handle"
				@end="() => {
					// When a project is dropped, reorder it in the store
					const uids = area.projects.filter(p => !isSomeday(p.task)).map(p => p.task.uid)
					if (uids.length < 2) return

					// Find where each moved item went and update order accordingly
					for (let i = 0; i < uids.length; i++) {
						const uid = uids[i]
						const projectIndex = area.projects.findIndex(p => p.task.uid === uid)
						if (projectIndex !== -1 && projectIndex !== i) {
							store.reorder(null, area.name, uid, i)
							break
						}
					}
				}">
				<template #item="{element}">
					<ProjectCard
						:project="element"
						class="sortable-item" />
				</template>
			</Draggable>
		</div>
		<DoneStrip :projects="area.done || []" />
		<NcTextField
			v-model="newProject"
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

.sortable-list {
	width: 100%;
}

.sortable-item {
	width: 100%;
}
</style>
