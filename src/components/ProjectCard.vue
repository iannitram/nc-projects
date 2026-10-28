<script setup>
import { NcCheckboxRadioSwitch, NcProgressBar } from '@nextcloud/vue'
import { computed, ref, watch } from 'vue'
import AddTaskInput from './AddTaskInput.vue'
import TaskTree from './TaskTree.vue'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').ProjectNode>} */
	project: { type: Object, required: true },
})

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
</script>

<template>
	<div
		class="cc-project-card">
		<header class="cc-project-card__header">
			<h4 class="cc-project-card__title">
				{{ project.task?.summary }}
			</h4>
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
</style>
