<script setup>
// Nested TaskRows, three levels, then '+N deeper'; drop zone (P05, P08, P12). Stub: an empty element until its roadmap issue lands.
defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').TaskNode[]>} */
	nodes: { type: Array, required: true },
})
</script>

<template>
	<div class="cc-task-tree" />
</template>
