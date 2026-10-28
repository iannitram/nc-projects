<script setup>
import { getRequestToken } from '@nextcloud/auth'
import { loadState } from '@nextcloud/initial-state'
import { generateUrl } from '@nextcloud/router'
import { NcAppContent, NcButton, NcContent, NcLoadingIcon } from '@nextcloud/vue'
import { ReportButton } from 'craft-bugreport-web'
import { getActivePinia } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import AppNav from './components/AppNav.vue'
import AreaSection from './components/AreaSection.vue'
import AreaSettings from './components/AreaSettings.vue'
import NeedsFilingTray from './components/NeedsFilingTray.vue'
import StatusLine from './components/StatusLine.vue'
import TopBar from './components/TopBar.vue'
import { useRefresh } from './composables/useRefresh.js'
import { useProjectsStore } from './store/projects.js'

const reportState = loadState('cc_projects', 'bugReport', {})
const reportConfig = {
	app: 'Projects',
	version: reportState.version,
	commit: reportState.commit,
	ncVersion: reportState.ncVersion,
	relayUrl: generateUrl('/apps/cc_projects/api/bugreport'),
	headers: { requesttoken: getRequestToken() },
}
const openArea = ref(null)

const store = getActivePinia() ? useProjectsStore() : null
const areas = computed(() => store?.areas || [])
const loading = computed(() => store?.loading || false)
const error = computed(() => store?.error || null)
const areaLists = computed(() => store?.areaLists)
const orphans = computed(() => store?.orphans || [])
const untaggedParents = computed(() => store?.untaggedParents || [])
const view = computed(() => store?.view || 'areas')

/** @return {Promise<object|null>} a fresh, allowlisted snapshot of the selected area's own tasks */
async function getWorkingFile() {
	if (view.value !== 'areas') {
		return null
	}
	const area = areas.value.find((area) => area.name === openArea.value)
	if (!area) {
		return null
	}
	const roots = [...(area.projects || []), ...(area.done || [])].map((node) => node.task)
	const tasks = Object.values(store?.tasksByUid || {})
	const included = new Map(roots.map((task) => [task.uid, task]))
	// Include descendants below the panel's display depth, but never unrelated tasks.
	for (const parent of included.values()) {
		for (const task of tasks) {
			if (task.parentUid === parent.uid && !included.has(task.uid)) {
				included.set(task.uid, task)
			}
		}
	}
	const snapshot = (task) => ({
		uid: task.uid,
		title: task.summary,
		status: task.status,
		order: task.sortOrder,
		parentUid: task.parentUid,
		url: task.url,
	})
	return {
		name: 'area.json',
		type: 'application/json',
		data: JSON.stringify({
			name: area.name,
			projects: roots.map(snapshot),
			tasks: [...included.values()].filter((task) => !roots.some((root) => root.uid === task.uid)).map(snapshot),
		}),
	}
}

if (store) {
	useRefresh(store.refresh)
}

onMounted(() => {
	store?.load()
})
</script>

<template>
	<NcContent appName="cc_projects">
		<AppNav @selectArea="(name) => openArea = name">
			<template #reportButton>
				<ReportButton :config="reportConfig" :getWorkingFile="getWorkingFile" />
				<p v-if="reportState.configured === false" role="status">
					Bug reports are not set up for this app.
				</p>
			</template>
		</AppNav>
		<NcAppContent>
			<div class="cc-column">
				<TopBar v-if="view === 'areas'" />
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
								:area="area"
								@click="openArea = area.name"
								@focusin="openArea = area.name" />
						</div>
					</div>
				</div>
				<StatusLine />
			</div>
			<AreaSettings v-if="store" />
		</NcAppContent>
	</NcContent>
</template>
