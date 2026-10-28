<script setup>
import { computed, ref } from 'vue'
import { getTasksDeepLink } from './TaskRow.vue'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').ProjectNode[]>} */
	projects: { type: Array, default: () => [] },
	/** @type {import('vue').PropType<import('../models/tree.js').ProjectNode[]>} */
	done: { type: Array, default: undefined },
})

const expanded = ref(false)

const completedProjects = computed(() => {
	const list = props.done ?? props.projects
	return Array.isArray(list) ? list : []
})

const count = computed(() => completedProjects.value.length)

/**
 * Toggle the expanded state.
 */
function toggle() {
	expanded.value = !expanded.value
}

/**
 * Get the task from a project node.
 *
 * @param {import('../models/tree.js').ProjectNode | object} project project node
 * @return {object}
 */
function getProjectTask(project) {
	return project?.task || project
}

/**
 * Get project title.
 *
 * @param {import('../models/tree.js').ProjectNode | object} project project node
 * @return {string}
 */
function getProjectTitle(project) {
	return project?.task?.summary || project?.summary || ''
}

/**
 * Get project deep-link URL in Tasks.
 *
 * @param {import('../models/tree.js').ProjectNode | object} project project node
 * @return {string}
 */
function getProjectLink(project) {
	return getTasksDeepLink(getProjectTask(project))
}

/**
 * Get unique key for a project.
 *
 * @param {import('../models/tree.js').ProjectNode | object} project project node
 * @return {string|null}
 */
function getProjectKey(project) {
	const task = getProjectTask(project)
	return task?.uid || task?.summary || project?.uid || project?.summary || null
}
</script>

<template>
	<div
		v-if="count > 0"
		class="cc-done-strip">
		<div class="cc-done-strip__header">
			<button
				type="button"
				class="cc-done-strip__toggle cc-done-strip__disclosure"
				:aria-expanded="expanded"
				:aria-label="expanded ? 'Collapse done projects' : 'Expand done projects'"
				@click="toggle">
				<span class="cc-done-strip__icon">{{ expanded ? '▼' : '▶' }}</span>
				<span class="cc-done-strip__title">Done ({{ count }})</span>
			</button>
		</div>
		<ul
			v-if="expanded"
			class="cc-done-strip__list">
			<li
				v-for="project in completedProjects"
				:key="getProjectKey(project)"
				class="cc-done-strip__item">
				<a
					:href="getProjectLink(project)"
					class="cc-done-strip__link">
					{{ getProjectTitle(project) }}
				</a>
			</li>
		</ul>
	</div>
</template>

<style scoped>
.cc-done-strip {
	margin: calc(var(--default-grid-baseline, 4px) * 2) 0;
}

.cc-done-strip__toggle {
	background: transparent;
	border: none;
	cursor: pointer;
	padding: calc(var(--default-grid-baseline, 4px) * 1) 0;
	display: inline-flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 1);
	color: var(--color-text-maxcontrast, #777);
	font-size: 0.9rem;
	font-weight: 500;
}

.cc-done-strip__toggle:hover {
	color: var(--color-main-text, #222);
}

.cc-done-strip__icon {
	font-size: 0.75rem;
}

.cc-done-strip__list {
	list-style: none;
	margin: calc(var(--default-grid-baseline, 4px) * 1) 0 0 0;
	padding: 0 0 0 calc(var(--default-grid-baseline, 4px) * 4);
}

.cc-done-strip__item {
	margin: calc(var(--default-grid-baseline, 4px) * 1) 0;
}

.cc-done-strip__link {
	color: var(--color-text-maxcontrast, #777);
	text-decoration: none;
}

.cc-done-strip__link:hover {
	color: var(--color-primary, #0082c9);
	text-decoration: underline;
}
</style>
