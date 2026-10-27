/**
 * Tasks to areas, projects and task trees (P04, P15). Pure.
 * Stub: signatures only.
 */
import { notImplemented } from '../notImplemented.js'

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
 * Build the panel's tree. Children follow RELATED-TO across lists (ADR 0007).
 *
 * @param {{name: string, calendar: import('../services/dav.js').TaskCalendar}[]} areas from pickAreas
 * @param {import('./Task.js').Task[]} tasks every task on every area list
 * @param {object} [options] options
 * @param {number} [options.maxDepth] levels shown under a project (default 3)
 * @return {{areas: AreaNode[], orphans: import('./Task.js').Task[], untaggedParents: import('./Task.js').Task[]}}
 */
export function buildTree(areas, tasks, options = {}) {
	return notImplemented('buildTree', areas, tasks, options)
}
