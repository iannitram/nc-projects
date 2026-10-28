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
import { buildTree } from '../models/tree.js'
import { notImplemented } from '../notImplemented.js'
import { pickAreas } from '../services/areas.js'
import { ConflictError, createTodo, fetchTodo, fetchTodos, getDavSession, listTaskCalendars, putTodo } from '../services/dav.js'

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
				const calendars = await listTaskCalendars(this.davSession)
				const areas = pickAreas(calendars)
				const todosByArea = await Promise.all(areas.map((area) => fetchTodos(area.calendar, this.davSession)))
				const tasks = todosByArea.flat().map((todo) => Task.fromIcs(todo.ics, {
					url: todo.url,
					etag: todo.etag,
					calendarUrl: todo.calendarUrl,
				}))
				const tree = buildTree(areas, tasks)
				this.areas = tree.areas
				this.orphans = tree.orphans
				this.untaggedParents = tree.untaggedParents
				this.tasksByUid = Object.fromEntries(tasks.filter((task) => task.uid).map((task) => [task.uid, task]))
				this.ctags = Object.fromEntries(areas.map((area) => [area.calendar.url, area.calendar.ctag]))
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
				const areas = pickAreas(calendars)
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

				const tree = buildTree(areas, Object.values(tasksByUid).map((task) => toRaw(task)))
				this.areas = tree.areas
				this.orphans = tree.orphans
				this.untaggedParents = tree.untaggedParents
				this.tasksByUid = tasksByUid
				this.ctags = {
					...this.ctags,
					...Object.fromEntries(changedAreas.map((area) => [area.calendar.url, area.calendar.ctag])),
				}
			} catch {
				// Keep the current state when a list cannot be refreshed.
			}
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

				const allTasks = Object.values(this.tasksByUid)
				const tree = buildTree(this.areas.map((area) => ({
					name: area.name,
					calendar: { url: area.calendarUrl },
				})), allTasks)
				this.areas = tree.areas
				this.orphans = tree.orphans
				this.untaggedParents = tree.untaggedParents
				return task.uid
			} catch {
				showError('Could not add the task')
				return null
			}
		},
		/**
		 * @param {import('../models/Task.js').Task} task
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
			// The projects-in-an-area case (parentUid null) is another issue
			if (parentUid === null) {
				return notImplemented('reorder', parentUid, areaName, movedUid, newIndex)
			}

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
			const siblings = parentNode.children?.map((child) => child.task) || []

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

			const rebuild = () => {
				const tree = buildTree(this.areas.map((area) => ({
					name: area.name,
					calendar: { url: area.calendarUrl },
				})), Object.values(this.tasksByUid))
				this.areas = tree.areas
				this.orphans = tree.orphans
				this.untaggedParents = tree.untaggedParents
			}

			// Optimistic: keep each task's original resource, then apply the new
			// sort orders and rebuild the tree before the first write is awaited
			const before = new Map()
			for (const { uid, sortOrder } of toUpdate) {
				const task = this.tasksByUid[uid]
				if (task) {
					before.set(uid, { ics: toRaw(task).toIcs(), where: toRaw(task).where })
					toRaw(task).sortOrder = sortOrder
				}
			}
			rebuild()

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
						showError('Could not save the new order')
					}
					return
				}

				for (const [uid, original] of before) {
					if (!landed.has(uid)) {
						this.tasksByUid[uid] = Task.fromIcs(original.ics, original.where)
					}
				}
				rebuild()
				showError('Could not save the new order')
			}
		},
		/**
		 * @param {string} taskUid the task
		 * @param {string} projectUid the new project
		 * @param {number} newIndex where it lands among the project's tasks
		 */
		async moveToProject(taskUid, projectUid, newIndex) {
			return notImplemented('moveToProject', taskUid, projectUid, newIndex)
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

			const rebuild = () => {
				const tree = buildTree(this.areas.map((area) => ({
					name: area.name,
					calendar: { url: area.calendarUrl },
				})), Object.values(this.tasksByUid))
				this.areas = tree.areas
				this.orphans = tree.orphans
				this.untaggedParents = tree.untaggedParents
			}

			const before = plan.map((planUid) => {
				const task = this.tasksByUid[planUid]
				return { uid: planUid, ics: toRaw(task).toIcs(), where: toRaw(task).where }
			})

			for (const planUid of plan) {
				toRaw(this.tasksByUid[planUid]).completed = done
			}
			rebuild()

			try {
				for (const planUid of plan) {
					const task = this.tasksByUid[planUid]
					const stored = await putTodo(task.url, task.toIcs(), task.etag)
					toRaw(task).where = { ...toRaw(task).where, etag: stored.etag }
				}
			} catch (error) {
				if (error instanceof ConflictError) {
					const stored = await Promise.all(plan.map((planUid) => fetchTodo(this.tasksByUid[planUid].url)))
					for (const todo of stored) {
						const reloaded = Task.fromIcs(todo.ics, {
							url: todo.url,
							etag: todo.etag,
							calendarUrl: todo.calendarUrl,
						})
						this.tasksByUid[reloaded.uid] = reloaded
					}
					rebuild()
					showInfo('Someone else changed this; reloaded')
					return
				}

				for (const saved of before) {
					this.tasksByUid[saved.uid] = Task.fromIcs(saved.ics, saved.where)
				}
				rebuild()
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

			// Rebuild the tree with the updated task
			const allTasks = Object.values(this.tasksByUid)
			const tree = buildTree(this.areas.map((area) => ({
				name: area.name,
				calendar: { url: area.calendarUrl },
			})), allTasks)
			this.areas = tree.areas
			this.orphans = tree.orphans
			this.untaggedParents = tree.untaggedParents

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
					// Reload the task and show info
					const stored = await fetchTodo(task.url)
					const updatedTask = Task.fromIcs(stored.ics, {
						url: stored.url,
						etag: stored.etag,
						calendarUrl: stored.calendarUrl,
					})
					this.tasksByUid[uid] = updatedTask

					const allTasks = Object.values(this.tasksByUid)
					const tree = buildTree(this.areas.map((area) => ({
						name: area.name,
						calendar: { url: area.calendarUrl },
					})), allTasks)
					this.areas = tree.areas
					this.orphans = tree.orphans
					this.untaggedParents = tree.untaggedParents

					showInfo('Someone else changed this; reloaded')
				} else {
					// Restore original values and show error
					const restoredTask = Task.fromIcs(originalIcs, originalWhere)
					this.tasksByUid[uid] = restoredTask

					const allTasks = Object.values(this.tasksByUid)
					const tree = buildTree(this.areas.map((area) => ({
						name: area.name,
						calendar: { url: area.calendarUrl },
					})), allTasks)
					this.areas = tree.areas
					this.orphans = tree.orphans
					this.untaggedParents = tree.untaggedParents

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
				const areas = this.areas.map((item) => ({ name: item.name, calendar: { url: item.calendarUrl } }))
				const tree = buildTree(areas, Object.values(this.tasksByUid))
				this.areas = tree.areas
				this.orphans = tree.orphans
				this.untaggedParents = tree.untaggedParents
			} catch (error) {
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

			const rebuild = () => {
				const tree = buildTree(this.areas.map((area) => ({
					name: area.name,
					calendar: { url: area.calendarUrl },
				})), Object.values(this.tasksByUid))
				this.areas = tree.areas
				this.orphans = tree.orphans
				this.untaggedParents = tree.untaggedParents
			}

			raw.categories = [...raw.categories, 'project']
			rebuild()

			try {
				const stored = await putTodo(raw.url, raw.toIcs(), raw.etag)
				toRaw(task).where = { ...toRaw(task).where, etag: stored.etag }
			} catch (error) {
				if (error instanceof ConflictError) {
					const stored = await fetchTodo(raw.url)
					const reloaded = Task.fromIcs(stored.ics, {
						url: stored.url,
						etag: stored.etag,
						calendarUrl: stored.calendarUrl,
					})
					this.tasksByUid[reloaded.uid] = reloaded
					rebuild()
					showInfo('Someone else changed this; reloaded')
					return
				}

				this.tasksByUid[uid] = Task.fromIcs(before.ics, before.where)
				rebuild()
				showError('Could not make the project')
			}
		},
	},
})
