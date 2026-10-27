<script setup>
import { NcTextField } from '@nextcloud/vue'
import { ref } from 'vue'
import ProjectCard from './ProjectCard.vue'
import { useProjectsStore } from '../store/projects.js'

defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').AreaNode>} */
	area: { type: Object, required: true },
})

const store = useProjectsStore()
const newProject = ref('')
const creating = ref(false)

async function createProject(area) {
	const summary = newProject.value.trim()
	if (!summary || creating.value) {
		return
	}
	newProject.value = ''
	creating.value = true
	try {
		await store.createProject(area.name, summary)
	} finally {
		creating.value = false
	}
}

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
			<ProjectCard
				v-for="project in area.projects"
				:key="project.task?.uid || project.task?.summary"
				:project="project" />
		</div>
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
</style>
