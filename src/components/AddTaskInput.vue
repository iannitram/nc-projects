<script setup>
import { NcButton } from '@nextcloud/vue'
import { onBeforeUnmount, ref } from 'vue'
import GhostInput from './GhostInput.vue'
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	projectUid: { type: String, required: true },
	doneCount: { type: Number, default: 0 },
	showDone: { type: Boolean, default: false },
})

const emit = defineEmits(['update:showDone'])

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
		const uid = await store.addTask(props.projectUid, summary)
		if (uid) {
			input.value = ''
		}
	} finally {
		submitting = false
		loading.value = false
	}
}

onBeforeUnmount(() => {
	submitting = false
})
</script>

<template>
	<div class="cc-add-task-input">
		<GhostInput
			v-model="input"
			label="Add task"
			:disabled="loading"
			@submit="onSubmit" />
		<div v-if="doneCount > 0" class="cc-add-task-input__done">
			<span>{{ doneCount }} done ·</span>
			<NcButton
				variant="tertiary"
				:aria-label="`${showDone ? 'Hide' : 'Show'} done tasks`"
				@click="emit('update:showDone', !showDone)">
				{{ showDone ? 'Hide' : 'Show' }}
			</NcButton>
		</div>
	</div>
</template>

<style scoped>
.cc-add-task-input,
.cc-add-task-input__done {
	display: flex;
	align-items: center;
	gap: 4px;
}

.cc-add-task-input {
	flex-wrap: wrap;
}

.cc-add-task-input__done {
	margin-inline-start: auto;
	color: var(--color-text-maxcontrast);
	font-size: 13px;
}
</style>
