import { showError } from '@nextcloud/dialogs'
/**
 * The panel's state (P05, P10 and every write feature). Pinia.
 * Writes are optimistic with rollback; a ConflictError reloads the task (rule 3).
 * Stub: state and action names only.
 */
import { defineStore } from 'pinia'
import { Task } from '../models/Task.js'
import { buildTree } from '../models/tree.js'
import { pickAreas } from '../services/areas.js'
import { createTodo, fetchTodos, listTaskCalendars } from '../services/dav.js'

/**
 * @param {string} methodName The name of the method that is not implemented
 * @param {...any} args Arguments passed to the method
 */
function notImplemented(methodName, ...args) {
	throw new Error(`Not implemented: ${methodName}(${args.map((a) => JSON.stringify(a)).join(', ')})`)
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
				this.error = error instanceof Error ? error.message : String(error)
			} finally {
				this.loading = false
			}
		},
		/** Re-read only lists whose ctag changed (P10). */
		async refresh() {
			return notImplemented('refresh')
		},
		/**
		 * @param {string} projectUid the project
		 * @param {string} summary the new task's title
		 * @return {Promise<string>} The uid of the created task
		 */
		async addTask(projectUid, summary) {
			const project = this.tasksByUid[projectUid]
			if (!project) {
				return
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
			return notImplemented('createProject', areaName, summary)
		},
		/**
		 * @param {string} uid a parent task with children but no `project` tag
		 */
		async makeProject(uid) {
			return notImplemented('makeProject', uid)
		},
	},
})
