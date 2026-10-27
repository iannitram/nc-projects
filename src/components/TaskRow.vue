<script setup>
// One task: checkbox, title, due, priority, inline edits, open in Tasks (P05, P13). Stub: an empty element until its roadmap issue lands.
defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').TaskNode>} */
	node: { type: Object, required: true },
})
</script>

<template>
	<div class="cc-task-row" />
</template>
