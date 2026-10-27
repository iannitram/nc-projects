<script setup>
import { NcProgressBar } from '@nextcloud/vue'
import { computed, onMounted, ref } from 'vue'
import TaskTree from './TaskTree.vue'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').ProjectNode>} */
	project: { type: Object, required: true },
})

const categories = computed(() => {
	const cats = props.project?.task?.categories
	return Array.isArray(cats) ? cats : []
})

const isBlocked = computed(() => categories.value.some((c) => typeof c === 'string' && c.toLowerCase() === 'blocked'))
const isSomeday = computed(() => categories.value.some((c) => typeof c === 'string' && c.toLowerCase() === 'someday'))

const progress = computed(() => props.project?.progress || { done: 0, total: 0 })
const progressPercent = computed(() => {
	if (!progress.value.total) {
		return 0
	}
	return Math.round((progress.value.done / progress.value.total) * 100)
})

const showDone = ref(false)

const storageKey = computed(() => {
	const uid = props.project?.task?.uid
	return uid ? `cc-projects-show-done-${uid}` : null
})

onMounted(() => {
	if (storageKey.value && typeof localStorage !== 'undefined') {
		const stored = localStorage.getItem(storageKey.value)
		if (stored !== null) {
			showDone.value = stored === 'true'
		}
	}
})

/**
 *
 */
function toggleShowDone() {
	showDone.value = !showDone.value
	if (storageKey.value && typeof localStorage !== 'undefined') {
		localStorage.setItem(storageKey.value, String(showDone.value))
	}
}
</script>

<template>
	<div
		class="cc-project-card"
		:class="{ 'is-blocked': isBlocked, 'is-someday': isSomeday }">
		<header class="cc-project-card__header">
			<div class="cc-project-card__title-row">
				<h4 class="cc-project-card__title">
					{{ project.task?.summary }}
				</h4>
				<div v-if="isBlocked" class="cc-project-card__badges">
					<span class="cc-badge cc-badge--blocked">blocked</span>
				</div>
			</div>
			<div class="cc-project-card__meta">
				<div class="cc-project-card__progress">
					<NcProgressBar
						:value="progressPercent"
						size="small"
						:aria-label="`Progress: ${progress.done} of ${progress.total} completed`" />
					<span class="cc-project-card__progress-text">
						{{ progress.done }}/{{ progress.total }}
					</span>
				</div>
				<button
					type="button"
					class="cc-project-card__show-done-toggle"
					:class="{ 'is-active': showDone }"
					:aria-pressed="showDone"
					@click="toggleShowDone">
					Show done
				</button>
			</div>
		</header>
		<div class="cc-project-card__content">
			<TaskTree
				:nodes="project.children || []"
				:showDone="showDone" />
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

.cc-project-card.is-someday {
	opacity: 0.7;
}

.cc-project-card__header {
	margin-bottom: calc(var(--default-grid-baseline, 4px) * 2);
}

.cc-project-card__title-row {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
}

.cc-project-card__title {
	margin: 0;
	font-size: 1.1rem;
	font-weight: 600;
}

.cc-badge--blocked {
	background-color: var(--color-error, #e53935);
	color: var(--color-primary-text, #fff);
	padding: 2px 6px;
	border-radius: var(--border-radius-pill, 10px);
	font-size: 0.75rem;
	font-weight: 600;
	text-transform: uppercase;
}

.cc-project-card__meta {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: calc(var(--default-grid-baseline, 4px) * 3);
	margin-top: calc(var(--default-grid-baseline, 4px) * 2);
}

.cc-project-card__progress {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	flex: 1;
	max-width: 250px;
}

.cc-project-card__progress-text {
	font-size: 0.85rem;
	color: var(--color-text-maxcontrast, #555);
	white-space: nowrap;
}

.cc-project-card__show-done-toggle {
	background: transparent;
	border: 1px solid var(--color-border, #ededed);
	border-radius: var(--border-radius-element, 4px);
	padding: 4px 8px;
	font-size: 0.8rem;
	cursor: pointer;
}

.cc-project-card__show-done-toggle.is-active {
	background: var(--color-primary-element-light, rgba(0, 130, 201, 0.1));
	border-color: var(--color-primary-element, #0082c9);
}
</style>
