/**
 * The panel's state (P05, P10 and every write feature). Pinia.
 * Writes are optimistic with rollback; a ConflictError reloads the task (rule 3).
 * Stub: state and action names only.
 */
import { showError, showInfo } from '@nextcloud/dialogs'
import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { placeMoved } from '../models/sortOrder.js'
import { Task } from '../models/Task.js'
import { buildTree } from '../models/tree.js'
import { notImplemented } from '../notImplemented.js'
import { pickAreas } from '../services/areas.js'
import { ConflictError, createTodo, fetchTodo, fetchTodos, listTaskCalendars, putTodo } from '../services/dav.js'

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
		loading: false,
		/** @type {string|null} */
		error: null,
	}),
	actions: {
		/** Read every area list and build the tree (P05). */
		async load() {
			this.loading = true
			this.error = null
			try {
				const calendars = await listTaskCalendars()
				const areas = pickAreas(calendars)
				const todosByArea = await Promise.all(areas.map((area) => fetchTodos(area.calendar)))
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
				const calendars = await listTaskCalendars()
				const areas = pickAreas(calendars)
				const changedAreas = areas.filter((area) => this.ctags[area.calendar.url] !== area.calendar.ctag)
				if (changedAreas.length === 0) {
					return
				}

				const todosByArea = await Promise.all(changedAreas.map((area) => fetchTodos(area.calendar)))
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
				const created = await createTodo(this.calendarOf(project), task.toIcs())
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

			// Find the parent node in the tree
			let parentNode = null
			for (const area of this.areas) {
				for (const project of area.projects) {
					if (project.task.uid === parentUid) {
						parentNode = project
						break
					}
					// Check if parentUid matches a task in children
					if (project.children) {
						const found = project.children.find((child) => child.task.uid === parentUid)
						if (found) {
							parentNode = found
							break
						}
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

			// Keep a copy of original values for rollback
			const originalValues = {}
			for (const { uid } of toUpdate) {
				const task = this.tasksByUid[uid]
				if (task) {
					originalValues[uid] = {
						sortOrder: task.sortOrder,
						etag: task.etag,
					}
				}
			}

			try {
				// Apply the new sort orders to the tasks
				for (const { uid, sortOrder } of toUpdate) {
					const task = this.tasksByUid[uid]
					if (task) {
						toRaw(task).sortOrder = sortOrder
					}
				}

				// Write each task to the server
				const etags = {}
				for (const { uid } of toUpdate) {
					const task = this.tasksByUid[uid]
					if (task) {
						const etag = await putTodo(task.url, task.toIcs(), task.etag)
						etags[uid] = etag.etag
					}
				}

				// Update etags in tasks
				for (const [uid, etag] of Object.entries(etags)) {
					const task = this.tasksByUid[uid]
					if (task) {
						toRaw(task).where = { ...task.where, etag }
					}
				}

				// Rebuild the tree after successful write
				const allTasks = Object.values(this.tasksByUid)
				const tree = buildTree(this.areas.map((area) => ({
					name: area.name,
					calendar: { url: area.calendarUrl },
				})), allTasks)
				this.areas = tree.areas
				this.orphans = tree.orphans
				this.untaggedParents = tree.untaggedParents
			} catch (error) {
				// Restore original values on any error (including ConflictError)
				for (const [uid, original] of Object.entries(originalValues)) {
					const task = this.tasksByUid[uid]
					if (task) {
						toRaw(task).sortOrder = original.sortOrder
					}
				}

				// Rebuild the tree after rollback
				const allTasks = Object.values(this.tasksByUid)
				const tree = buildTree(this.areas.map((area) => ({
					name: area.name,
					calendar: { url: area.calendarUrl },
				})), allTasks)
				this.areas = tree.areas
				this.orphans = tree.orphans
				this.untaggedParents = tree.untaggedParents

				// Handle ConflictError differently
				if (error instanceof ConflictError) {
					// Handle ConflictError - reload the tasks
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

						// Rebuild the tree after reload
						const allTasks = Object.values(this.tasksByUid)
						const tree = buildTree(this.areas.map((area) => ({
							name: area.name,
							calendar: { url: area.calendarUrl },
						})), allTasks)
						this.areas = tree.areas
						this.orphans = tree.orphans
						this.untaggedParents = tree.untaggedParents

						showInfo('Someone else changed this; reloaded')
					} catch {
						// If reload fails, show error
						showError('Could not save the new order')
					}
				} else {
					// Show error for all other errors
					showError('Could not save the new order')
				}
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
			return notImplemented('setCompleted', uid, done)
		},
		/**
		 * @param {string} uid the task
		 * @param {{summary?: string, due?: (Date|null), priority?: number}} changes quick edits
		 */
		async updateTask(uid, changes) {
			return notImplemented('updateTask', uid, changes)
		},
		/**
		 * @param {string} areaName the area
		 * @param {string} summary the project's title
		 */
		async createProject(areaName, summary) {
			try {
				const area = this.areas.find((item) => item.name === areaName)
				if (!area) {
					throw new Error(`Area not found: ${areaName}`)
				}
				const calendar = await listTaskCalendars()
				const areaCalendar = calendar.find((item) => item.url === area.calendarUrl || item.displayName === areaName)
				if (!areaCalendar) {
					throw new Error(`Calendar not found for area: ${areaName}`)
				}
				const task = Task.create({ summary, calendarUrl: areaCalendar.url, categories: ['project'] })
				const stored = await createTodo(areaCalendar, task.toIcs())
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
			return notImplemented('makeProject', uid)
		},
	},
})
