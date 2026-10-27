<script setup>
import { NcTextField } from '@nextcloud/vue'
import { ref } from 'vue'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	projectUid: { type: String, required: true },
})

const store = useProjectsStore()
const input = ref('')
const loading = ref(false)

/**
 * Handle form submission
 */
function onSubmit() {
	if (!input.value.trim()) {
		return
	}

	loading.value = true
	store.addTask(props.projectUid, input.value.trim())
		.finally(() => {
			loading.value = false
			input.value = ''
		})
}

/**
 * Handle keyboard events
 *
 * @param {KeyboardEvent} e The keydown event
 */
function onKeydown(e) {
	if (e.key === 'Escape') {
		input.value = ''
	} else if (e.key === 'Enter') {
		onSubmit()
	}
}
</script>

<template>
	<NcTextField
		v-model="input"
		class="cc-add-task-input"
		:placeholder="t('projects', '+ Add task')"
		:disabled="loading"
		@keydown="onKeydown" />
</template>
