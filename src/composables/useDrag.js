/**
 * `sortablejs-vue3` options shared by every drag list (P08, P09, P11, P12).
 * Tasks' own options: long-press on touch only.
 * Stub: the options are real; the drop wiring lands with P08.
 */
export const DRAG_OPTIONS = Object.freeze({
	delay: 500,
	delayOnTouchOnly: true,
	touchStartThreshold: 3,
	handle: '.drag-handle',
})
