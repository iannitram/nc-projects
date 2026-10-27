/**
 * Tasks to areas, projects and task trees (P04, P15). Pure.
 */
import { effectiveSortOrder } from './sortOrder.js'

/**
 * @typedef {object} TaskNode
 * @property {import('./Task.js').Task} task the task
 * @property {TaskNode[]} children its children, in sort order (empty below maxDepth)
 * @property {number} deeper how many descendants lie below maxDepth ("+N deeper")
 */

/**
 * @typedef {object} ProjectNode
 * @property {import('./Task.js').Task} task the project's VTODO (category `project`)
 * @property {TaskNode[]} children its tasks, in sort order
 * @property {{done: number, total: number}} progress over every descendant at every level
 */

/**
 * @typedef {object} AreaNode
 * @property {string} name area name
 * @property {string} calendarUrl the area's list
 * @property {ProjectNode[]} projects open projects, in sort order, `someday` last
 * @property {ProjectNode[]} done completed projects (the Done strip)
 */

/**
 *
 * @param task
 */
function isProject(task) {
	if (typeof task.isProject === 'boolean') {
		return task.isProject
	}
	if (Array.isArray(task.categories)) {
		return task.categories.some((cat) => typeof cat === 'string' && cat.toLowerCase() === 'project')
	}
	return false
}

/**
 *
 * @param task
 */
function isSomeday(task) {
	if (Array.isArray(task.categories)) {
		return task.categories.some((cat) => typeof cat === 'string' && cat.toLowerCase() === 'someday')
	}
	return false
}

/**
 *
 * @param task
 */
function isTaskCompleted(task) {
	if (task.completed === true) {
		return true
	}
	if (typeof task.status === 'string' && task.status.toUpperCase() === 'COMPLETED') {
		return true
	}
	return Boolean(task.completed)
}

/**
 *
 * @param task
 */
function isTaskCancelled(task) {
	return typeof task.status === 'string' && task.status.toUpperCase() === 'CANCELLED'
}

/**
 *
 * @param url1
 * @param url2
 */
function urlsMatch(url1, url2) {
	if (url1 === url2) {
		return true
	}
	if (typeof url1 === 'string' && typeof url2 === 'string') {
		return url1.replace(/\/+$/, '') === url2.replace(/\/+$/, '')
	}
	return false
}

/**
 *
 * @param aTask
 * @param bTask
 */
function compareTasks(aTask, bTask) {
	return effectiveSortOrder(aTask) - effectiveSortOrder(bTask)
}

/**
 *
 * @param aNode
 * @param bNode
 */
function compareProjects(aNode, bNode) {
	const aSomeday = isSomeday(aNode.task)
	const bSomeday = isSomeday(bNode.task)
	if (aSomeday !== bSomeday) {
		return aSomeday ? 1 : -1
	}
	return compareTasks(aNode.task, bNode.task)
}

/**
 *
 * @param rootUid
 * @param childrenByParentUid
 */
function getDescendants(rootUid, childrenByParentUid) {
	const descendants = []
	const initial = childrenByParentUid.get(rootUid) || []
	const queue = [...initial]
	const seen = new Set()

	for (const task of queue) {
		if (task.uid) {
			seen.add(task.uid)
		}
	}

	while (queue.length > 0) {
		const task = queue.shift()
		descendants.push(task)
		if (!task.uid) {
			continue
		}
		const children = childrenByParentUid.get(task.uid) || []
		for (const child of children) {
			if (child.uid && !seen.has(child.uid)) {
				seen.add(child.uid)
				queue.push(child)
			}
		}
	}

	return descendants
}

/**
 *
 * @param projectUid
 * @param childrenByParentUid
 */
function calculateProgress(projectUid, childrenByParentUid) {
	const descendants = getDescendants(projectUid, childrenByParentUid)
	let done = 0
	let total = 0

	for (const task of descendants) {
		if (isTaskCancelled(task)) {
			continue
		}
		total++
		if (isTaskCompleted(task)) {
			done++
		}
	}

	return { done, total }
}

/**
 *
 * @param task
 * @param currentDepth
 * @param maxDepth
 * @param childrenByParentUid
 * @param ancestors
 */
function buildTaskNode(task, currentDepth, maxDepth, childrenByParentUid, ancestors) {
	if (currentDepth >= maxDepth) {
		return {
			task,
			children: [],
			deeper: getDescendants(task.uid, childrenByParentUid).length,
		}
	}

	const rawChildren = childrenByParentUid.get(task.uid) || []
	const validChildren = rawChildren.filter((child) => !child.uid || !ancestors.has(child.uid))
	const sortedChildren = [...validChildren].sort((a, b) => compareTasks(a, b))

	const nextAncestors = new Set(ancestors)
	if (task.uid) {
		nextAncestors.add(task.uid)
	}

	const children = sortedChildren.map((child) => buildTaskNode(child, currentDepth + 1, maxDepth, childrenByParentUid, nextAncestors))

	return {
		task,
		children,
		deeper: 0,
	}
}

/**
 *
 * @param projectUid
 * @param maxDepth
 * @param childrenByParentUid
 */
function buildProjectChildren(projectUid, maxDepth, childrenByParentUid) {
	if (maxDepth <= 0) {
		return []
	}
	const rawChildren = childrenByParentUid.get(projectUid) || []
	const validChildren = rawChildren.filter((child) => child.uid !== projectUid)
	const sortedChildren = [...validChildren].sort((a, b) => compareTasks(a, b))

	const ancestors = new Set()
	if (projectUid) {
		ancestors.add(projectUid)
	}

	return sortedChildren.map((child) => buildTaskNode(child, 1, maxDepth, childrenByParentUid, ancestors))
}

/**
 * Build the panel's tree. Children follow RELATED-TO across lists (ADR 0007).
 *
 * @param {{name: string, calendar: import('../services/dav.js').TaskCalendar}[]} areas from pickAreas
 * @param {import('./Task.js').Task[]} tasks every task on every area list
 * @param {object} [options] options
 * @param {number} [options.maxDepth] levels shown under a project (default 3)
 * @return {{areas: AreaNode[], orphans: import('./Task.js').Task[], untaggedParents: import('./Task.js').Task[]}}
 */
export function buildTree(areas, tasks, options = {}) {
	const maxDepth = typeof options.maxDepth === 'number' ? options.maxDepth : 3
	const inputTasks = (tasks || []).filter(Boolean)
	const childrenByParentUid = new Map()
	for (const task of inputTasks) {
		if (task.parentUid) {
			let list = childrenByParentUid.get(task.parentUid)
			if (!list) {
				list = []
				childrenByParentUid.set(task.parentUid, list)
			}
			list.push(task)
		}
	}
	const tasksByUid = new Map()
	for (const task of inputTasks) {
		if (task.uid && !tasksByUid.has(task.uid)) {
			tasksByUid.set(task.uid, task)
		}
	}
	const isOpen = (task) => !isTaskCompleted(task) && !isTaskCancelled(task)
	const orphans = inputTasks.filter((task) => {
		if (!isOpen(task) || !task.parentUid || isProject(task)) {
			return false
		}
		const parent = tasksByUid.get(task.parentUid)
		return !parent || !isOpen(parent)
	})
	const orphanUids = new Set(orphans.map((task) => task.uid).filter(Boolean))
	const untaggedParents = inputTasks.filter((task) => isOpen(task)
		&& task.uid
		&& !isProject(task)
		&& !task.parentUid
		&& (childrenByParentUid.get(task.uid) || []).length > 0
		&& !orphanUids.has(task.uid))
	const trayUids = new Set([...orphans, ...untaggedParents].map((task) => task.uid).filter(Boolean))
	const treeChildrenByParentUid = new Map()
	for (const [parentUid, children] of childrenByParentUid) {
		treeChildrenByParentUid.set(parentUid, children.filter((task) => !trayUids.has(task.uid)))
	}

	const areaNodes = (areas || []).map((area) => ({
		name: area.name,
		calendarUrl: area.calendar?.url || '',
		projects: [],
		done: [],
	}))

	for (const task of tasks || []) {
		if (!task || trayUids.has(task.uid) || !isProject(task)) {
			continue
		}

		const areaNode = areaNodes.find((node) => urlsMatch(task.calendarUrl, node.calendarUrl))
		if (!areaNode) {
			continue
		}

		const projectNode = {
			task,
			children: buildProjectChildren(task.uid, maxDepth, treeChildrenByParentUid),
			progress: calculateProgress(task.uid, childrenByParentUid),
		}

		if (isTaskCompleted(task)) {
			areaNode.done.push(projectNode)
		} else {
			areaNode.projects.push(projectNode)
		}
	}

	for (const areaNode of areaNodes) {
		areaNode.projects.sort(compareProjects)
		areaNode.done.sort((a, b) => compareTasks(a.task, b.task))
	}

	return {
		areas: areaNodes,
		orphans: [...new Set(orphans)].sort(compareTasks),
		untaggedParents: [...new Set(untaggedParents)].sort(compareTasks),
	}
}
