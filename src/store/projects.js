/**
 * The panel's state (P05, P10 and every write feature). Pinia.
 * Writes are optimistic with rollback; a ConflictError reloads the task (rule 3).
 * Stub: state and action names only.
 */
import { showError, showInfo } from '@nextcloud/dialogs'
import { defineStore } from 'pinia'
import { markRaw, toRaw } from 'vue'
import { Task } from '../models/Task.js'
import { buildTree } from '../models/tree.js'
import { notImplemented } from '../notImplemented.js'
import { pickAreas } from '../services/areas.js'
import { ConflictError, createTodo, fetchTodo, fetchTodos, getDavSession, listTaskCalendars } from '../services/dav.js'

let pendingConflictReloads = 0
let noticeScheduled = false

/**
 * Queue a task reload caused by a ConflictError and show one quiet notice.
 *
 * @param {() => Promise<void>} reloadFn the reload callback
 * @return {Promise<void>}
 */
function queueConflictReload(reloadFn) {
	pendingConflictReloads++
	return reloadFn().finally(() => {
		pendingConflictReloads--
		if (pendingConflictReloads === 0 && !noticeScheduled) {
			noticeScheduled = true
			Promise.resolve().then(() => {
				noticeScheduled = false
				if (pendingConflictReloads === 0) {
					showInfo('Reloaded')
				}
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
	 *
	 * @param nodes
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
	 *
	 * @param nodes
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

export const useProjectsStore = defineStore('projects', {
	state: () => ({
		/** @type {import('../models/tree.js').AreaNode[]} */
		areas: [],
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
				const calendars = await listTaskCalendars(this.davSession)
				const areas = pickAreas(calendars)
				this.areaInputs = areas
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

				const collapseState = collectCollapseState(this.areas)
				const tree = buildTree(areas, Object.values(tasksByUid).map((task) => toRaw(task)))
				restoreCollapseState(tree.areas, collapseState)
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
		 * Reload a single task by URL and rebuild the tree.
		 *
		 * @param {string} url the task's URL
		 */
		async reloadTask(url) {
			if (!url) {
				return
			}
			this.davSession ??= markRaw(getDavSession())
			try {
				const stored = await fetchTodo(url, this.davSession)
				if (stored?.ics) {
					const task = Task.fromIcs(stored.ics, {
						url: stored.url,
						etag: stored.etag,
						calendarUrl: stored.calendarUrl,
					})
					this.tasksByUid[task.uid] = task

					const collapseState = collectCollapseState(this.areas)
					const areas = this.areaInputs.length > 0
						? this.areaInputs
						: this.areas.map((area) => ({
								name: area.name,
								calendar: area.calendar || { url: area.calendarUrl, displayName: area.name },
							}))
					const tree = buildTree(areas, Object.values(this.tasksByUid).map((t) => toRaw(t)))
					restoreCollapseState(tree.areas, collapseState)
					this.areas = tree.areas
					this.orphans = tree.orphans
					this.untaggedParents = tree.untaggedParents
				}
			} catch {
				// Keep current state when a task cannot be refreshed.
			}
		},
		/**
		 * Reload a task after a ConflictError (412) and show one quiet notice.
		 *
		 * @param {import('../services/dav.js').ConflictError|string|{url?: string}} error the error or task URL
		 */
		async handleConflict(error) {
			const url = typeof error === 'string' ? error : error?.url
			if (!url) {
				return
			}
			return queueConflictReload(() => this.reloadTask(url))
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
				const areas = this.areaInputs.length > 0
					? this.areaInputs
					: this.areas.map((area) => ({
							name: area.name,
							calendar: area.calendar || { url: area.calendarUrl, displayName: area.name },
						}))
				const collapseState = collectCollapseState(this.areas)
				const tree = buildTree(areas, allTasks)
				restoreCollapseState(tree.areas, collapseState)
				this.areas = tree.areas
				this.orphans = tree.orphans
				this.untaggedParents = tree.untaggedParents
				return task.uid
			} catch (error) {
				if (error instanceof ConflictError) {
					await this.handleConflict(error)
					return null
				}
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
			return notImplemented('reorder', parentUid, areaName, movedUid, newIndex)
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
				const areas = this.areaInputs.length > 0
					? this.areaInputs
					: this.areas.map((item) => ({ name: item.name, calendar: { url: item.calendarUrl } }))
				const collapseState = collectCollapseState(this.areas)
				const tree = buildTree(areas, Object.values(this.tasksByUid))
				restoreCollapseState(tree.areas, collapseState)
				this.areas = tree.areas
				this.orphans = tree.orphans
				this.untaggedParents = tree.untaggedParents
			} catch (error) {
				if (error instanceof ConflictError) {
					await this.handleConflict(error)
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
			return notImplemented('makeProject', uid)
		},
	},
})
