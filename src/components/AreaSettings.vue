<script setup>
import { NcButton, NcCheckboxRadioSwitch, NcModal } from '@nextcloud/vue'
import { computed, ref, watch } from 'vue'
import { useProjectsStore } from '../store/projects.js'

const store = useProjectsStore()
const selected = ref([])
const open = computed(() => store.settingsOpen)

watch(open, (isOpen) => {
	if (isOpen) {
		selected.value = [...(store.areaLists || [])]
	}
})

function save() {
	store.saveAreaLists(store.availableLists.filter((calendar) => selected.value.includes(calendar.url)).map((calendar) => calendar.url))
}
</script>

<template>
	<NcModal v-if="open" @close="store.settingsOpen = false">
		<div class="cc-projects__settings">
			<h2>Choose your areas</h2>
			<NcCheckboxRadioSwitch
				v-for="calendar in store.availableLists"
				:key="calendar.url"
				v-model="selected"
				:value="calendar.url">
				{{ calendar.displayName }}
			</NcCheckboxRadioSwitch>
			<NcButton variant="primary" @click="save">
				Save
			</NcButton>
		</div>
	</NcModal>
</template>
