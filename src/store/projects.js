/**
 * The panel's state (P05, P10 and every write feature). Pinia.
 * Writes are optimistic with rollback; a ConflictError reloads the task (rule 3).
 * Stub: state and action names only.
 */
import { showError, showInfo } from '@nextcloud/dialogs'
import { defineStore } from 'pinia'
import { markRaw, toRaw } from 'vue'
import { planCompletion } from '../models/completion.js'
import { placeMoved } from '../models/sortOrder.js'
import { Task } from '../models/Task.js'
import { buildTree, isSomeday } from '../models/tree.js'
import { candidateLists, pickAreas } from '../services/areas.js'
import { ConflictError, createTodo, fetchTodo, fetchTodos, getDavSession, listTaskCalendars, putTodo } from '../services/dav.js'
import { getAreaLists, saveAreaLists as persistAreaLists } from '../services/settings.js'

let pendingConflictReloads = 0
let successfulConflictReloads = 0
let noticeScheduled = false

/**
 * Queue a task reload caused by a ConflictError and show one quiet notice.
 *
 * @param {() => Promise<void>} reloadFn the reload callback
 * @return {Promise<boolean>} true when the reload succeeded, false when it failed
 */
function queueConflictReload(reloadFn) {
	pendingConflictReloads++
	return reloadFn().then(
		() => {
			successfulConflictReloads++
			return true
		},
		() => false,
	).finally(() => {
		pendingConflictReloads--
		if (pendingConflictReloads === 0 && !noticeScheduled) {
			noticeScheduled = true
			Promise.resolve().then(() => {
				noticeScheduled = false
				if (pendingConflictReloads === 0 && successfulConflictReloads > 0) {
					showInfo('Someone else changed this; reloaded')
				}
				successfulConflictReloads = 0
			})
		}
	})
}

/**
 * Record collapsed state of every task node in the tree.
 *
 * @param {import('../models/tree.js').AreaNode[]} areas the area tree
 * @return {Map<string, boolean>}
 */
function collectCollapseState(areas) {
	const state = new Map()
	/**
	 * @param {import('../models/tree.js').TaskNode[]} nodes the task nodes
	 */
	function walk(nodes) {
		for (const node of nodes || []) {
			if (node?.task?.uid && typeof node.collapsed === 'boolean') {
				state.set(node.task.uid, node.collapsed)
			}
			if (node?.children?.length) {
				walk(node.children)
			}
		}
	}
	for (const area of areas || []) {
		for (const project of area.projects || []) {
			walk(project.children)
		}
		for (const project of area.done || []) {
			walk(project.children)
		}
	}
	return state
}

/**
 * Restore collapsed state onto new tree nodes.
 *
 * @param {import('../models/tree.js').AreaNode[]} areas the new area tree
 * @param {Map<string, boolean>} state the saved collapsed state
 */
function restoreCollapseState(areas, state) {
	if (!state || state.size === 0) {
		return
	}
	/**
	 * @param {import('../models/tree.js').TaskNode[]} nodes the task nodes
	 */
	function walk(nodes) {
		for (const node of nodes || []) {
			if (node?.task?.uid && state.has(node.task.uid)) {
				try {
					node.collapsed = state.get(node.task.uid)
				} catch {
					// Ignore if node is frozen
				}
			}
			if (node?.children?.length) {
				walk(node.children)
			}
		}
	}
	for (const area of areas || []) {
		for (const project of area.projects || []) {
			walk(project.children)
		}
		for (const project of area.done || []) {
			walk(project.children)
		}
	}
}

/**
 * Depth-first search of a tree of task nodes for the node whose task has a uid.
 *
 * @param {import('../models/tree.js').TaskNode[]} nodes the nodes to search, with their children
 * @param {string} uid the task's uid
 * @return {import('../models/tree.js').TaskNode|null} the node, or null when it is not in the tree
 */
function findNode(nodes, uid) {
	for (const node of nodes || []) {
		if (node.task.uid === uid) {
			return node
		}
		const found = findNode(node.children, uid)
		if (found) {
			return found
		}
	}
	return null
}

export const useProjectsStore = defineStore('projects', {
	state: () => ({
		/** @type {import('../models/tree.js').AreaNode[]} */
		areas: [],
		/** @type {string[]|null} */
		areaLists: null,
		/** @type {import('../services/dav.js').TaskCalendar[]} */
		availableLists: [],
		settingsOpen: false,
		/** @type {{name: string, calendar: import('../services/dav.js').TaskCalendar}[]} */
		areaInputs: [],
		/** @type {import('../models/Task.js').Task[]} */
		orphans: [],
		/** @type {import('../models/Task.js').Task[]} */
		untaggedParents: [],
		/** @type {Record<string, import('../models/Task.js').Task>} */
		tasksByUid: {},
		/** @type {Record<string, string|undefined>} */
		ctags: {},
		/** @type {object|null} */
		davSession: null,
		loading: false,
		/** @type {string|null} */
		error: null,
	}),
	actions: {
		/** Read every area list and build the tree (P05). */
		async load() {
			this.davSession ??= markRaw(getDavSession())
			this.loading = true
			this.error = null
			try {
				const [areaLists, calendars] = await Promise.all([getAreaLists(), listTaskCalendars(this.davSession)])
				this.areaLists = areaLists
				this.availableLists = candidateLists(calendars)
				const areas = pickAreas(calendars, this.areaLists)
				this.areaInputs = areas
				const todosByArea = await Promise.all(areas.map((area) => fetchTodos(area.calendar, this.davSession)))
				const tasks = todosByArea.flat().map((todo) => Task.fromIcs(todo.ics, {
					url: todo.url,
					etag: todo.etag,
					calendarUrl: todo.calendarUrl,
				}))
				this.tasksByUid = Object.fromEntries(tasks.filter((task) => task.uid).map((task) => [task.uid, task]))
				this.ctags = Object.fromEntries(areas.map((area) => [area.calendar.url, area.calendar.ctag]))
				this.rebuildTree(tasks)
			} catch (error) {
				this.error = (error instanceof Error ? (error.message || error.name) : String(error)) || 'Could not load the task lists'
			} finally {
				this.loading = false
			}
		},
		/** Re-read only lists whose ctag changed (P10). */
		async refresh() {
			try {
				this.davSession ??= markRaw(getDavSession())
				const calendars = await listTaskCalendars(this.davSession)
				const areas = pickAreas(calendars, this.areaLists || [])
				this.areaInputs = areas
				const changedAreas = areas.filter((area) => this.ctags[area.calendar.url] !== area.calendar.ctag)
				if (changedAreas.length === 0) {
					return
				}

				const todosByArea = await Promise.all(changedAreas.map((area) => fetchTodos(area.calendar, this.davSession)))
				const tasksByUid = { ...this.tasksByUid }
				for (const [index, area] of changedAreas.entries()) {
					for (const [uid, task] of Object.entries(tasksByUid)) {
						if (toRaw(task).calendarUrl === area.calendar.url) {
							delete tasksByUid[uid]
						}
					}
					const tasks = todosByArea[index].map((todo) => Task.fromIcs(todo.ics, {
						url: todo.url,
						etag: todo.etag,
						calendarUrl: todo.calendarUrl,
					}))
					for (const task of tasks.filter((item) => item.uid)) {
						tasksByUid[task.uid] = task
					}
				}

				this.tasksByUid = tasksByUid
				this.ctags = {
					...this.ctags,
					...Object.fromEntries(changedAreas.map((area) => [area.calendar.url, area.calendar.ctag])),
				}
				this.rebuildTree()
			} catch {
				// Keep the current state when a list cannot be refreshed.
			}
		},
		async saveAreaLists(urls) {
			try {
				this.areaLists = await persistAreaLists(urls)
				this.settingsOpen = false
				await this.load()
			} catch {
				showError('Could not save your areas')
			}
		},
		/**
		 * Rebuild the area tree from tasks, preserving collapse state across rebuilds.
		 *
		 * @param {import('../models/Task.js').Task[]} [tasks] optional tasks to build from; defaults to all tasks in store
		 */
		rebuildTree(tasks) {
			const taskSource = tasks || Object.values(this.tasksByUid)
			const taskList = taskSource.map((task) => toRaw(task))
			const areas = this.areaLists !== null
				? this.areaInputs
				: this.areas.map((area) => ({
						name: area.name,
						calendar: area.calendar || { url: area.calendarUrl, displayName: area.name },
					}))
			const collapseState = collectCollapseState(this.areas)
			const tree = buildTree(areas, taskList)
			restoreCollapseState(tree.areas, collapseState)
			this.areas = tree.areas
			this.orphans = tree.orphans
			this.untaggedParents = tree.untaggedParents
		},
		/**
		 * Reload tasks by URLs and rebuild the tree.
		 *
		 * @param {string[]} urls the tasks' URLs
		 * @param {boolean} [useSession] whether to pass session to fetchTodo
		 */
		async reloadTasks(urls, useSession = false) {
			const urlList = (Array.isArray(urls) ? urls : [urls]).filter(Boolean)
			if (urlList.length === 0) {
				return
			}
			if (useSession) {
				this.davSession ??= markRaw(getDavSession())
			}
			const storedList = await Promise.all(urlList.map((url) => (useSession ? fetchTodo(url, this.davSession) : fetchTodo(url))))
			for (const stored of storedList) {
				if (stored?.ics) {
					const task = Task.fromIcs(stored.ics, {
						url: stored.url,
						etag: stored.etag,
						calendarUrl: stored.calendarUrl,
					})
					this.tasksByUid[task.uid] = task
				}
			}
			this.rebuildTree()
		},
		/**
		 * Reload a single task by URL and rebuild the tree.
		 *
		 * @param {string} url the task's URL
		 */
		async reloadTask(url) {
			return this.reloadTasks([url], true)
		},
		/**
		 * Reload tasks after a ConflictError (412) and show one quiet notice.
		 *
		 * @param {import('../services/dav.js').ConflictError|string|string[]|{url?: string}[]} errorOrUrls the error or task URL(s)
		 */
		async handleConflict(errorOrUrls) {
			const isArray = Array.isArray(errorOrUrls)
			let urls = []
			if (isArray) {
				urls = errorOrUrls.map((item) => (typeof item === 'string' ? item : item?.url)).filter(Boolean)
			} else if (typeof errorOrUrls === 'string') {
				urls = [errorOrUrls]
			} else if (errorOrUrls?.url) {
				urls = [errorOrUrls.url]
			}
			if (urls.length === 0) {
				return
			}
			return queueConflictReload(() => this.reloadTasks(urls, !isArray))
		},
		/**
		 * @param {string} projectUid the project
		 * @param {string} summary the new task's title
		 * @return {Promise<string>} The uid of the created task
		 */
		async addTask(projectUid, summary) {
			this.davSession ??= markRaw(getDavSession())
			const project = this.tasksByUid[projectUid]
			if (!project) {
				showError('Could not add the task: project not found')
				return null
			}

			const task = Task.create({
				summary,
				calendarUrl: project.calendarUrl,
				parentUid: projectUid,
			})

			try {
				const created = await createTodo(this.calendarOf(project), task.toIcs(), this.davSession)
				task.where = {
					...task.where,
					url: created.url,
					etag: created.etag,
					calendarUrl: created.calendarUrl,
				}
				this.tasksByUid[task.uid] = task
				this.rebuildTree()
				return task.uid
			} catch (error) {
				if (error instanceof ConflictError) {
					const reloaded = await this.handleConflict(error)
					if (!reloaded) {
						showError('Could not add the task')
					}
					return null
				}
				showError('Could not add the task')
				return null
			}
		},
		/**
		 * @param {import('../models/Task.js').Task} task the task
		 * @return {object} calendar object
		 */
		calendarOf(task) {
			const area = this.areas.find((candidate) => candidate.calendarUrl === task.calendarUrl)
			return area?.calendar || { url: task.calendarUrl }
		},
		/**
		 * @param {string|null} parentUid the parent (a project, or null for projects in an area)
		 * @param {string} areaName the area, when parentUid is null
		 * @param {string} movedUid the dragged task or project
		 * @param {number} newIndex its index after the drop
		 */
		async reorder(parentUid, areaName, movedUid, newIndex) {
			let siblings
			if (parentUid === null) {
				const area = this.areas.find((a) => a.name === areaName)
				if (!area) {
					return
				}
				siblings = (area.projects || []).filter((project) => !isSomeday(project.task)).map((project) => project.task)
			} else {
				// Find the parent node at any depth of the tree
				let parentNode = null
				for (const area of this.areas) {
					for (const project of area.projects) {
						parentNode = project.task.uid === parentUid ? project : findNode(project.children, parentUid)
						if (parentNode) {
							break
						}
					}
					if (parentNode) {
						break
					}
				}

				// If parent not found, return without doing anything
				if (!parentNode) {
					return
				}

				// Get the children of the parent in display order
				siblings = parentNode.children?.map((child) => child.task) || []
			}

			// If the moved task is not among the children, return without doing anything
			if (!siblings.some((task) => task.uid === movedUid)) {
				return
			}

			// Prepare the siblings data for placeMoved function
			const siblingsForPlaceMoved = siblings.map((task) => ({
				uid: task.uid,
				sortOrder: task.sortOrder,
				created: task.created,
			}))

			// Get the tasks that need to be updated
			const toUpdate = placeMoved(siblingsForPlaceMoved, movedUid, newIndex)

			// If no tasks to update (unknown moved uid), return early
			if (toUpdate.length === 0) {
				return
			}

			// Optimistic: keep each task's original resource, then apply the new
			// sort orders and rebuild the tree before the first write is awaited
			const before = new Map()
			for (const { uid, sortOrder } of toUpdate) {
				const task = this.tasksByUid[uid]
				if (task) {
					before.set(uid, { ics: toRaw(task).toIcs(), where: toRaw(task).where })
					task.sortOrder = sortOrder
				}
			}
			this.rebuildTree()

			// A landed write keeps its new sort order and new etag; only the failed
			// write and the ones not yet sent are rolled back
			const landed = new Set()
			try {
				for (const { uid } of toUpdate) {
					const task = this.tasksByUid[uid]
					if (task) {
						const stored = await putTodo(task.url, task.toIcs(), task.etag)
						toRaw(task).where = { ...toRaw(task).where, etag: stored.etag }
						landed.add(uid)
					}
				}
			} catch (error) {
				// Handle ConflictError differently: reload every task of the change
				if (error instanceof ConflictError) {
					const reloaded = await this.handleConflict(toUpdate.map(({ uid }) => this.tasksByUid[uid]?.url).filter(Boolean))
					if (!reloaded) {
						showError('Could not save the new order')
					}
					return
				}

				for (const [uid, original] of before) {
					if (!landed.has(uid)) {
						this.tasksByUid[uid] = Task.fromIcs(original.ics, original.where)
					}
				}
				this.rebuildTree()
				showError('Could not save the new order')
			}
		},
		/**
		 * @param {string} taskUid the task
		 * @param {string} projectUid the new project
		 * @param {number} newIndex where it lands among the project's tasks
		 */
		async moveToProject(taskUid, projectUid, newIndex) {
			this.davSession ??= markRaw(getDavSession())
			const moved = this.tasksByUid[taskUid]
			if (!moved) {
				showError('Could not move the task: task not found')
				return
			}

			// Find the target project in the tree
			let targetProject = null
			for (const area of this.areas) {
				for (const project of area.projects) {
					if (project.task.uid === projectUid) {
						targetProject = project
						break
					}
				}
				if (targetProject) {
					break
				}
			}

			if (!targetProject) {
				showError('Could not move the task: target project not found')
				return
			}

			// Get all siblings in the destination project, including the moved task for calculation purposes
			const siblings = (targetProject.children?.map((child) => child.task) || []).map((task) => ({
				uid: task.uid,
				sortOrder: task.sortOrder,
				created: task.created,
			}))

			// Add the moved task to siblings list for placement calculation
			const movedTaskInSiblings = {
				uid: moved.uid,
				sortOrder: moved.sortOrder,
				created: moved.created,
			}

			// Include the moved task in the siblings list so placeMoved can calculate its new position correctly
			siblings.push(movedTaskInSiblings)

			// Calculate where the moved task should be placed using placeMoved function
			const toUpdate = placeMoved(siblings, taskUid, newIndex)

			if (toUpdate.length === 0) {
				return
			}

			const rebuild = () => {
				const tree = buildTree(this.areas.map((area) => ({
					name: area.name,
					calendar: { url: area.calendarUrl },
				})), Object.values(this.tasksByUid))
				this.areas = tree.areas
				this.orphans = tree.orphans
				this.untaggedParents = tree.untaggedParents
			}

			// Optimistic: keep each task's original resource, then apply the new sort orders and rebuild before the first write is awaited
			const before = new Map()
			for (const { uid, sortOrder } of toUpdate) {
				const task = this.tasksByUid[uid]
				if (task) {
					before.set(uid, { ics: toRaw(task).toIcs(), where: toRaw(task).where })
					toRaw(task).sortOrder = sortOrder
					// For the moved task, also update its parentUid to point to new project
					if (uid === taskUid) {
						toRaw(task).parentUid = projectUid
					}
				}
			}
			rebuild()

			// A landed write keeps its new sort order and new etag; only the failed write and the ones not yet sent are rolled back
			const landed = new Set()
			try {
				for (const { uid } of toUpdate) {
					const task = this.tasksByUid[uid]
					if (task) {
						const stored = await putTodo(task.url, task.toIcs(), task.etag)
						toRaw(task).where = { ...toRaw(task).where, etag: stored.etag }
						landed.add(uid)
					}
				}
			} catch (error) {
				// Handle ConflictError differently: reload every task of the change
				if (error instanceof ConflictError) {
					try {
						for (const { uid } of toUpdate) {
							const task = this.tasksByUid[uid]
							if (task) {
								const stored = await fetchTodo(task.url)
								const updatedTask = Task.fromIcs(stored.ics, {
									url: stored.url,
									etag: stored.etag,
									calendarUrl: stored.calendarUrl,
								})
								this.tasksByUid[uid] = updatedTask
							}
						}

						rebuild()
						showInfo('Someone else changed this; reloaded')
					} catch {
						// If reload fails, show error
						showError('Could not save the move')
					}
					return
				}

				for (const [uid, original] of before) {
					if (!landed.has(uid)) {
						this.tasksByUid[uid] = Task.fromIcs(original.ics, original.where)
					}
				}
				rebuild()
				showError('Could not save the move')
			}
		},
		/**
		 * @param {string} uid the task
		 * @param {boolean} done check off or reopen, with Tasks' cascades
		 */
		async setCompleted(uid, done) {
			const plan = planCompletion(this.tasksByUid, uid, done)
			if (plan.length === 0) {
				return
			}

			const before = plan.map((planUid) => {
				const task = this.tasksByUid[planUid]
				return { uid: planUid, ics: toRaw(task).toIcs(), where: toRaw(task).where }
			})

			for (const planUid of plan) {
				this.tasksByUid[planUid].completed = done
			}
			this.rebuildTree()

			try {
				for (const planUid of plan) {
					const task = this.tasksByUid[planUid]
					const stored = await putTodo(task.url, task.toIcs(), task.etag)
					toRaw(task).where = { ...toRaw(task).where, etag: stored.etag }
				}
			} catch (error) {
				if (error instanceof ConflictError) {
					const reloaded = await this.handleConflict(plan.map((planUid) => this.tasksByUid[planUid]?.url).filter(Boolean))
					if (!reloaded) {
						showError('Could not save the change')
					}
					return
				}

				for (const saved of before) {
					this.tasksByUid[saved.uid] = Task.fromIcs(saved.ics, saved.where)
				}
				this.rebuildTree()
				showError('Could not save the change')
			}
		},
		/**
		 * @param {string} uid the task
		 * @param {{summary?: string, due?: (Date|null), priority?: number}} changes quick edits
		 */
		async updateTask(uid, changes) {
			this.davSession ??= markRaw(getDavSession())
			const task = this.tasksByUid[uid]
			if (!task || !changes || Object.keys(changes).length === 0) {
				return
			}

			// Store the original values for rollback
			const originalIcs = task.toIcs()
			const originalWhere = { ...task.where }

			// Apply changes using the task's setters to ensure proper handling
			// Apply other changes first
			if ('summary' in changes) {
				task.summary = changes.summary
			}
			if ('due' in changes) {
				task.due = changes.due
			}

			// Handle priority: 0 removes the property, others set the value
			if ('priority' in changes) {
				task.priority = changes.priority
			}

			// Rebuild the tree with the updated task, preserving collapse state.
			this.rebuildTree()

			try {
				// Write the updated task to the server
				const result = await putTodo(task.url, task.toIcs(), task.etag)
				// Update the etag in the task
				task.where = {
					...task.where,
					etag: result.etag,
				}
			} catch (error) {
				if (error instanceof ConflictError) {
					const reloaded = await this.handleConflict([task.url])
					if (!reloaded) {
						showError('Could not save the change')
					}
				} else {
					// Restore original values and show error
					const restoredTask = Task.fromIcs(originalIcs, originalWhere)
					this.tasksByUid[uid] = restoredTask

					this.rebuildTree()

					showError('Could not save the change')
				}
			}
		},
		/**
		 * @param {string} areaName the area
		 * @param {string} summary the project's title
		 */
		async createProject(areaName, summary) {
			try {
				this.davSession ??= markRaw(getDavSession())
				const area = this.areas.find((item) => item.name === areaName)
				if (!area) {
					throw new Error(`Area not found: ${areaName}`)
				}
				const calendar = await listTaskCalendars(this.davSession)
				const areaCalendar = calendar.find((item) => item.url === area.calendarUrl || item.displayName === areaName)
				if (!areaCalendar) {
					throw new Error(`Calendar not found for area: ${areaName}`)
				}
				const task = Task.create({ summary, calendarUrl: areaCalendar.url, categories: ['project'] })
				const stored = await createTodo(areaCalendar, task.toIcs(), this.davSession)
				const created = Task.fromIcs(stored.ics, { url: stored.url, etag: stored.etag, calendarUrl: stored.calendarUrl })
				this.tasksByUid[created.uid] = created
				this.rebuildTree()
			} catch (error) {
				if (error instanceof ConflictError) {
					const reloaded = await this.handleConflict(error)
					if (!reloaded) {
						showError('Could not create the project')
					}
					return
				}
				showError('Could not create the project')
				throw error
			}
		},
		/**
		 * @param {string} uid a parent task with children but no `project` tag
		 */
		async makeProject(uid) {
			const task = this.tasksByUid[uid]
			if (!task || task.isProject) {
				return
			}

			const raw = toRaw(task)
			const before = { uid, ics: raw.toIcs(), where: raw.where }

			task.categories = [...task.categories, 'project']
			this.rebuildTree()

			try {
				const stored = await putTodo(raw.url, raw.toIcs(), raw.etag)
				toRaw(task).where = { ...toRaw(task).where, etag: stored.etag }
			} catch (error) {
				if (error instanceof ConflictError) {
					const reloaded = await this.handleConflict([raw.url])
					if (!reloaded) {
						showError('Could not make the project')
					}
					return
				}

				this.tasksByUid[uid] = Task.fromIcs(before.ics, before.where)
				this.rebuildTree()
				showError('Could not make the project')
			}
		},
	},
})
