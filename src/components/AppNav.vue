<script setup>
import { mdiCogOutline, mdiFolderOutline, mdiTrayFull } from '@mdi/js'
import {
	NcAppNavigation,
	NcAppNavigationCaption,
	NcAppNavigationItem,
	NcButton,
	NcCounterBubble,
	NcIconSvgWrapper,
} from '@nextcloud/vue'
import { getActivePinia } from 'pinia'
import { computed, nextTick } from 'vue'
import { areaSlug } from '../models/tree.js'
import { useProjectsStore } from '../store/projects.js'

const store = getActivePinia() ? useProjectsStore() : null

const areas = computed(() => store?.areas || [])
const orphans = computed(() => store?.orphans || [])
const untaggedParents = computed(() => store?.untaggedParents || [])
const needsFilingCount = computed(() => orphans.value.length + untaggedParents.value.length)
const currentView = computed(() => store?.view || 'areas')

/**
 * Switch back to the All areas view and scroll to top.
 */
function selectAllAreas() {
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
 */
function selectArea(areaName) {
	if (store) {
		store.view = 'areas'
	}
	nextTick(() => {
		const id = `area-${areaSlug(areaName)}`
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
				v-for="area in areas"
				:key="area.name"
				:name="area.name"
				@click="selectArea(area.name)">
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
				<!-- M21: ReportButton placeholder spot -->
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
