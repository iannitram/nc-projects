/**
 * Plan which tasks to write when checking off or reopening a task.
 *
 * @param {Record<string, Task>} tasksByUid - Map of all tasks by their uid
 * @param {string} uid - The uid of the task to plan completion for
 * @param {boolean} done - True to check off (cascade down), false to reopen (cascade up)
 * @return {string[]} - Array of uids in the order they should be written
 */
export function planCompletion(tasksByUid, uid, done) {
	if (!tasksByUid[uid]) {
		return []
	}

	const task = tasksByUid[uid]

	// If we're checking off and the task is already closed, return empty array
	if (done && task.closed) {
		return []
	}

	// If we're reopening and the task is not closed, return empty array
	if (!done && !task.closed) {
		return []
	}

	if (done) {
		// Check off: list the task and its open descendants breadth-first
		const result = [uid]
		const visited = new Set([uid])
		const toProcess = [uid]

		while (toProcess.length > 0) {
			const currentUid = toProcess.shift()

			// Process all children of the current task
			for (const childTask of Object.values(tasksByUid)) {
				const childUid = childTask.uid
				if (!visited.has(childUid)) {
					if (childTask.parentUid === currentUid) {
						visited.add(childUid)
						toProcess.push(childUid)
						if (!childTask.closed) {
							result.push(childUid)
						}
					}
				}
			}
		}

		return result
	} else {
		// Reopen: list the task and its closed ancestors up to project
		const result = [uid]
		const visited = new Set([uid])

		let currentUid = uid
		while (true) {
			const currentTask = tasksByUid[currentUid]

			if (!currentTask || !currentTask.parentUid || visited.has(currentTask.parentUid)) {
				break
			}

			const parentUid = currentTask.parentUid
			const parentTask = tasksByUid[parentUid]

			if (parentTask && !visited.has(parentUid)) {
				// Include a closed project, then stop at the project boundary.
				if (parentTask.isProject) {
					if (parentTask.closed) {
						result.push(parentUid)
					}
					break
				}

				// Include the parent if it's closed
				if (parentTask.closed) {
					result.push(parentUid)
				}

				visited.add(parentUid)
				currentUid = parentUid
			} else {
				break
			}
		}

		return result
	}
}
