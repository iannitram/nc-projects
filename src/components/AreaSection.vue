<script setup>
// One area: project cards, Done strip, + New project (P05, P06, P14). Stub: an empty element until its roadmap issue lands.
defineProps({
	/** @type {import('vue').PropType<import('../models/tree.js').AreaNode>} */
	area: { type: Object, required: true },
})
</script>

<template>
	<div class="cc-area-section" />
</template>
