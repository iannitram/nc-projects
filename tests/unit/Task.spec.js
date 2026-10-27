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
	it('keeps agent properties, unknown parameters, and unrelated links when editing', async () => {
		const task = Task.fromIcs(await fixture('task-rich.ics'), where)
		task.summary = 'Edited fixture task'
		const ics = task.toIcs()
		expect(ics).toContain('SUMMARY:Edited fixture task')
		expect(ics).toContain('RELATED-TO:parent-bare-001')
		expect(ics).toContain('RELATED-TO;RELTYPE=CHILD:child-001')
		expect(ics).toContain('X-CC-STATE;X-CC-MODE=fixture:queued')
		expect(ics).toContain('X-FORK-META;X-UNKNOWN="alpha,beta";X-LIST="one,two":made-up')
	})
	it('reads RELTYPE=PARENT and writes a bare parent link without losing its other parameter', async () => {
		const task = Task.fromIcs(await fixture('task-parent-reltype.ics'), where)
		expect(task.parentUid).toBe('parent-001')
		task.parentUid = 'replacement-parent-001'
		const ics = task.toIcs()
		expect(ics).toContain('RELATED-TO;X-REL-CUE=fixture:replacement-parent-001')
		expect(ics).toContain('RELATED-TO;RELTYPE=SIBLING:peer-001')
		expect(ics).toContain('X-CC-ASSIGNMENT;X-TRACE=kept:example')
	})
	it('recognises completed and cancelled tasks as closed', async () => {
		const completed = Task.fromIcs(await fixture('task-completed.ics'), where)
		expect(completed.completed).toBe(true)
		expect(completed.closed).toBe(true)
		const cancelled = Task.fromIcs((await fixture('task-rich.ics')).replace('STATUS:NEEDS-ACTION', 'STATUS:CANCELLED'), where)
		expect(cancelled.completed).toBe(false)
		expect(cancelled.closed).toBe(true)
	})
})
