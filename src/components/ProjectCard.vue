<script setup>
import TaskTree from './TaskTree.vue'

defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').ProjectNode>} */
	project: { type: Object, required: true },
})

</script>

<template>
	<div
		class="cc-project-card">
		<header class="cc-project-card__header">
			<h4 class="cc-project-card__title">
				{{ project.task?.summary }}
			</h4>
		</header>
		<div class="cc-project-card__content">
			<TaskTree
				:nodes="project.children || []" />
		</div>
	</div>
</template>

<style scoped>
.cc-project-card {
	background: var(--color-main-background, #fff);
	border: 1px solid var(--color-border, #ededed);
	border-radius: var(--border-radius-large, 8px);
	padding: calc(var(--default-grid-baseline, 4px) * 3);
}

.cc-project-card__header {
	margin-bottom: calc(var(--default-grid-baseline, 4px) * 2);
}

.cc-project-card__title {
	margin: 0;
	font-size: 1.1rem;
	font-weight: 600;
}

</style>
