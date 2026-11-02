/**
 * Get the project uid for a task, traversing up the parent hierarchy
 *
 * @param {Record<string, Task>} tasksByUid - Map of all tasks by uid
 * @param {string} uid - The uid of the task to find the project for
 * @return {string|null} The uid of the project, or null if not found
 */
export function projectOf(tasksByUid, uid) {
	const seen = new Set()
	let current = tasksByUid[uid]
	while (current && !seen.has(current.uid)) {
		if (current.isProject) {
			return current.uid
		}
		seen.add(current.uid)
		current = current.parentUid ? tasksByUid[current.parentUid] : undefined
	}
	return null
}

/**
 * Get the location of a task, trimmed and lower-cased
 *
 * @param {Task} task - The task to get the location for
 * @return {string} The location trimmed and lower-cased, or empty string if none
 */
export function placeOf(task) {
	return (task.location ?? '').trim().toLowerCase()
}

/**
 * Get related tasks that are in the same project or at the same location
 *
 * @param {Record<string, Task>} tasksByUid - Map of all tasks by uid
 * @param {string} uid - The uid of the task to find related tasks for
 * @param {string[]} leftOut - Array of uids to exclude from results
 * @return {string[]} Array of related task uids in Object.values order
 */
export function relatedTasks(tasksByUid, uid, leftOut = []) {
	const picked = tasksByUid[uid]
	if (!picked) {
		return []
	}

	const project = projectOf(tasksByUid, uid)
	const place = placeOf(picked)

	return Object.values(tasksByUid)
		.filter((task) => task.uid !== uid
			&& !task.closed
			&& !task.isProject
			&& !leftOut.includes(task.uid)
			&& ((project !== null && projectOf(tasksByUid, task.uid) === project)
				|| (place !== '' && placeOf(task) === place)))
		.map((task) => task.uid)
}
