<script>
/**
 * Format relative time string from refresh timestamp.
 *
 * @param {number | null | undefined} timestampMs The refresh timestamp in ms
 * @param {number} currentMs The current timestamp in ms
 * @return {string} The formatted relative time string
 */
export function formatRelativeTime(timestampMs, currentMs) {
	if (!timestampMs) {
		return 'just now'
	}
	const diffMs = Math.max(0, currentMs - timestampMs)
	const diffSec = Math.floor(diffMs / 1000)
	if (diffSec < 60) {
		return 'just now'
	}
	const diffMin = Math.floor(diffSec / 60)
	if (diffMin === 1) {
		return '1 min ago'
	}
	if (diffMin < 60) {
		return `${diffMin} min ago`
	}
	const diffHours = Math.floor(diffMin / 60)
	if (diffHours === 1) {
		return '1 hour ago'
	}
	if (diffHours < 24) {
		return `${diffHours} hours ago`
	}
	const diffDays = Math.floor(diffHours / 24)
	if (diffDays === 1) {
		return '1 day ago'
	}
	return `${diffDays} days ago`
}
</script>

<script setup>
import { getActivePinia } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useProjectsStore } from '../store/projects.js'

const store = getActivePinia() ? useProjectsStore() : null

const now = ref(Date.now())
let timer = null

onMounted(() => {
	now.value = Date.now()
	timer = setInterval(() => {
		now.value = Date.now()
	}, 30000)
})

onBeforeUnmount(() => {
	if (timer) {
		clearInterval(timer)
		timer = null
	}
})

const openProjects = computed(() => {
	if (!store) {
		return 0
	}
	if (typeof store.totalOpenProjects === 'number') {
		return store.totalOpenProjects
	}
	return typeof store.openProjectCount === 'function' ? store.openProjectCount() : 0
})

const openTasks = computed(() => {
	if (!store) {
		return 0
	}
	if (typeof store.totalOpenTasks === 'number') {
		return store.totalOpenTasks
	}
	return typeof store.openTaskCount === 'function' ? store.openTaskCount() : 0
})

const updatedText = computed(() => {
	const relative = formatRelativeTime(store?.lastRefreshedAt, now.value)
	return `Updated ${relative}`
})
</script>

<template>
	<div class="cc-status-line">
		<span>{{ openProjects }} open {{ openProjects === 1 ? 'project' : 'projects' }}</span>
		<span class="cc-status-line__dot"> · </span>
		<span>{{ openTasks }} open {{ openTasks === 1 ? 'task' : 'tasks' }}</span>
		<span class="cc-status-line__dot"> · </span>
		<span>{{ updatedText }}</span>
	</div>
</template>

<style scoped>
.cc-status-line {
	flex: none;
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	padding: calc(var(--default-grid-baseline, 4px) * 1.5) 0;
	border-top: 1px solid var(--color-border);
	color: var(--color-text-maxcontrast);
	font-size: 13px;
	box-sizing: border-box;
	background: var(--color-main-background);
}

.cc-status-line__dot {
	user-select: none;
}

@media (max-width: 600px) {
	.cc-status-line {
		padding: calc(var(--default-grid-baseline, 4px) * 1.5) 0;
		flex-wrap: wrap;
	}
}
</style>
