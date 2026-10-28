/**
 * `sortablejs-vue3` options shared by every drag list (P08, P09, P11, P12).
 * Tasks' own options: long-press on touch only.
 */
export const DRAG_OPTIONS = Object.freeze({
	delay: 500,
	delayOnTouchOnly: true,
	touchStartThreshold: 3,
	handle: '.drag-handle',
})

/**
 * Work out where a dropped task lands among ALL its siblings, given that
 * Sortable only reports indexes among the rows on screen (closed tasks may be hidden).
 *
 * @param {string[]} allUids every sibling's uid, in sort order, before the drop
 * @param {string[]} visibleUids the rendered siblings' uids, in order, before the drop
 * @param {string} movedUid the dropped task's uid
 * @param {number} newIndex the dropped task's index among the rendered siblings after the drop
 * @return {number} the index among all siblings, as store.reorder expects it
 */
export function fullIndexForDrop(allUids, visibleUids, movedUid, newIndex) {
	const visibleAfter = visibleUids.filter((uid) => uid !== movedUid)
	visibleAfter.splice(newIndex, 0, movedUid)
	const prevUid = newIndex > 0 ? visibleAfter[newIndex - 1] : null
	const nextUid = newIndex < visibleAfter.length - 1 ? visibleAfter[newIndex + 1] : null

	const withoutMoved = allUids.filter((uid) => uid !== movedUid)
	if (prevUid !== null) {
		return withoutMoved.indexOf(prevUid) + 1
	}
	if (nextUid !== null) {
		return withoutMoved.indexOf(nextUid)
	}
	return 0
}

/**
 * Turn a sortablejs end event into a reorder of one parent's child tasks.
 * A drop that did not change the rendered index writes nothing.
 *
 * @param {object} store the projects store (its `reorder` action)
 * @param {object} drop where the drag happened
 * @param {string|null} [drop.parentUid] the project or task whose children were dragged
 * @param {string|null} [drop.areaName] the area name, when parentUid is null
 * @param {string[]} drop.allUids every sibling's uid, in sort order, before the drop
 * @param {string[]} drop.visibleUids the rendered siblings' uids, in order, before the drop
 * @param {{oldIndex?: number, newIndex?: number}} evt the sortable end event
 * @return {Promise<void> | undefined} the store's reorder, or undefined when nothing moved
 */
export function onSiblingDrop(store, drop, evt) {
	const { oldIndex, newIndex } = evt || {}
	if (typeof oldIndex !== 'number' || typeof newIndex !== 'number' || oldIndex === newIndex) {
		return undefined
	}
	const movedUid = drop.visibleUids[oldIndex]
	const fullIndex = fullIndexForDrop(drop.allUids, drop.visibleUids, movedUid, newIndex)
	return store.reorder(drop.parentUid ?? null, drop.areaName ?? null, movedUid, fullIndex)
}
