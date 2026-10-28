<script>
/**
 * Determine whether a task is closed (completed or cancelled).
 *
 * @param {import('../models/Task.js').Task | object | null | undefined} task The task to check
 * @return {boolean} True if completed or cancelled
 */
export function isTaskClosed(task) {
	if (!task) {
		return false
	}
	if (task.closed === true || task.completed === true) {
		return true
	}
	if (typeof task.status === 'string') {
		const status = task.status.toUpperCase()
		if (status === 'COMPLETED' || status === 'CANCELLED') {
			return true
		}
	}
	return Boolean(task.completed)
}
</script>

<script setup>
import { mdiChevronDown } from '@mdi/js'
import { NcDialog, NcIconSvgWrapper } from '@nextcloud/vue'
import { Sortable } from 'sortablejs-vue3'
import { computed, ref } from 'vue'
import TaskRow from './TaskRow.vue'
import {
	activeDragSourceProjectUid,
	activeDragUid,
	activeDropProjectUid,
	DRAG_OPTIONS,
	fullIndexForDrop,
	getSubtaskCount,
	onSiblingDrop,
} from '../composables/useDrag.js'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').TaskNode[]>} */
	nodes: { type: Array, required: true },
	depth: { type: Number, default: 1 },
	showDone: { type: Boolean, default: false },
	areaName: { type: String, default: null },
	projectUid: { type: String, default: null },
	dialogContainer: { type: String, default: 'body' },
})

const collapsedKeys = ref(new Set())
const pendingCrossListMove = ref(null)
const treeKey = ref(0)

/**
 * Return a stable key for a task node.
 *
 * @param {import('../models/tree.js').TaskNode} node The task node
 * @return {string | null} Unique key
 */
function getNodeKey(node) {
	return node.task?.uid || node.task?.summary || null
}

/**
 * Check if a task node's children are collapsed.
 *
 * @param {import('../models/tree.js').TaskNode} node The task node
 * @return {boolean} True if collapsed
 */
function isCollapsed(node) {
	if (typeof node.collapsed === 'boolean') {
		return node.collapsed
	}
	const key = getNodeKey(node)
	return key ? collapsedKeys.value.has(key) : false
}

/**
 * Toggle the collapse state of a task node's subtasks.
 *
 * @param {import('../models/tree.js').TaskNode} node The task node
 */
function toggleCollapse(node) {
	const collapsing = !isCollapsed(node)
	try {
		node.collapsed = collapsing
	} catch {
		// In case node is frozen
	}
	const key = getNodeKey(node)
	if (!key) {
		return
	}
	const next = new Set(collapsedKeys.value)
	if (collapsing) {
		next.add(key)
	} else {
		next.delete(key)
	}
	collapsedKeys.value = next
}

/**
 * Check if a task node has visible children under the current showDone setting.
 *
 * @param {import('../models/tree.js').TaskNode} node The task node
 * @return {boolean} True if there are visible children
 */
function hasVisibleChildren(node) {
	if (!node?.children || node.children.length === 0) {
		return false
	}
	if (props.showDone) {
		return true
	}
	return node.children.some((child) => !isTaskClosed(child?.task))
}

/**
 * Count the subtasks a collapsed parent hides (closed ones only when showDone is on).
 *
 * @param {import('../models/tree.js').TaskNode} node The task node
 * @return {number} The number of direct subtasks
 */
function subtaskCount(node) {
	const children = node?.children || []
	return props.showDone ? children.length : children.filter((child) => !isTaskClosed(child?.task)).length
}

const visibleNodes = computed(() => {
	const list = props.nodes || []
	if (props.showDone) {
		return list
	}
	return list.filter((node) => !isTaskClosed(node?.task))
})

/** The project or task whose children these are: every child carries it as its parent. */
const parentUid = computed(() => props.nodes?.[0]?.task?.parentUid || null)
const effectiveProjectUid = computed(() => props.projectUid || parentUid.value)

/** Sortable options: Tasks' options, and group configuration (shared across top-level task trees across all areas). */
const sortOptions = computed(() => {
	if (props.depth === 1 && props.areaName) {
		return {
			...DRAG_OPTIONS,
			group: {
				name: 'cc-tasks-top',
				pull: true,
				put: true,
			},
			onMove(evt) {
				const toProjectUid = evt.to?.dataset?.projectUid
				if (toProjectUid && toProjectUid !== effectiveProjectUid.value) {
					activeDropProjectUid.value = toProjectUid
				} else {
					activeDropProjectUid.value = null
				}
				return true
			},
		}
	}
	return {
		...DRAG_OPTIONS,
		group: { name: `cc-tasks-${parentUid.value ?? 'none'}` },
	}
})

/**
 * Row key for the sortable list (the same key the rows had before).
 *
 * @param {import('../models/tree.js').TaskNode} node The task node
 * @return {string | import('../models/tree.js').TaskNode} Unique key
 */
function rowKey(node) {
	return getNodeKey(node) || node
}

/**
 * Put a dropped row back where Vue has it, so the store's list (after reorder,
 * or after a rollback) is what the DOM shows.
 *
 * @param {{item: HTMLElement, from: HTMLElement, oldIndex: number}} evt The sortable end event
 */
function restoreDomPosition(evt) {
	const { item, from, oldIndex } = evt
	if (!item || !from) {
		return
	}
	item.remove()
	from.insertBefore(item, from.children[oldIndex] ?? null)
}

/**
 * Read a comma-separated uid list off a list element's data attribute.
 *
 * @param {HTMLElement} element The list element
 * @param {string} name The dataset key
 * @return {string[]} The uids
 */
function uidsOf(element, name) {
	return (element.dataset[name] || '').split(',').filter(Boolean)
}

/**
 * Clear global drag tracking state and remove any temporary drag badges.
 *
 * @param {{item?: HTMLElement}} [evt] Sortable event
 */
function clearDragState(evt) {
	activeDragUid.value = null
	activeDragSourceProjectUid.value = null
	activeDropProjectUid.value = null
	if (evt?.item) {
		evt.item.querySelectorAll('[data-drag-badge]').forEach((b) => b.remove())
	}
	if (typeof document !== 'undefined') {
		document.querySelectorAll('.cc-drag-badge, .drag-badge').forEach((b) => b.remove())
	}
}

/**
 * Handle drag start: track active item and attach +N subtask badge if descendants exist.
 *
 * @param {{item: HTMLElement, oldIndex: number}} evt Sortable start event
 */
function onDragStart(evt) {
	const node = visibleNodes.value[evt.oldIndex]
	const movedUid = node?.task?.uid
	activeDragUid.value = movedUid || null
	activeDragSourceProjectUid.value = effectiveProjectUid.value
	activeDropProjectUid.value = null

	const store = useProjectsStore()
	const count = movedUid ? getSubtaskCount(store.tasksByUid, movedUid) : 0
	if (count > 0 && evt.item) {
		const row = evt.item.querySelector('.cc-task-tree__row-wrapper') || evt.item
		const badge = document.createElement('span')
		badge.className = 'cc-drag-badge drag-badge'
		badge.textContent = `+${count}`
		badge.dataset.dragBadge = 'true'
		row.appendChild(badge)
	}
}

/**
 * Check whether a cross-project drop moves the task to a different list.
 *
 * @param {string} movedUid UID of the moved task
 * @param {string} targetProjectUid UID of the target project
 * @param {string|null} targetAreaName area name from the drop target dataset
 * @return {boolean}
 */
function isCrossListDrop(movedUid, targetProjectUid, targetAreaName) {
	if (props.areaName && targetAreaName && props.areaName !== targetAreaName) {
		return true
	}
	const store = useProjectsStore()
	const movedTask = store.tasksByUid?.[movedUid]
	const targetTask = store.tasksByUid?.[targetProjectUid]
	if (movedTask?.calendarUrl && targetTask?.calendarUrl) {
		const c1 = movedTask.calendarUrl.replace(/\/+$/, '')
		const c2 = targetTask.calendarUrl.replace(/\/+$/, '')
		if (c1 !== c2) {
			return true
		}
	}
	return false
}

/**
 * Build the consequence sentence for a cross-list move confirmation.
 *
 * @param {string} movedUid UID of the moved task
 * @param {string} targetProjectUid UID of the target project
 * @param {string|null} targetAreaName area name from the drop target dataset
 * @return {string}
 */
function buildConsequenceSentence(movedUid, targetProjectUid, targetAreaName) {
	const store = useProjectsStore()
	const targetTask = store.tasksByUid?.[targetProjectUid]
	const targetTitle = targetTask?.summary || 'project'

	let targetListName = targetAreaName || ''
	if (!targetListName && targetTask?.calendarUrl) {
		const normalized = targetTask.calendarUrl.replace(/\/+$/, '')
		const area = store.areas?.find((a) => (a.calendarUrl || '').replace(/\/+$/, '') === normalized)
		targetListName = area?.name || targetTask.listName || targetTask.calendarName || ''
	}
	if (!targetListName && targetTask?.listName) {
		targetListName = targetTask.listName
	}

	const subtasks = getSubtaskCount(store.tasksByUid, movedUid)
	const subtaskPhrase = subtasks > 0
		? `, with its ${subtasks} ${subtasks === 1 ? 'subtask' : 'subtasks'}`
		: ''
	return `Moves under '${targetTitle}' and to the ${targetListName} list${subtaskPhrase}.`
}

/**
 * Cancel the pending cross-list move and restore the row in the source list.
 */
function cancelCrossListMove() {
	pendingCrossListMove.value = null
	treeKey.value++
	useProjectsStore().rebuildTree()
}

/**
 * Confirm and execute the pending cross-list move.
 */
async function confirmCrossListMove() {
	const pending = pendingCrossListMove.value
	pendingCrossListMove.value = null
	if (!pending) {
		return
	}
	try {
		await useProjectsStore().moveToProject(pending.movedUid, pending.targetProjectUid, pending.fullIndex)
	} catch {
		treeKey.value++
		useProjectsStore().rebuildTree()
	}
}

const crossListConfirmationButtons = computed(() => [
	{
		label: 'Cancel',
		callback: cancelCrossListMove,
	},
	{
		label: 'Move',
		variant: 'primary',
		callback: confirmCrossListMove,
	},
])

/**
 * Turn a finished drag into a reorder or a move to another project.
 *
 * @param {object} evt The sortable end event
 * @return {Promise<void> | undefined} The store's reorder or moveToProject
 */
function onDrop(evt) {
	clearDragState(evt)

	if (!evt.to || evt.from === evt.to) {
		restoreDomPosition(evt)
		const targetParent = parentUid.value || effectiveProjectUid.value
		if (!targetParent) {
			return undefined
		}
		return onSiblingDrop(
			useProjectsStore(),
			{
				parentUid: targetParent,
				allUids: (props.nodes || []).map((node) => node.task?.uid),
				visibleUids: visibleNodes.value.map((node) => node.task?.uid),
			},
			evt,
		)
	}

	// Cross-project drop: Sortable moved the row's element into the target list. Take it out
	// again and let Vue render the moved task in the target from the store (#25).
	evt.item.remove()

	const movedUid = visibleNodes.value[evt.oldIndex]?.task?.uid
	const targetProjectUid = evt.to.dataset.projectUid
	if (!movedUid || !targetProjectUid) {
		return undefined
	}
	const targetAreaName = evt.to.dataset.areaName || null
	const allUids = uidsOf(evt.to, 'allUids')
	const visibleUids = uidsOf(evt.to, 'visibleUids')
	const fullIndex = fullIndexForDrop(allUids, visibleUids, movedUid, evt.newIndex)

	if (isCrossListDrop(movedUid, targetProjectUid, targetAreaName)) {
		const message = buildConsequenceSentence(movedUid, targetProjectUid, targetAreaName)
		pendingCrossListMove.value = {
			movedUid,
			targetProjectUid,
			fullIndex,
			message,
		}
		return undefined
	}

	return useProjectsStore().moveToProject(movedUid, targetProjectUid, fullIndex).catch(() => {
		treeKey.value++
		useProjectsStore().rebuildTree()
	})
}
</script>

<template>
	<Sortable
		:key="`task-tree-${treeKey}`"
		tag="ul"
		class="cc-task-tree"
		:class="`cc-task-tree--level-${depth}`"
		:list="visibleNodes"
		:itemKey="rowKey"
		:options="sortOptions"
		:data-project-uid="effectiveProjectUid"
		:data-area-name="depth === 1 ? areaName : null"
		:data-all-uids="(nodes || []).map((node) => node.task?.uid).filter(Boolean).join(',')"
		:data-visible-uids="visibleNodes.map((node) => node.task?.uid).filter(Boolean).join(',')"
		@start="onDragStart"
		@end="onDrop">
		<template #item="{ element: node }">
			<li
				class="cc-task-tree__item"
				:class="{ 'is-closed': isTaskClosed(node?.task), 'cc-task-tree__item--closed': isTaskClosed(node?.task) }">
				<div
					class="cc-task-tree__row-wrapper drag-handle"
					:class="{ 'is-closed': isTaskClosed(node?.task) }"
					:data-uid="node.task?.uid">
					<button
						v-if="hasVisibleChildren(node)"
						type="button"
						class="cc-task-tree__collapse-toggle"
						:aria-expanded="!isCollapsed(node)"
						:aria-label="isCollapsed(node) ? 'Expand subtasks' : 'Collapse subtasks'"
						@click="toggleCollapse(node)">
						<NcIconSvgWrapper
							class="cc-task-tree__collapse-icon"
							:class="{ 'is-collapsed': isCollapsed(node) }"
							:path="mdiChevronDown"
							:size="20"
							inline />
					</button>
					<span v-else class="cc-task-tree__collapse-placeholder" />
					<TaskRow :node="node" />
					<span
						v-if="hasVisibleChildren(node) && isCollapsed(node)"
						class="cc-task-tree__subtask-count">
						{{ subtaskCount(node) }} {{ subtaskCount(node) === 1 ? 'subtask' : 'subtasks' }}
					</span>
				</div>
				<div
					v-if="hasVisibleChildren(node) && !isCollapsed(node)"
					class="cc-task-tree__children">
					<TaskTree
						:nodes="node.children"
						:depth="depth + 1"
						:showDone="showDone"
						:areaName="areaName"
						:projectUid="effectiveProjectUid"
						:dialogContainer="dialogContainer" />
				</div>
			</li>
		</template>
	</Sortable>
	<NcDialog
		v-if="pendingCrossListMove"
		:open="Boolean(pendingCrossListMove)"
		name="Move to project"
		:message="pendingCrossListMove.message"
		:buttons="crossListConfirmationButtons"
		:container="dialogContainer"
		@update:open="(val) => { if (!val) cancelCrossListMove() }"
		@keydown.esc.stop="cancelCrossListMove" />
</template>

<style scoped>
.cc-task-tree {
	list-style: none;
	margin: 0;
	padding: 0;
}

.cc-task-tree__item {
	margin: calc(var(--default-grid-baseline, 4px) * 1) 0;
}

/* Done rows: secondary text colour and a strike-through, never opacity (it stacks on nested rows). */
.cc-task-tree__row-wrapper.is-closed :deep(.cc-task-row__title) {
	color: var(--color-text-maxcontrast);
	text-decoration: line-through;
}

.cc-task-tree__row-wrapper {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 1);
}

.cc-task-tree__collapse-toggle {
	background: transparent;
	border: none;
	cursor: pointer;
	padding: 2px 4px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--color-text-maxcontrast, #777);
	width: 20px;
	height: 20px;
}

.cc-task-tree__collapse-toggle:focus-visible {
	outline: 2px solid var(--color-primary-element);
}

/* Transforms do not apply to inline boxes, and the wrapper's `inline` makes it one. */
.cc-task-tree__collapse-icon {
	display: inline-flex;
	transition: transform 0.15s;
}

.cc-task-tree__collapse-icon.is-collapsed {
	transform: rotate(-90deg);
}

.cc-task-tree__subtask-count {
	flex-shrink: 0;
	font-size: 0.85rem;
	color: var(--color-text-maxcontrast);
	white-space: nowrap;
}

.cc-task-tree__collapse-placeholder {
	width: 20px;
	height: 20px;
	display: inline-block;
}

/* 24 px per level: 10 px margin, the 1 px guide (under the chevron), 13 px padding. */
.cc-task-tree__children {
	margin-left: 10px;
	padding-left: 13px;
	border-left: 1px solid var(--color-border);
}

@media (max-width: 600px) {
	.cc-task-tree__collapse-toggle,
	button.cc-task-tree__collapse-toggle {
		min-height: 44px;
		min-width: 44px;
	}
}
</style>
