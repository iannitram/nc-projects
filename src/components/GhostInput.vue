<script setup>
import { mdiPlus } from '@mdi/js'
import { NcButton, NcIconSvgWrapper, NcTextField } from '@nextcloud/vue'
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
	label: { type: String, required: true },
	modelValue: { type: String, default: '' },
	disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'submit'])
const editing = ref(false)
const field = ref(null)
const button = ref(null)

/** Open the creation field and move keyboard focus into it. */
async function activate() {
	editing.value = true
	await nextTick()
	field.value?.focus()
}

defineExpose({ activate })

/** A disabled input loses focus, so take it back once creation finishes. */
watch(() => props.disabled, async (now, before) => {
	if (before && !now && editing.value) {
		await nextTick()
		field.value?.focus()
	}
})

/** Cancel a draft and return focus to its creation button. */
async function cancel() {
	if (props.disabled) {
		return
	}
	emit('update:modelValue', '')
	editing.value = false
	await nextTick()
	button.value?.$el.focus()
}

/** Close an empty field when focus moves elsewhere. */
function onBlur() {
	if (!props.modelValue.trim() && !props.disabled) {
		editing.value = false
	}
}
</script>

<template>
	<div class="cc-ghost-input">
		<NcTextField
			v-if="editing"
			ref="field"
			:modelValue="modelValue"
			:placeholder="label"
			:aria-label="label"
			:disabled="disabled"
			@update:modelValue="emit('update:modelValue', $event)"
			@keydown.enter.prevent="emit('submit')"
			@keydown.esc.prevent="cancel"
			@blur="onBlur" />
		<NcButton
			v-else
			ref="button"
			variant="tertiary"
			:disabled="disabled"
			@keydown.enter.prevent="activate"
			@click="activate">
			<template #icon>
				<NcIconSvgWrapper :path="mdiPlus" :size="20" />
			</template>
			<span class="cc-ghost-input__label">{{ label }}</span>
		</NcButton>
	</div>
</template>

<style scoped>
.cc-ghost-input {
	min-width: 0;
	flex: 1;
}

.cc-ghost-input__label {
	color: var(--color-text-maxcontrast);
}
</style>
