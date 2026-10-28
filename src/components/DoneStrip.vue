<script setup>
import { mdiCheckboxMarkedOutline, mdiChevronDown, mdiChevronRight, mdiOpenInNew } from '@mdi/js'
import { NcButton, NcIconSvgWrapper } from '@nextcloud/vue'
import { computed, ref, toRaw } from 'vue'
import { getTasksDeepLink } from './TaskRow.vue'
import { n } from '../services/l10n.js'

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
 * Read the COMPLETED timestamp, rather than the model's boolean completed flag.
 *
 * @param {object} project the project node
 * @return {Date|null} Localizable completion date, if present
 */
function completionDate(project) {
	const value = toRaw(getProjectTask(project).propertyValue?.('completed'))
	const date = value?.toJSDate?.()
	return date && !Number.isNaN(date.getTime()) ? date : null
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
			<NcButton
				variant="tertiary"
				class="cc-done-strip__toggle cc-done-strip__disclosure"
				:aria-expanded="expanded"
				:aria-label="expanded ? 'Collapse done projects' : 'Expand done projects'"
				@click="toggle">
				<template #icon>
					<NcIconSvgWrapper :path="expanded ? mdiChevronDown : mdiChevronRight" :size="20" />
				</template>
				<span class="cc-done-strip__title">{{ n('%n done project', '%n done projects', count) }}</span>
			</NcButton>
		</div>
		<ul
			v-if="expanded"
			class="cc-done-strip__list">
			<li
				v-for="project in completedProjects"
				:key="getProjectKey(project)"
				class="cc-done-strip__item">
				<!-- Decorative: a done project cannot be reopened here, and the strip already says "done". -->
				<span class="cc-done-strip__marker" aria-hidden="true">
					<NcIconSvgWrapper :path="mdiCheckboxMarkedOutline" :size="20" />
				</span>
				<span class="cc-done-strip__project-title">{{ getProjectTitle(project) }}</span>
				<time
					v-if="completionDate(project)"
					:datetime="completionDate(project).toISOString()">
					{{ completionDate(project).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }}
				</time>
				<NcButton
					:href="getProjectLink(project)"
					variant="tertiary"
					:aria-label="`Open in Tasks: ${getProjectTitle(project)}`"
					title="Open in Tasks"
					class="cc-done-strip__link">
					<template #icon>
						<NcIconSvgWrapper :path="mdiOpenInNew" :size="20" />
					</template>
				</NcButton>
			</li>
		</ul>
	</div>
</template>

<style scoped>
.cc-done-strip {
	margin: calc(var(--default-grid-baseline, 4px) * 2) 0;
}

.cc-done-strip__title,
.cc-done-strip__item {
	color: var(--color-text-maxcontrast);
	font-size: 13px;
}

.cc-done-strip__list {
	list-style: none;
	margin: 4px 0 0;
	padding-inline-start: 44px;
}

.cc-done-strip__item {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.cc-done-strip__project-title {
	flex: 1;
	min-width: 0;
	overflow-wrap: anywhere;
}

.cc-done-strip__item time {
	white-space: nowrap;
}

/* Keep the link reachable so keyboard focus reveals its icon. */
.cc-done-strip__link :deep(svg) {
	opacity: 0;
	transition: var(--cc-hover-reveal, opacity 0.15s);
}

.cc-done-strip__item:hover .cc-done-strip__link :deep(svg),
.cc-done-strip__item:focus-within .cc-done-strip__link :deep(svg) {
	opacity: 1;
}

@media (hover: none), (pointer: coarse) {
	.cc-done-strip__link :deep(svg) {
		opacity: 1;
	}
}
</style>
