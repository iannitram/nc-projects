import { ref } from 'vue'

/** How long a finger rests on a row before the row lifts (#123). */
export const LONG_PRESS_MS = 300

/**
 * `sortablejs-vue3` options shared by every drag list (P08, P09, P11, P12).
 * A mouse drags at once; a finger drags after a long press on the row (#123).
 * The lifted row carries `chosenClass`, the landing spot `ghostClass` (styles in projects.css).
 */
export const DRAG_OPTIONS = Object.freeze({
	delay: LONG_PRESS_MS,
	delayOnTouchOnly: true,
	touchStartThreshold: 3,
	handle: '.drag-handle',
	chosenClass: 'cc-drag-chosen',
	ghostClass: 'cc-drag-ghost',
})

/** The long-press hint shows for this many long presses, then never again. */
export const LONG_PRESS_HINT_LIMIT = 3
export const LONG_PRESS_HINT_KEY = 'cc_projects.longPressHints'

/** Whether the one-line long-press hint is on screen (one hint for the whole app). */
export const longPressHintVisible = ref(false)

/**
 * Read how many long presses have shown the hint. Storage may be missing or blocked.
 *
 * @return {number} the count, or the limit when storage can't be read (no hint then)
 */
function readHintCount() {
	try {
		const value = Number.parseInt(window.localStorage.getItem(LONG_PRESS_HINT_KEY) ?? '0', 10)
		return Number.isFinite(value) && value > 0 ? value : 0
	} catch {
		return LONG_PRESS_HINT_LIMIT
	}
}

/**
 * Whether a Sortable event started from a finger (touch event or touch pointer).
 *
 * @param {{originalEvent?: object}} evt the sortable event
 * @return {boolean} true for touch
 */
function isTouchEvent(evt) {
	const original = evt?.originalEvent
	if (!original) {
		return false
	}
	return original.pointerType === 'touch' || String(original.type || '').startsWith('touch')
		|| Boolean(original.touches)
}

/**
 * Sortable's `choose` handler: a long press lifted a row. Show the hint for the first
 * three long presses, counted in localStorage.
 *
 * @param {{originalEvent?: object}} evt the sortable choose event
 */
export function onLongPressChoose(evt) {
	if (!isTouchEvent(evt)) {
		return
	}
	const count = readHintCount()
	if (count >= LONG_PRESS_HINT_LIMIT) {
		return
	}
	longPressHintVisible.value = true
	try {
		window.localStorage.setItem(LONG_PRESS_HINT_KEY, String(count + 1))
	} catch {
		// Storage blocked: the hint still shows this time.
	}
}

/** Sortable's `unchoose` handler: the row was put down, so the hint goes. */
export function onLongPressRelease() {
	longPressHintVisible.value = false
}

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
