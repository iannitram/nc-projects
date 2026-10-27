<script setup>
import { NcAppContent, NcContent, NcLoadingIcon } from '@nextcloud/vue'
import { getActivePinia } from 'pinia'
import { computed, onMounted } from 'vue'
import AreaSection from './components/AreaSection.vue'
import { useProjectsStore } from './store/projects.js'

const store = getActivePinia() ? useProjectsStore() : null
const areas = computed(() => store?.areas || [])
const loading = computed(() => store?.loading || false)
const error = computed(() => store?.error || null)

onMounted(() => {
	store?.load()
})
</script>

<template>
	<NcContent appName="cc_projects">
		<NcAppContent>
			<div class="cc-projects">
				<h2>Projects</h2>
				<div v-if="loading && areas.length === 0" class="cc-projects__loading">
					<NcLoadingIcon :size="32" name="Loading projects" />
				</div>
				<div v-else-if="error" class="cc-projects__error">
					{{ error }}
				</div>
				<div v-else class="cc-projects__areas">
					<AreaSection
						v-for="area in areas"
						:key="area.name"
						:area="area" />
				</div>
			</div>
		</NcAppContent>
	</NcContent>
</template>
