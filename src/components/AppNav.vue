<script setup>
import { mdiCogOutline, mdiFolderOutline, mdiTrayFull } from '@mdi/js'
import { emit } from '@nextcloud/event-bus'
import {
	NcAppNavigation,
	NcAppNavigationCaption,
	NcAppNavigationItem,
	NcButton,
	NcCounterBubble,
	NcIconSvgWrapper,
	useIsMobile,
} from '@nextcloud/vue'
import { getActivePinia } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted } from 'vue'
import { areaId } from '../models/tree.js'
import { useProjectsStore } from '../store/projects.js'

const emitSelection = defineEmits(['selectArea'])

const store = getActivePinia() ? useProjectsStore() : null
const isMobile = useIsMobile()

const areas = computed(() => store?.areas || [])
const orphans = computed(() => store?.orphans || [])
const untaggedParents = computed(() => store?.untaggedParents || [])
const needsFilingCount = computed(() => orphans.value.length + untaggedParents.value.length)
const currentView = computed(() => store?.view || 'areas')

/**
 * On phone width, close Nextcloud's navigation drawer after a choice so the
 * content is visible. On desktop the navigation stays open.
 */
function closeDrawerOnPhone() {
	if (isMobile.value) {
		emit('toggle-navigation', { open: false })
	}
}

const TOGGLE_SELECTOR = '.app-navigation-toggle'
// Anything that owns Escape while it is open: menus (popovers) and dialogs/modals.
const OWNS_ESCAPE_SELECTOR = '.v-popper__popper--shown, .modal-mask, [role="dialog"], [role="menu"]'

/**
 * Escape closes the drawer on phones, but only when nothing else handled the key:
 * open menus and dialogs close themselves first (they stop or prevent the event).
 *
 * @param {KeyboardEvent} event the keydown event
 */
function onEscape(event) {
	if (event.key !== 'Escape' || event.defaultPrevented || !isMobile.value) {
		return
	}
	const toggle = document.querySelector(TOGGLE_SELECTOR)
	if (toggle?.getAttribute('aria-expanded') !== 'true' || document.querySelector(OWNS_ESCAPE_SELECTOR)) {
		return
	}
	emit('toggle-navigation', { open: false })
	toggle.focus()
}

onMounted(() => document.addEventListener('keydown', onEscape))
onUnmounted(() => document.removeEventListener('keydown', onEscape))

/**
 * Switch back to the All areas view and scroll to top.
 */
function selectAllAreas() {
	emitSelection('selectArea', null)
	closeDrawerOnPhone()
	if (store) {
		store.view = 'areas'
	}
	nextTick(() => {
		if (typeof window.scrollTo === 'function') {
			window.scrollTo({ top: 0, behavior: 'smooth' })
		}
	})
}

/**
 * Scroll the matching area section into view without filtering.
 *
 * @param {string} areaName the area's display name
 * @param {number} [index] the area's index in the list
 */
function selectArea(areaName, index) {
	emitSelection('selectArea', areaName)
	closeDrawerOnPhone()
	if (store) {
		store.view = 'areas'
	}
	nextTick(() => {
		const idx = typeof index === 'number'
			? index
			: areas.value.findIndex((a) => a.name === areaName)
		const id = areaId(areaName, idx >= 0 ? idx : 0, areas.value)
		const el = document.getElementById(id)
		if (typeof el?.scrollIntoView === 'function') {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}
	})
}

/**
 * Switch content to the Needs filing tray view.
 */
function selectNeedsFiling() {
	emitSelection('selectArea', null)
	closeDrawerOnPhone()
	if (store) {
		store.view = 'needs-filing'
	}
}

/**
 * Open the area settings modal.
 */
function openSettings() {
	if (store) {
		store.settingsOpen = true
	}
}
</script>

<template>
	<NcAppNavigation aria-label="Projects navigation">
		<template #list>
			<NcAppNavigationItem
				name="All areas"
				:active="currentView === 'areas'"
				@click="selectAllAreas">
				<template #icon>
					<NcIconSvgWrapper :path="mdiFolderOutline" :size="20" />
				</template>
			</NcAppNavigationItem>

			<NcAppNavigationCaption name="Areas" />

			<NcAppNavigationItem
				v-for="(area, index) in areas"
				:key="area.calendarUrl || `${area.name}-${index}`"
				:name="area.name"
				@click="selectArea(area.name, index)">
				<template #icon>
					<span
						class="cc-app-nav__dot"
						:style="{ '--area-color': store ? store.areaColor(area.name) : 'var(--color-primary-element)' }"
						aria-hidden="true" />
				</template>
				<template #counter>
					<NcCounterBubble :count="store ? store.openProjectCount(area.name) : (area.projects?.length || 0)" />
				</template>
			</NcAppNavigationItem>

			<NcAppNavigationCaption name="Tidy up" />

			<NcAppNavigationItem
				name="Needs filing"
				:active="currentView === 'needs-filing'"
				@click="selectNeedsFiling">
				<template #icon>
					<NcIconSvgWrapper :path="mdiTrayFull" :size="20" />
				</template>
				<template #counter>
					<NcCounterBubble
						:count="needsFilingCount"
						:type="needsFilingCount > 0 ? 'highlighted' : undefined" />
				</template>
			</NcAppNavigationItem>
		</template>

		<template #footer>
			<div class="cc-app-nav__footer">
				<slot name="reportButton" />
				<NcButton
					class="cc-app-nav__choose-areas"
					variant="tertiary"
					wide
					alignment="start"
					aria-label="Choose areas"
					@click="openSettings">
					<template #icon>
						<NcIconSvgWrapper :path="mdiCogOutline" :size="20" />
					</template>
					Choose areas
				</NcButton>
			</div>
		</template>
	</NcAppNavigation>
</template>

<style scoped>
.cc-app-nav__dot {
	display: inline-block;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background-color: var(--area-color, var(--color-primary-element));
	flex-shrink: 0;
	margin: auto;
}

.cc-app-nav__footer {
	display: flex;
	flex-direction: column;
	width: 100%;
	padding: var(--default-grid-baseline, 4px);
	box-sizing: border-box;
}

.cc-app-nav__choose-areas {
	width: 100%;
}
</style>
