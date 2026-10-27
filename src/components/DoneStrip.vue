<script setup>
// Collapsed list of an area's completed projects (P06). Stub: an empty element until its roadmap issue lands.
defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').ProjectNode[]>} */
	projects: { type: Array, required: true },
})
</script>

<template>
	<div class="cc-done-strip" />
</template>
