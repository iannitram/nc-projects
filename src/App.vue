<script setup>
import { NcAppContent, NcButton, NcContent, NcLoadingIcon } from '@nextcloud/vue'
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
			<TopBar />
			<div class="cc-projects-scroll">
				<div class="cc-projects">
					<div v-if="loading && areas.length === 0" class="cc-projects__loading">
						<NcLoadingIcon :size="32" name="Loading projects" />
					</div>
					<div v-else-if="error" class="cc-projects__error">
						{{ error }}
					</div>
					<div v-else-if="areaLists && areaLists.length === 0" class="cc-projects__empty">
						<p>Choose your areas</p>
						<NcButton variant="primary" @click="store.settingsOpen = true">
							Choose your areas
						</NcButton>
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
							:area="area" />
					</div>
				</div>
			</div>
			<StatusLine />
			<AreaSettings v-if="store" />
		</NcAppContent>
	</NcContent>
</template>
