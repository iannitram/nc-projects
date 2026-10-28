<script setup>
import { useProjectsStore } from '../store/projects.js'

const props = defineProps({
	/** @type {import('vue').PropType<import('../models/Task.js').Task[]>} */
	orphans: { type: Array, required: true },
	/** @type {import('vue').PropType<import('../models/Task.js').Task[]>} */
	untaggedParents: { type: Array, required: true },
})

const store = useProjectsStore()

/**
 * Turn an orphan or untagged parent into a project.
 *
 * @param {import('../models/Task.js').Task} task task to promote
 * @return {Promise<void>}
 */
async function makeProject(task) {
	try {
		await store.makeProject(task.uid)
	} catch {
		// The store already showed the error toast.
	}
}
</script>

<template>
	<section
		v-if="props.orphans.length + props.untaggedParents.length > 0"
		class="cc-needs-filing-tray">
		<div v-if="props.orphans.length > 0">
			<h4 class="cc-needs-filing-tray__title">
				Orphan tasks ({{ props.orphans.length }})
			</h4>
			<ul>
				<li
					v-for="task in props.orphans"
					:key="task.uid"
					class="cc-needs-filing-tray__item">
					{{ task.summary }}
					<button
						type="button"
						@click="makeProject(task)">
						Make project
					</button>
				</li>
			</ul>
		</div>
		<div v-if="props.untaggedParents.length > 0">
			<h4 class="cc-needs-filing-tray__title">
				Parents without a project tag ({{ props.untaggedParents.length }})
			</h4>
			<ul>
				<li
					v-for="task in props.untaggedParents"
					:key="task.uid"
					class="cc-needs-filing-tray__item">
					{{ task.summary }}
					<button
						type="button"
						@click="makeProject(task)">
						Make project
					</button>
				</li>
			</ul>
		</div>
	</section>
</template>
