<script>
/** How long the toast stays after the last change, unless hovered or focused (issue 162). */
export const UNDO_TOAST_MS = 10000
</script>

<script setup>
import { mdiClose } from '@mdi/js'
import { NcButton, NcIconSvgWrapper } from '@nextcloud/vue'
import { getActivePinia } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { topUndo } from '../models/undo.js'
import { useProjectsStore } from '../store/projects.js'

const store = getActivePinia() ? useProjectsStore() : null

const root = ref(null)
const hovered = ref(false)
const focused = ref(false)
/** True once the time since the last change has run out. */
const expired = ref(false)
let timer = null

const stack = computed(() => store?.undoStack || [])
const newest = computed(() => topUndo(stack.value))
const earlier = computed(() => Math.max(0, stack.value.length - 1))
const error = computed(() => store?.undoError || null)
const undoing = computed(() => store?.undoing || false)

/** Shown while there is a change or an undo error; a held toast stays past the timer. */
const visible = computed(() => {
	if (error.value) {
		return true
	}
	return newest.value !== null && (!expired.value || hovered.value || focused.value)
})

/** Restart the 10 s count from now: a change was just recorded. */
function startTimer() {
	clearTimer()
	expired.value = false
	timer = setTimeout(() => {
		timer = null
		expired.value = true
	}, UNDO_TOAST_MS)
}

/** Stop the count, if one is running. */
function clearTimer() {
	if (timer !== null) {
		clearTimeout(timer)
		timer = null
	}
}

// A new change is a new stack; sync flush so the count starts at the change itself.
watch(() => store?.undoStack, (next) => {
	if (next?.length) {
		startTimer()
	} else {
		clearTimer()
		expired.value = false
	}
}, { flush: 'sync' })

/**
 * Focus left the toast unless it moved to another control inside it.
 *
 * @param {FocusEvent} event the focusout event
 */
function onFocusOut(event) {
	if (!root.value?.contains(event.relatedTarget)) {
		focused.value = false
	}
}

/** Restore the newest change. */
async function onUndo() {
	await store?.undo()
}

onMounted(() => {
	if (stack.value.length > 0) {
		startTimer()
	}
})

onBeforeUnmount(clearTimer)
</script>

<template>
	<div
		ref="root"
		class="cc-undo-toast"
		role="status"
		aria-live="polite"
		@mouseenter="hovered = true"
		@mouseleave="hovered = false"
		@focusin="focused = true"
		@focusout="onFocusOut">
		<div v-if="visible" class="cc-undo-toast__card">
			<p class="cc-undo-toast__text">
				<template v-if="error">
					{{ error }}
				</template>
				<template v-else>
					{{ newest.label }}
				</template>
				<span v-if="earlier > 0" class="cc-undo-toast__earlier">
					+{{ earlier }} earlier
				</span>
			</p>
			<NcButton
				v-if="newest"
				class="cc-undo-toast__undo"
				:disabled="undoing"
				@click="onUndo">
				{{ undoing ? 'Undoing...' : 'Undo' }}
			</NcButton>
			<NcButton
				class="cc-undo-toast__dismiss"
				variant="tertiary"
				aria-label="Dismiss"
				title="Dismiss"
				@click="store?.clearUndo()">
				<template #icon>
					<NcIconSvgWrapper :path="mdiClose" :size="20" />
				</template>
			</NcButton>
		</div>
	</div>
</template>

<style scoped>
/* Fixed above the status line, over every view and overlay (the wheel's sheets sit under 10000). */
.cc-undo-toast {
	position: fixed;
	inset-inline: calc(var(--default-grid-baseline, 4px) * 4);
	bottom: calc(var(--cc-status-height, 30px) + var(--default-grid-baseline, 4px) * 2);
	z-index: 10100;
	display: flex;
	justify-content: center;
	pointer-events: none;
}

.cc-undo-toast__card {
	pointer-events: auto;
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	max-width: 560px;
	min-width: 0;
	padding: calc(var(--default-grid-baseline, 4px) * 1) calc(var(--default-grid-baseline, 4px) * 2) calc(var(--default-grid-baseline, 4px) * 1) calc(var(--default-grid-baseline, 4px) * 4);
	border-radius: var(--border-radius-large, 12px);
	border: 1px solid var(--color-border);
	background: var(--color-main-background);
	color: var(--color-main-text);
	box-shadow: 0 2px 12px var(--color-box-shadow);
	box-sizing: border-box;
}

.cc-undo-toast__text {
	flex: 1 1 auto;
	min-width: 0;
	margin: 0;
	font-size: 14px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.cc-undo-toast__earlier {
	margin-inline-start: calc(var(--default-grid-baseline, 4px) * 2);
	color: var(--color-text-maxcontrast);
}

.cc-undo-toast__undo,
.cc-undo-toast__dismiss {
	flex: none;
}

@media (max-width: 600px) {
	.cc-undo-toast__card {
		width: 100%;
	}
}
</style>
