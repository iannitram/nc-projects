<script setup>
import { mdiCheckAll, mdiFolderMoveOutline } from '@mdi/js'
import { NcButton, NcEmptyContent, NcIconSvgWrapper } from '@nextcloud/vue'
import { getActivePinia } from 'pinia'
import { computed } from 'vue'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/Task.js').Task[]>} */
	orphans: { type: Array, required: true },
	/** @type {import('vue').PropType<import('../models/Task.js').Task[]>} */
	untaggedParents: { type: Array, required: true },
})

const emit = defineEmits(['openMoveDialog'])

const store = getActivePinia() ? useProjectsStore() : null

const totalCount = computed(() => (props.orphans?.length || 0) + (props.untaggedParents?.length || 0))

/**
 * Get the display name of the list a task belongs to.
 *
 * @param {import('../models/Task.js').Task} task task to inspect
 * @return {string}
 */
function getTaskListName(task) {
	if (task.listName) {
		return task.listName
	}
	if (task.calendarName) {
		return task.calendarName
	}
	if (store?.areas && task.calendarUrl) {
		const normalized = task.calendarUrl.replace(/\/+$/, '')
		const area = store.areas.find((a) => (a.calendarUrl || '').replace(/\/+$/, '') === normalized)
		if (area?.name) {
			return area.name
		}
	}
	return ''
}

/**
 * Get the color dot for the task's list using the store's areaColor.
 *
 * @param {import('../models/Task.js').Task} task task to inspect
 * @return {string}
 */
function getTaskListColor(task) {
	const name = getTaskListName(task)
	if (store && name) {
		return store.areaColor(name)
	}
	return 'var(--color-primary-element)'
}

/**
 * Reason why an item is in the tray.
 *
 * @param {import('../models/Task.js').Task} task task to inspect
 * @return {string}
 */
function taskReason(task) {
	if (task.reason) {
		return task.reason
	}
	return ''
}

/**
 * Turn an orphan or untagged parent into a project.
 *
 * @param {import('../models/Task.js').Task} task task to promote
 * @return {Promise<void>}
 */
async function makeProject(task) {
	try {
		await store?.makeProject(task.uid)
	} catch {
		// The store already showed the error toast.
	}
}

/**
 * Hook to open the move-to-project dialog for a task.
 * Left visible as a no-op hook here; #120 will implement the Move to project dialog.
 *
 * @param {import('../models/Task.js').Task} task task to move
 */
function openMoveDialog(task) {
	// No-op for now; #120 will implement the Move to project dialog.
	emit('openMoveDialog', task)
}
</script>

<template>
	<section class="cc-needs-filing-tray">
		<header class="cc-needs-filing-tray__header">
			<div class="cc-needs-filing-tray__topbar">
				<h1 class="cc-needs-filing-tray__title">
					Needs filing
				</h1>
				<span v-if="totalCount > 0" class="cc-needs-filing-tray__count">
					{{ totalCount }} {{ totalCount === 1 ? 'task' : 'tasks' }}
				</span>
			</div>
			<p class="cc-needs-filing-tray__intro">
				Tasks that aren't under a project yet. File each one so it shows up in its area.
			</p>
		</header>

		<NcEmptyContent
			v-if="totalCount === 0"
			class="cc-needs-filing-tray__empty"
			name="Everything is filed"
			description="Every task sits under a project.">
			<template #icon>
				<NcIconSvgWrapper :path="mdiCheckAll" :size="48" />
			</template>
		</NcEmptyContent>

		<div v-else class="cc-needs-filing-tray__groups">
			<section v-if="props.orphans.length > 0" class="cc-needs-filing-tray__group">
				<h2 class="cc-needs-filing-tray__group-title">
					Orphan tasks ({{ props.orphans.length }})
					<span class="cc-needs-filing-tray__meta">their parent is missing or done</span>
				</h2>
				<ul class="cc-needs-filing-tray__list">
					<li
						v-for="task in props.orphans"
						:key="task.uid"
						class="cc-needs-filing-tray__item">
						<div class="cc-needs-filing-tray__item-content">
							<div class="cc-needs-filing-tray__item-title">
								{{ task.summary }}
							</div>
							<div class="cc-needs-filing-tray__why">
								<span v-if="getTaskListName(task)" class="cc-needs-filing-tray__listchip">
									<span
										class="cc-needs-filing-tray__swatch"
										:style="{ backgroundColor: getTaskListColor(task) }"
										aria-hidden="true" />
									{{ getTaskListName(task) }}
								</span>
								<span v-if="getTaskListName(task) && taskReason(task)">·</span>
								<span v-if="taskReason(task)" class="cc-needs-filing-tray__reason">
									{{ taskReason(task) }}
								</span>
							</div>
						</div>
						<div class="cc-needs-filing-tray__actions">
							<NcButton
								variant="tertiary"
								:aria-label="`Make ${task.summary} a project`"
								@click="makeProject(task)">
								Make project
							</NcButton>
							<NcButton
								variant="secondary"
								:aria-label="`Move ${task.summary} to a project`"
								@click="openMoveDialog(task)">
								<template #icon>
									<NcIconSvgWrapper :path="mdiFolderMoveOutline" :size="16" />
								</template>
								Move to project…
							</NcButton>
						</div>
					</li>
				</ul>
			</section>

			<section v-if="props.untaggedParents.length > 0" class="cc-needs-filing-tray__group">
				<h2 class="cc-needs-filing-tray__group-title">
					Parents without a project tag ({{ props.untaggedParents.length }})
					<span class="cc-needs-filing-tray__meta">they have subtasks but aren't projects</span>
				</h2>
				<ul class="cc-needs-filing-tray__list">
					<li
						v-for="task in props.untaggedParents"
						:key="task.uid"
						class="cc-needs-filing-tray__item">
						<div class="cc-needs-filing-tray__item-content">
							<div class="cc-needs-filing-tray__item-title">
								{{ task.summary }}
							</div>
							<div class="cc-needs-filing-tray__why">
								<span v-if="getTaskListName(task)" class="cc-needs-filing-tray__listchip">
									<span
										class="cc-needs-filing-tray__swatch"
										:style="{ backgroundColor: getTaskListColor(task) }"
										aria-hidden="true" />
									{{ getTaskListName(task) }}
								</span>
								<span v-if="getTaskListName(task) && taskReason(task)">·</span>
								<span v-if="taskReason(task)" class="cc-needs-filing-tray__reason">
									{{ taskReason(task) }}
								</span>
							</div>
						</div>
						<div class="cc-needs-filing-tray__actions">
							<NcButton
								variant="tertiary"
								:aria-label="`Make ${task.summary} a project`"
								@click="makeProject(task)">
								Make project
							</NcButton>
							<NcButton
								variant="secondary"
								:aria-label="`Move ${task.summary} to a project`"
								@click="openMoveDialog(task)">
								<template #icon>
									<NcIconSvgWrapper :path="mdiFolderMoveOutline" :size="16" />
								</template>
								Move to project…
							</NcButton>
						</div>
					</li>
				</ul>
			</section>
		</div>
	</section>
</template>

<style scoped>
.cc-needs-filing-tray {
	display: flex;
	flex-direction: column;
	width: 100%;
	padding: var(--default-grid-baseline, 4px) 0;
	box-sizing: border-box;
}

.cc-needs-filing-tray__topbar {
	display: flex;
	align-items: baseline;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	margin-bottom: calc(var(--default-grid-baseline, 4px) * 1);
	/* clear the navigation toggle (absolutely positioned over the content's top-left), as the top bar does */
	padding-left: calc(var(--default-clickable-area, 34px) + var(--default-grid-baseline, 4px) * 2);
}

.cc-needs-filing-tray__title {
	font-size: 20px;
	font-weight: 650;
	margin: 0;
	line-height: 1.2;
	color: var(--color-main-text);
}

.cc-needs-filing-tray__count {
	font-size: 14px;
	color: var(--color-text-maxcontrast);
}

.cc-needs-filing-tray__intro {
	color: var(--color-text-maxcontrast);
	margin: calc(var(--default-grid-baseline, 4px) * 1) 0 calc(var(--default-grid-baseline, 4px) * 2) 0;
	max-width: 640px;
	font-size: 14px;
	line-height: 1.4;
}

.cc-needs-filing-tray__group {
	margin-top: calc(var(--default-grid-baseline, 4px) * 4);
}

.cc-needs-filing-tray__group-title {
	margin: 0 0 calc(var(--default-grid-baseline, 4px) * 2) 0;
	font-size: 16px;
	font-weight: 650;
	display: flex;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	align-items: baseline;
	color: var(--color-main-text);
}

.cc-needs-filing-tray__meta {
	font-size: 13px;
	color: var(--color-text-maxcontrast);
	font-weight: 400;
}

.cc-needs-filing-tray__list {
	list-style: none;
	margin: 0;
	padding: 0;
}

.cc-needs-filing-tray__item {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 3);
	padding: calc(var(--default-grid-baseline, 4px) * 2) calc(var(--default-grid-baseline, 4px) * 3);
	border-radius: var(--border-radius-element);
	border-bottom: 1px solid var(--color-border);
}

.cc-needs-filing-tray__item:hover {
	background-color: var(--color-background-hover);
}

.cc-needs-filing-tray__item-content {
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline, 4px) * 1);
	min-width: 0;
}

.cc-needs-filing-tray__item-title {
	font-size: 14px;
	color: var(--color-main-text);
	word-break: break-word;
}

.cc-needs-filing-tray__why {
	font-size: 13px;
	color: var(--color-text-maxcontrast);
	display: flex;
	gap: calc(var(--default-grid-baseline, 4px) * 1.5);
	align-items: center;
	flex-wrap: wrap;
}

.cc-needs-filing-tray__listchip {
	display: inline-flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 1.25);
}

.cc-needs-filing-tray__swatch {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	display: inline-block;
	flex-shrink: 0;
}

.cc-needs-filing-tray__actions {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 1);
	flex-shrink: 0;
}

.cc-needs-filing-tray__empty {
	padding: calc(var(--default-grid-baseline, 4px) * 16) calc(var(--default-grid-baseline, 4px) * 4);
}
</style>
