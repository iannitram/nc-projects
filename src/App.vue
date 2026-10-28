<script setup>
import { mdiCloudAlertOutline, mdiLayersOutline, mdiRefresh } from '@mdi/js'
import { NcAppContent, NcButton, NcContent, NcEmptyContent, NcIconSvgWrapper } from '@nextcloud/vue'
import { getActivePinia } from 'pinia'
import { computed, onMounted } from 'vue'
import AppNav from './components/AppNav.vue'
import AreaSection from './components/AreaSection.vue'
import AreaSettings from './components/AreaSettings.vue'
import NeedsFilingTray from './components/NeedsFilingTray.vue'
import StatusLine from './components/StatusLine.vue'
import TopBar from './components/TopBar.vue'
import { useRefresh } from './composables/useRefresh.js'
import { useProjectsStore } from './store/projects.js'

const store = getActivePinia() ? useProjectsStore() : null
const areas = computed(() => store?.areas || [])
const loading = computed(() => store?.loading || false)
const error = computed(() => store?.error || null)
const areaLists = computed(() => store?.areaLists)
const orphans = computed(() => store?.orphans || [])
const untaggedParents = computed(() => store?.untaggedParents || [])
const view = computed(() => store?.view || 'areas')

const errorDescription = computed(() => {
	const reason = error.value
		? (error.value.endsWith('.') ? error.value : `${error.value}.`)
		: "The server didn't answer."
	return `${reason} Your tasks are safe; nothing was changed.`
})

if (store) {
	useRefresh(store.refresh)
}

onMounted(() => {
	store?.load()
})
</script>

<template>
	<NcContent appName="cc_projects">
		<AppNav />
		<NcAppContent>
			<div class="cc-column">
				<TopBar />
				<div class="cc-projects-scroll">
					<div class="cc-projects">
						<div
							v-if="loading && areas.length === 0"
							class="cc-projects__loading"
							aria-busy="true"
							aria-label="Loading projects">
							<div
								v-for="n in 3"
								:key="n"
								class="cc-skeleton-area">
								<div class="cc-skeleton-heading" />
								<div class="cc-skeleton-rows">
									<div
										v-for="i in 3"
										:key="i"
										class="cc-skeleton-row" />
								</div>
							</div>
						</div>
						<div v-else-if="error" class="cc-projects__error">
							<NcEmptyContent
								name="Couldn't load your task lists"
								:description="errorDescription">
								<template #icon>
									<NcIconSvgWrapper :path="mdiCloudAlertOutline" :size="48" />
								</template>
								<template #action>
									<NcButton @click="store?.load()">
										<template #icon>
											<NcIconSvgWrapper :path="mdiRefresh" :size="20" />
										</template>
										Try again
									</NcButton>
								</template>
							</NcEmptyContent>
						</div>
						<div v-else-if="areaLists && areaLists.length === 0" class="cc-projects__empty">
							<NcEmptyContent
								name="Choose your areas"
								description="Areas are the task lists you plan in, such as Home or Work. Pick the ones to show here. Projects reads them as they are, and you can change your choice later.">
								<template #icon>
									<NcIconSvgWrapper :path="mdiLayersOutline" :size="48" />
								</template>
								<template #action>
									<NcButton variant="primary" @click="store.settingsOpen = true">
										Choose areas
									</NcButton>
								</template>
							</NcEmptyContent>
						</div>
						<div v-else-if="view === 'needs-filing'" class="cc-projects__needs-filing">
							<NeedsFilingTray
								:orphans="orphans"
								:untaggedParents="untaggedParents" />
						</div>
						<div v-else class="cc-projects__areas">
							<AreaSection
								v-for="area in areas"
								:key="area.name"
								:area="area"
								:loading="loading" />
						</div>
					</div>
				</div>
				<StatusLine />
			</div>
			<AreaSettings v-if="store" />
		</NcAppContent>
	</NcContent>
</template>

<style scoped>
.cc-skeleton-area {
	margin-bottom: calc(var(--default-grid-baseline, 4px) * 6);
}

.cc-skeleton-heading {
	width: 140px;
	height: 24px;
	border-radius: var(--border-radius-element, 8px);
	background: var(--color-background-dark, #ededed);
	margin-bottom: calc(var(--default-grid-baseline, 4px) * 3);
	opacity: 0.7;
}

.cc-skeleton-rows {
	display: flex;
	flex-direction: column;
	gap: calc(var(--default-grid-baseline, 4px) * 2);
}

.cc-skeleton-row {
	height: 44px;
	border-radius: var(--border-radius-element, 8px);
	background: var(--color-background-dark, #ededed);
	opacity: 0.6;
}
</style>
