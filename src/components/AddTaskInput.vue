<script setup>
import { NcTextField } from '@nextcloud/vue'
import { onBeforeUnmount, ref } from 'vue'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	projectUid: { type: String, required: true },
})

const store = useProjectsStore()
const input = ref('')
const loading = ref(false)

let submitting = false

async function onSubmit() {
	const summary = input.value.trim()
	if (!summary || submitting) {
		return
	}

	submitting = true
	loading.value = true
	try {
		await store.addTask(props.projectUid, summary)
		input.value = ''
	} finally {
		submitting = false
		loading.value = false
	}
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

onBeforeUnmount(() => {
	submitting = false
})
</script>

<template>
	<NcTextField
		v-model="input"
		class="cc-add-task-input"
		:placeholder="t('projects', '+ Add task')"
		:disabled="loading"
		@keydown="onKeydown" />
</template>
