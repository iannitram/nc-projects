<script setup>
import ProjectCard from './ProjectCard.vue'

defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').AreaNode>} */
	area: { type: Object, required: true },
})
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
