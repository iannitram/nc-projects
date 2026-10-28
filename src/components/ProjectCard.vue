<script setup>
import { NcCheckboxRadioSwitch, NcProgressBar } from '@nextcloud/vue'
import { computed, ref, watch } from 'vue'
import AddTaskInput from './AddTaskInput.vue'
import TaskTree from './TaskTree.vue'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').ProjectNode>} */
	project: { type: Object, required: true },
})
const isCompleted = computed(() => Boolean(props.project?.task?.completed) || props.project?.task?.status?.toUpperCase() === 'COMPLETED')

function onCompletionChange() {
	useProjectsStore().setCompleted(props.project?.task?.uid, !isCompleted.value)
}

const progressDone = computed(() => Number(props.project?.progress?.done) || 0)
const progressTotal = computed(() => Number(props.project?.progress?.total) || 0)

const progressValue = computed(() => {
	if (progressTotal.value <= 0) {
		return 0
	}
	return Math.round((100 * progressDone.value) / progressTotal.value)
})

const progressText = computed(() => `${progressDone.value}/${progressTotal.value}`)

/**
 * Read the show-done preference for a project from localStorage.
 *
 * @param {string | undefined | null} uid The project task UID
 * @return {boolean} Whether show-done is enabled (default false on failure/missing)
 */
function readStorage(uid) {
	if (!uid) {
		return false
	}
	try {
		const storage = typeof window !== 'undefined' ? window.localStorage : null
		return storage ? storage.getItem(`cc_projects:showDone:${uid}`) === '1' : false
	} catch {
		return false
	}
}

/**
 * Persist the show-done preference for a project to localStorage.
 *
 * @param {string | undefined | null} uid The project task UID
 * @param {boolean} val The new preference value
 * @return {boolean} Whether storage succeeded
 */
function writeStorage(uid, val) {
	if (!uid) {
		return false
	}
	try {
		const storage = typeof window !== 'undefined' ? window.localStorage : null
		if (!storage) {
			return false
		}
		storage.setItem(`cc_projects:showDone:${uid}`, val ? '1' : '0')
		return true
	} catch {
		return false
	}
}

const showDoneState = ref(readStorage(props.project?.task?.uid))

watch(
	() => props.project?.task?.uid,
	(newUid) => {
		showDoneState.value = readStorage(newUid)
	},
)

const showDone = computed({
	get() {
		return showDoneState.value
	},
	set(val) {
		const ok = writeStorage(props.project?.task?.uid, val)
		if (!ok) {
			showDoneState.value = false
		} else {
			showDoneState.value = val
		}
	},
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
		<header
			class="cc-project-card__header drag-handle"
			:data-uid="project.task?.uid">
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
			<div class="cc-project-card__header-actions">
				<div class="cc-project-card__progress">
					<NcProgressBar
						class="cc-project-card__progress-bar"
						:value="progressValue"
						ariaLabel="Project progress"
						size="small" />
					<span class="cc-project-card__progress-text">{{ progressText }}</span>
				</div>
				<NcCheckboxRadioSwitch
					v-model="showDone"
					type="switch"
					class="cc-project-card__show-done">
					Show done
				</NcCheckboxRadioSwitch>
				<NcCheckboxRadioSwitch
					class="cc-project-card__completion"
					:isChecked="isCompleted"
					:modelValue="isCompleted"
					aria-label="Project completed"
					@update:modelValue="onCompletionChange" />
			</div>
		</header>
		<div class="cc-project-card__content">
			<TaskTree
				:nodes="project.children || []"
				:showDone="showDone" />
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
	justify-content: space-between;
	flex-wrap: wrap;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	margin-bottom: calc(var(--default-grid-baseline, 4px) * 2);
}

.cc-project-card__title {
	margin: 0;
	font-size: 1.1rem;
	font-weight: 600;
}

.cc-project-card__header-actions {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 3);
}

.cc-project-card__progress {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	min-width: 120px;
}

.cc-project-card__progress-bar {
	flex: 1;
	min-width: 80px;
}

.cc-project-card__progress-text {
	font-size: 0.85rem;
	color: var(--color-text-maxcontrast, #777);
	white-space: nowrap;
}

.cc-project-card__show-done {
	margin: 0;
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
