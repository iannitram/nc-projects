<script setup>
// Project header (title, badges, progress, show-done, + Add task) and its tree (P05, P06, P07). Stub: an empty element until its roadmap issue lands.
defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').ProjectNode>} */
	project: { type: Object, required: true },
})
</script>

<template>
	<div class="cc-project-card" />
</template>
