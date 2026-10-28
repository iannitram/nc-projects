<script setup>
import { computed } from 'vue'
import AddTaskInput from './AddTaskInput.vue'
import TaskTree from './TaskTree.vue'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').ProjectNode>} */
	project: { type: Object, required: true },
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

</script>

<template>
	<div
		class="cc-project-card"
		:class="{ 'cc-project-card--someday': isSomeday }">
		<header class="cc-project-card__header">
			<h4 class="cc-project-card__title">
				{{ project.task?.summary }}
			</h4>
			<span
				v-if="isBlocked"
				class="cc-project-card__badge cc-project-card__badge--blocked">
				blocked
			</span>
			<span
				v-if="isSomeday"
				class="cc-project-card__badge cc-project-card__badge--someday">
				someday
			</span>
		</header>
		<div class="cc-project-card__content">
			<TaskTree
				:nodes="project.children || []" />
			<AddTaskInput :projectUid="project.task?.uid" />
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

.cc-project-card--someday {
	opacity: 0.6;
}

.cc-project-card__header {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	margin-bottom: calc(var(--default-grid-baseline, 4px) * 2);
}

.cc-project-card__title {
	margin: 0;
	font-size: 1.1rem;
	font-weight: 600;
}

.cc-project-card__badge {
	font-size: 0.75rem;
	padding: calc(var(--default-grid-baseline, 4px) * 0.5) calc(var(--default-grid-baseline, 4px) * 1.5);
	border-radius: var(--border-radius-pill, 10px);
	font-weight: 500;
	display: inline-flex;
	align-items: center;
}

.cc-project-card__badge--blocked {
	background-color: var(--color-error);
	color: var(--color-main-background, #fff);
}

.cc-project-card__badge--someday {
	background-color: var(--color-background-dark, var(--color-background-hover, #ededed));
	color: var(--color-text-maxcontrast, #777);
}

</style>
