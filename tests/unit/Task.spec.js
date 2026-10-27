import ICAL from 'ical.js'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Task } from '../../src/models/Task.js'

const where = {
	url: '/remote.php/dav/calendars/fixture/tasks/task-rich.ics',
	etag: '"fixture-etag"',
	calendarUrl: '/remote.php/dav/calendars/fixture/tasks/',
}

async function fixture(name) {
	return readFile(resolve('tests', 'fixtures', name), 'utf8')
}

function taskProperties(task) {
	return task.vtodo.getAllProperties().map((property) => property.toICALString())
}

function withoutOwned(properties, owned) {
	return properties.filter((line) => !owned.some((name) => line.toUpperCase().startsWith(`${name}:`) || line.toUpperCase().startsWith(`${name};`))).sort()
}

function expectUtcStamp(value) {
	expect(value).toMatch(/^\d{8}T\d{6}Z$/)
}

describe('Task', () => {
	it('reads every field used by the app', async () => {
		const task = Task.fromIcs(await fixture('task-rich.ics'), where)
		expect(task.uid).toBe('task-rich-001')
		expect(task.summary).toBe('Made-up fixture task')
		expect(task.status).toBe('NEEDS-ACTION')
		expect(task.completed).toBe(false)
		expect(task.closed).toBe(false)
		expect(task.due.toString()).toBe('2030-03-04')
		expect(task.priority).toBe(5)
		expect(task.categories).toEqual(['project', 'blocked'])
		expect(task.isProject).toBe(true)
		expect(task.parentUid).toBe('parent-bare-001')
		expect(task.sortOrder).toBe(42)
		expect(task.created.toString()).toBe('2030-01-02T03:04:05Z')
		expect(task.url).toBe(where.url)
		expect(task.etag).toBe(where.etag)
		expect(task.calendarUrl).toBe(where.calendarUrl)
	})
	it('round-trips untouched fixture text exactly', async () => {
		for (const name of ['task-rich.ics', 'task-parent-reltype.ics', 'task-completed.ics']) {
			const ics = await fixture(name)
			expect(Task.fromIcs(ics, where).toIcs()).toBe(ics)
		}
	})
	it('reads RELTYPE=PARENT without losing its other parameter', async () => {
		const task = Task.fromIcs(await fixture('task-parent-reltype.ics'), where)
		expect(task.parentUid).toBe('parent-001')
	})
	it('recognises completed and cancelled tasks as closed', async () => {
		const completed = Task.fromIcs(await fixture('task-completed.ics'), where)
		expect(completed.completed).toBe(true)
		expect(completed.closed).toBe(true)
		const cancelled = Task.fromIcs((await fixture('task-rich.ics')).replace('STATUS:NEEDS-ACTION', 'STATUS:CANCELLED'), where)
		expect(cancelled.completed).toBe(false)
		expect(cancelled.closed).toBe(true)
	})
	it.each([
		['summary', (task) => {
			task.summary = 'Renamed'
			expect(task.summary).toBe('Renamed')
		}, ['SUMMARY']],
		['completed', (task) => {
			task.completed = true
			expect(task.status).toBe('COMPLETED')
			expect(task.vtodo.getFirstPropertyValue('percent-complete')).toBe(100)
			expectUtcStamp(task.vtodo.getFirstPropertyValue('completed').toICALString())
		}, ['STATUS', 'COMPLETED', 'PERCENT-COMPLETE']],
		['due', (task) => {
			task.due = new Date('2031-04-05T06:07:08Z')
			expect(task.vtodo.getFirstPropertyValue('due').toICALString()).toBe('20310405T060708Z')
		}, ['DUE']],
		['priority', (task) => {
			task.priority = 0
			expect(task.vtodo.hasProperty('priority')).toBe(false)
		}, ['PRIORITY']],
		['categories', (task) => {
			task.categories = ['project', 'blocked']
			expect(task.categories).toEqual(['project', 'blocked'])
		}, ['CATEGORIES']],
		['parentUid', (task) => {
			task.parentUid = 'abc'
			expect(task.parentUid).toBe('abc')
			expect(task.vtodo.getAllProperties('related-to').map((p) => p.toICALString()).sort()).toEqual(['RELATED-TO:abc', 'RELATED-TO;RELTYPE=CHILD:child-001'].sort())
		}, ['RELATED-TO']],
		['sortOrder', (task) => {
			task.sortOrder = 12
			expect(task.sortOrder).toBe(12)
		}, ['X-APPLE-SORT-ORDER']],
	])('setter %s preserves all unrelated properties and stamps modification time', async (_name, edit, owned) => {
		const task = Task.fromIcs(await fixture('task-rich.ics'), where)
		const before = taskProperties(task)
		edit(task)
		expect(withoutOwned(taskProperties(task), [...owned, 'LAST-MODIFIED', 'DTSTAMP'])).toEqual(withoutOwned(before, owned))
		expectUtcStamp(task.vtodo.getFirstPropertyValue('last-modified').toICALString())
		expectUtcStamp(task.vtodo.getFirstPropertyValue('dtstamp').toICALString())
		expect(task.vtodo.hasProperty('sequence')).toBe(false)
	})
	it('writes priority 1-9, removes due and sort order on null, and preserves CHILD/SIBLING relations', async () => {
		const task = Task.fromIcs(await fixture('task-parent-reltype.ics'), where)
		task.priority = 9
		expect(task.priority).toBe(9)
		task.due = null
		task.sortOrder = null
		task.parentUid = null
		expect(task.vtodo.hasProperty('due')).toBe(false)
		expect(task.vtodo.hasProperty('x-apple-sort-order')).toBe(false)
		expect(task.vtodo.getAllProperties('related-to').map((p) => p.toICALString())).toEqual(['RELATED-TO;RELTYPE=SIBLING:peer-001'])
	})
	it('reopens a completed task by removing completion fields', async () => {
		const task = Task.fromIcs(await fixture('task-completed.ics'), where)
		task.completed = false
		expect(task.status).toBe('NEEDS-ACTION')
		expect(task.vtodo.hasProperty('completed')).toBe(false)
		expect(task.vtodo.hasProperty('percent-complete')).toBe(false)
	})
	it('creates an open VTODO with requested fields and no sort order', () => {
		const task = Task.create({ summary: 'New project', calendarUrl: where.calendarUrl, parentUid: 'parent-1', categories: ['project'] })
		const component = ICAL.Component.fromString(task.toIcs())
		const vtodo = component.getFirstSubcomponent('vtodo')
		expect(component.getFirstPropertyValue('prodid')).toBe('-//cc_projects//Projects//EN')
		expect(task.uid).toMatch(/^[0-9a-f-]{36}$/i)
		expect(task.summary).toBe('New project')
		expect(task.status).toBe('NEEDS-ACTION')
		expect(task.parentUid).toBe('parent-1')
		expect(task.categories).toEqual(['project'])
		expect(task.calendarUrl).toBe(where.calendarUrl)
		expect(task.url).toBe('')
		expect(task.etag).toBe('')
		for (const name of ['created', 'dtstamp', 'last-modified']) {
			expectUtcStamp(vtodo.getFirstPropertyValue(name).toICALString())
		}
		expect(vtodo.hasProperty('x-apple-sort-order')).toBe(false)
	})

	it('imports no node: module in the browser model', async () => {
		const source = await readFile(resolve(import.meta.dirname, '../../src/models/Task.js'), 'utf8')
		expect(source).not.toMatch(/(?:from|import)\s*\(?\s*['"]node:/)
	})
})
