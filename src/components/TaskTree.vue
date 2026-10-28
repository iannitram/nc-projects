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
import { showInfo } from '@nextcloud/dialogs'
import { NcIconSvgWrapper } from '@nextcloud/vue'
import { Sortable } from 'sortablejs-vue3'
import { computed, ref } from 'vue'
import TaskRow from './TaskRow.vue'
import { DRAG_OPTIONS, fullIndexForDrop, onLongPressChoose, onLongPressRelease, onSiblingDrop } from '../composables/useDrag.js'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').TaskNode[]>} */
	nodes: { type: Array, required: true },
	depth: { type: Number, default: 1 },
	showDone: { type: Boolean, default: false },
	areaName: { type: String, default: null },
	projectUid: { type: String, default: null },
})

const collapsedKeys = ref(new Set())

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

/** Sortable options: Tasks' options, and group configuration (shared across same-area projects for top-level tasks). */
const sortOptions = computed(() => {
	if (props.depth === 1 && props.areaName) {
		return {
			...DRAG_OPTIONS,
			group: {
				name: `cc-tasks-area-${props.areaName}`,
				pull: true,
				put: true,
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
 * Tell the user when a drag was released over a project on another list. Sortable's per-area
 * group refuses that drop silently (no hover or move callback fires for it), so look under the
 * pointer once, when the drag ends. Cross-list moves come later (#26).
 *
 * @param {{originalEvent?: object}} evt The sortable end event
 */
function warnIfDroppedOnOtherList(evt) {
	if (props.depth !== 1 || !props.areaName) {
		return
	}
	const point = evt.originalEvent?.changedTouches?.[0] ?? evt.originalEvent
	if (typeof point?.clientX !== 'number' || typeof document.elementFromPoint !== 'function') {
		return
	}
	const under = document.elementFromPoint(point.clientX, point.clientY)
	const targetArea = under?.closest?.('[data-area-name]')?.dataset.areaName
	if (targetArea && targetArea !== props.areaName) {
		showInfo("Can't move a task to a project on another list yet")
	}
}

/**
 * Turn a finished drag into a reorder or a move to another project.
 *
 * @param {object} evt The sortable end event
 * @return {Promise<void> | undefined} The store's reorder or moveToProject
 */
function onDrop(evt) {
	if (!evt.to || evt.from === evt.to) {
		restoreDomPosition(evt)
		warnIfDroppedOnOtherList(evt)
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

	// Cross-list: Sortable moved the row's element into the target list. Take it out again and
	// let Vue render the moved task in the target from the store. (Putting it back in the source
	// list does not work: Vue keeps each row between two anchor nodes, and an element re-inserted
	// by index lands outside the anchors of its own row, so Vue never removes it and the row
	// stays in the source list until a reload. Without the element in the source DOM, Vue's
	// removal of the row is a no-op.)
	evt.item.remove()

	const movedUid = visibleNodes.value[evt.oldIndex]?.task?.uid
	const targetProjectUid = evt.to.dataset.projectUid
	if (!movedUid || !targetProjectUid) {
		return undefined
	}
	const allUids = uidsOf(evt.to, 'allUids')
	const visibleUids = uidsOf(evt.to, 'visibleUids')
	const fullIndex = fullIndexForDrop(allUids, visibleUids, movedUid, evt.newIndex)
	return useProjectsStore().moveToProject(movedUid, targetProjectUid, fullIndex)
}
</script>

<template>
	<Sortable
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
		@choose="onLongPressChoose"
		@unchoose="onLongPressRelease"
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
						:projectUid="effectiveProjectUid" />
				</div>
			</li>
		</template>
	</Sortable>
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
</style>
