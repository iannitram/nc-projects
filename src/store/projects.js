/**
 * The panel's state (P05, P10 and every write feature). Pinia.
 * Writes are optimistic with rollback; a ConflictError reloads the task (rule 3).
 * Stub: state and action names only.
 */
import { defineStore } from 'pinia'
import { notImplemented } from '../notImplemented.js'

export const useProjectsStore = defineStore('projects', {
	state: () => ({
		/** @type {import('../models/tree.js').AreaNode[]} */
		areas: [],
		/** @type {import('../models/Task.js').Task[]} */
		orphans: [],
		/** @type {import('../models/Task.js').Task[]} */
		untaggedParents: [],
		loading: false,
		/** @type {string|null} */
		error: null,
	}),
	actions: {
		/** Read every area list and build the tree (P05). */
		async load() {
			return notImplemented('load')
		},
		/** Re-read only lists whose ctag changed (P10). */
		async refresh() {
			return notImplemented('refresh')
		},
		/**
		 * @param {string} projectUid the project
		 * @param {string} summary the new task's title
		 */
		async addTask(projectUid, summary) {
			return notImplemented('addTask', projectUid, summary)
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
