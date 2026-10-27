<script setup>
// Orphans and untagged parents with fix buttons (P15). Stub: an empty element until its roadmap issue lands.
defineProps({
	/** @type {import('vue').PropType<import('../models/Task.js').Task[]>} */
	orphans: { type: Array, required: true },
	/** @type {import('vue').PropType<import('../models/Task.js').Task[]>} */
	untaggedParents: { type: Array, required: true },
})
</script>

<template>
	<div class="cc-needs-filing-tray" />
</template>
