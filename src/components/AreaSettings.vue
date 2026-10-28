<script setup>
import { NcButton, NcCheckboxRadioSwitch, NcDialog } from '@nextcloud/vue'
import { computed, ref, watch } from 'vue'
import { listTaskCalendars } from '../services/dav.js'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	/**
	 * Optional list of all calendars (for testing or direct injection).
	 *
	 * @type {import('vue').PropType<import('../services/dav.js').TaskCalendar[]>}
	 */
	calendars: { type: Array, default: null },
	/**
	 * Optional pre-computed excluded counts (for testing).
	 *
	 * @type {import('vue').PropType<{ shared?: number, agent?: number, deck?: number }>}
	 */
	excludedCounts: { type: Object, default: null },
	/**
	 * Container selector for NcDialog mounting (defaults to body in NcDialog).
	 * Pass null to mount in-place.
	 *
	 * @type {import('vue').PropType<string | null>}
	 */
	container: { type: [String, Object], default: undefined },
})

const store = useProjectsStore()
const selected = ref([])
const open = computed(() => store?.settingsOpen ?? false)
const counts = ref({ shared: 0, agent: 0, deck: 0 })

/**
 * Fetch all task calendars and count excluded lists.
 */
async function fetchExcludedCounts() {
	if (props.excludedCounts) {
		counts.value = {
			shared: props.excludedCounts.shared ?? 0,
			agent: props.excludedCounts.agent ?? 0,
			deck: props.excludedCounts.deck ?? 0,
		}
		return
	}
	try {
		const calendars = props.calendars || (await listTaskCalendars(store?.davSession))
		if (Array.isArray(calendars)) {
			let shared = 0
			let agent = 0
			let deck = 0
			for (const cal of calendars) {
				if (cal?.url?.includes('app-generated--deck--')) {
					deck++
				} else if (cal?.url?.includes('_shared_by_')) {
					agent++
				} else if (cal?.ownedByMe === false) {
					shared++
				}
			}
			counts.value = { shared, agent, deck }
		}
	} catch {
		// Keep defaults if DAV call fails or is unavailable
	}
}

watch(open, (isOpen) => {
	if (isOpen) {
		selected.value = [...(store?.areaLists || [])]
		fetchExcludedCounts()
	}
}, { immediate: true })

/**
 * Discard changes and close dialog.
 */
function cancel() {
	selected.value = [...(store?.areaLists || [])]
	if (store) {
		store.settingsOpen = false
	}
}

/**
 * Save selected areas and close dialog.
 */
function save() {
	if (!store) {
		return
	}
	const urls = (store.availableLists || [])
		.filter((calendar) => selected.value.includes(calendar.url))
		.map((calendar) => calendar.url)
	store.saveAreaLists(urls)
}

/**
 * Get the calendar color, falling back to Nextcloud primary element color.
 *
 * @param {import('../services/dav.js').TaskCalendar} calendar The calendar
 * @return {string} CSS color
 */
function getCalendarColor(calendar) {
	if (calendar?.color) {
		return calendar.color.startsWith('#') ? calendar.color : `#${calendar.color}`
	}
	if (store?.areaColor && calendar?.displayName) {
		return store.areaColor(calendar.displayName)
	}
	return 'var(--color-primary-element)'
}

/**
 * Get the open task count string if already loaded.
 *
 * @param {import('../services/dav.js').TaskCalendar} calendar The calendar
 * @return {string | null} Count string or null
 */
function getTaskCount(calendar) {
	if (!store?.openTaskCount) {
		return null
	}
	const isLoaded = store.areas?.some((area) => area.name === calendar?.displayName || area.calendarUrl === calendar?.url)
	if (!isLoaded) {
		return null
	}
	const count = store.openTaskCount(calendar.displayName)
	if (typeof count !== 'number') {
		return null
	}
	return `${count} open ${count === 1 ? 'task' : 'tasks'}`
}

const excludedNote = computed(() => {
	const { shared, agent, deck } = counts.value
	const parts = [
		`${shared} ${shared === 1 ? 'shared list' : 'shared lists'}`,
		`${agent} ${agent === 1 ? 'agent queue' : 'agent queues'}`,
		`${deck} ${deck === 1 ? 'Deck board' : 'Deck boards'}`,
	]
	return `Shared lists, agent queues and Deck boards can't be areas, so they aren't listed (${parts.join(', ')}).`
})
</script>

<template>
	<NcDialog
		:open="open"
		name="Choose areas"
		size="normal"
		:container="container"
		@closing="cancel"
		@update:open="(val) => { if (!val) cancel() }">
		<p class="cc-area-settings__help">
			Each area you tick becomes a section of the panel. Untick one to hide it; nothing on the list changes.
		</p>
		<div class="cc-area-settings__list">
			<div
				v-for="calendar in (store?.availableLists || [])"
				:key="calendar.url"
				class="cc-area-settings__checkbox-row">
				<NcCheckboxRadioSwitch
					v-model="selected"
					:value="calendar.url">
					<span class="cc-area-settings__item">
						<span
							class="cc-area-settings__swatch"
							:style="{ backgroundColor: getCalendarColor(calendar) }"
							aria-hidden="true" />
						<span class="cc-area-settings__lbl">{{ calendar.displayName }}</span>
						<span v-if="getTaskCount(calendar)" class="cc-area-settings__meta">
							{{ getTaskCount(calendar) }}
						</span>
					</span>
				</NcCheckboxRadioSwitch>
			</div>
		</div>
		<div class="cc-area-settings__excluded">
			{{ excludedNote }}
		</div>
		<template #actions>
			<NcButton @click="cancel">
				Cancel
			</NcButton>
			<NcButton variant="primary" @click="save">
				Save
			</NcButton>
		</template>
	</NcDialog>
</template>

<style scoped>
.cc-area-settings__help {
	margin: 0 0 calc(var(--default-grid-baseline, 4px) * 3);
	color: var(--color-text-maxcontrast);
	font-size: 14px;
	text-wrap: pretty;
}

.cc-area-settings__list {
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline, 4px) * 1);
}

.cc-area-settings__checkbox-row {
	display: flex;
	align-items: center;
	min-height: 40px;
	border-radius: var(--border-radius-element, 8px);
}

.cc-area-settings__checkbox-row:hover {
	background: var(--color-background-hover);
}

/* NcCheckboxRadioSwitch's own content area is the click target (one toggle per click),
 * so it fills the row; the default slot holds the visible name, swatch and count. */
.cc-area-settings__checkbox-row :deep(.checkbox-radio-switch) {
	display: flex;
	width: 100%;
}

.cc-area-settings__checkbox-row :deep(.checkbox-radio-switch__content) {
	flex: 1;
	min-width: 0;
	min-height: 40px;
	box-sizing: border-box;
	padding: 0 calc(var(--default-grid-baseline, 4px) * 2);
	cursor: pointer;
}

.cc-area-settings__item {
	display: flex;
	align-items: center;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
	width: 100%;
}

.cc-area-settings__swatch {
	width: 10px;
	height: 10px;
	border-radius: 50%;
	flex: none;
}

.cc-area-settings__lbl {
	flex: 1;
	min-width: 0;
	color: var(--color-main-text);
}

.cc-area-settings__meta {
	color: var(--color-text-maxcontrast);
	font-size: 13px;
	margin-left: auto;
}

.cc-area-settings__excluded {
	margin-top: calc(var(--default-grid-baseline, 4px) * 2.5);
	padding: calc(var(--default-grid-baseline, 4px) * 2.5) calc(var(--default-grid-baseline, 4px) * 3);
	border-radius: var(--border-radius-element, 8px);
	background: var(--color-band, var(--color-background-hover));
	color: var(--color-text-maxcontrast);
	font-size: 13px;
	text-wrap: pretty;
}
</style>
