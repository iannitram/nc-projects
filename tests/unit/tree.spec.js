import { describe, expect, it } from 'vitest'
import { Task } from '../../src/models/Task.js'
import { buildTree } from '../../src/models/tree.js'

describe('tree', () => {
	const areas = [
		{ name: 'Home', calendar: { url: '/remote.php/dav/calendars/owner/list-a/' } },
		{ name: 'Work', calendar: { url: '/remote.php/dav/calendars/owner/the-channel/' } },
		{ name: 'Garden', calendar: { url: '/remote.php/dav/calendars/owner/list-b/' } },
	]

	describe('areas and projects', () => {
		it('returns AreaNodes matching input areas in exact order with empty arrays when no tasks exist', () => {
			const result = buildTree(areas, [])
			expect(result.areas).toHaveLength(3)
			expect(result.areas[0]).toEqual({
				name: 'Home',
				calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				projects: [],
				done: [],
			})
			expect(result.areas[1].name).toBe('Work')
			expect(result.areas[2].name).toBe('Garden')
			expect(result.orphans).toEqual([])
			expect(result.untaggedParents).toEqual([])
		})

		it('places tasks with category project into matching area by calendarUrl', () => {
			const tasks = [
				{
					uid: 'proj-1',
					categories: ['project'],
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
					sortOrder: 10,
				},
				{
					uid: 'proj-2',
					categories: ['project'],
					calendarUrl: '/remote.php/dav/calendars/owner/list-b/',
					sortOrder: 20,
				},
			]

			const result = buildTree(areas, tasks)
			expect(result.areas[0].projects).toHaveLength(1)
			expect(result.areas[0].projects[0].task.uid).toBe('proj-1')
			expect(result.areas[1].projects).toHaveLength(0)
			expect(result.areas[2].projects).toHaveLength(1)
			expect(result.areas[2].projects[0].task.uid).toBe('proj-2')
		})

		it('does not create project cards for tasks without category project', () => {
			const tasks = [
				{
					uid: 'untagged-parent',
					categories: ['work'],
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				{
					uid: 'untagged-child',
					parentUid: 'untagged-parent',
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
			]

			const result = buildTree(areas, tasks)
			expect(result.areas[0].projects).toHaveLength(0)
			expect(result.areas[0].done).toHaveLength(0)
		})

		it('ignores projects on calendars not in areas', () => {
			const tasks = [
				{
					uid: 'ignored-proj',
					categories: ['project'],
					calendarUrl: '/remote.php/dav/calendars/owner/app-generated--deck--board/',
				},
			]

			const result = buildTree(areas, tasks)
			for (const area of result.areas) {
				expect(area.projects).toHaveLength(0)
				expect(area.done).toHaveLength(0)
			}
		})
	})

	describe('filing tray', () => {
		it('returns sorted open orphans for missing or closed parents without duplicates', () => {
			const tasks = [
				{ uid: 'missing-late', parentUid: 'gone', sortOrder: 20 },
				{ uid: 'done-parent', completed: true },
				{ uid: 'cancelled-parent', status: 'CANCELLED' },
				{ uid: 'done-orphan', parentUid: 'done-parent', sortOrder: 10 },
				{ uid: 'cancelled-orphan', parentUid: 'cancelled-parent', sortOrder: 30 },
				{ uid: 'missing-first', parentUid: 'also-gone', sortOrder: 5 },
				{ uid: 'closed-child', parentUid: 'gone', completed: true, sortOrder: 1 },
				{ uid: 'project-orphan', parentUid: 'gone', categories: ['project'] },
			]

			const result = buildTree(areas, [...tasks, tasks[0]])
			expect(result.orphans.map((task) => task.uid)).toEqual([
				'missing-first',
				'done-orphan',
				'missing-late',
				'cancelled-orphan',
			])
			expect(result.untaggedParents).toEqual([])
		})

		it('returns open untagged root parents with children, with orphan precedence and sorted order', () => {
			const tasks = [
				{ uid: 'valid-project', categories: ['project'], calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'project-child', parentUid: 'valid-project' },
				{ uid: 'untagged-late', sortOrder: 20 },
				{ uid: 'untagged-child-1', parentUid: 'untagged-late' },
				{ uid: 'untagged-first', sortOrder: 10 },
				{ uid: 'untagged-child-2', parentUid: 'untagged-first' },
				{ uid: 'orphan-parent', parentUid: 'missing', sortOrder: 5 },
				{ uid: 'orphan-parent-child', parentUid: 'orphan-parent' },
				{ uid: 'nested-parent', parentUid: 'valid-project', categories: ['work'] },
			]

			const result = buildTree(areas, tasks)
			expect(result.untaggedParents.map((task) => task.uid)).toEqual(['untagged-first', 'untagged-late'])
			expect(result.orphans.map((task) => task.uid)).toEqual(['orphan-parent'])
			expect(result.areas.flatMap((area) => area.projects).map((project) => project.children.map((node) => node.task.uid))).toEqual([['project-child', 'nested-parent']])
		})

		it('lists only the root of an untagged chain as an untagged parent', () => {
			const tasks = [
				{ uid: 'U1' },
				{ uid: 'U2', parentUid: 'U1' },
				{ uid: 'U3', parentUid: 'U2' },
			]
			const result = buildTree(areas, tasks)
			expect(result.untaggedParents.map((task) => task.uid)).toEqual(['U1'])
		})

		it('does not put valid project descendants in either tray list', () => {
			const tasks = [
				{ uid: 'project', categories: ['project'] },
				{ uid: 'child', parentUid: 'project' },
				{ uid: 'grandchild', parentUid: 'child' },
			]
			const result = buildTree(areas, tasks)
			expect(result.orphans).toEqual([])
			expect(result.untaggedParents).toEqual([])
		})
	})

	describe('cross-list children', () => {
		it('places a child on another area list under its parent project (ADR 0007)', () => {
			const tasks = [
				{
					uid: 'proj-cross',
					categories: ['project'],
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
					sortOrder: 1,
				},
				{
					uid: 'child-on-list-b',
					parentUid: 'proj-cross',
					calendarUrl: '/remote.php/dav/calendars/owner/list-b/',
					sortOrder: 10,
				},
			]

			const result = buildTree(areas, tasks)
			const homeArea = result.areas.find((a) => a.name === 'Home')
			const gardenArea = result.areas.find((a) => a.name === 'Garden')

			expect(homeArea.projects).toHaveLength(1)
			expect(homeArea.projects[0].children).toHaveLength(1)
			expect(homeArea.projects[0].children[0].task.uid).toBe('child-on-list-b')
			expect(gardenArea.projects).toHaveLength(0)
		})

		it('follows multi-level descendants across multiple different lists', () => {
			const tasks = [
				{
					uid: 'proj-1',
					categories: ['project'],
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				{
					uid: 't1',
					parentUid: 'proj-1',
					calendarUrl: '/remote.php/dav/calendars/owner/the-channel/',
				},
				{
					uid: 't2',
					parentUid: 't1',
					calendarUrl: '/remote.php/dav/calendars/owner/list-b/',
				},
			]

			const result = buildTree(areas, tasks)
			const homeArea = result.areas[0]
			const level1 = homeArea.projects[0].children[0]
			expect(level1.task.uid).toBe('t1')
			expect(level1.children[0].task.uid).toBe('t2')
		})
	})

	describe('depth and deeper count', () => {
		it('populates up to 3 levels and sets deeper count to 0 when no deeper tasks exist', () => {
			const tasks = [
				{ uid: 'proj', categories: ['project'], calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'l1', parentUid: 'proj', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'l2', parentUid: 'l1', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'l3', parentUid: 'l2', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
			]

			const result = buildTree(areas, tasks)
			const p = result.areas[0].projects[0]
			expect(p.children).toHaveLength(1)

			const l1Node = p.children[0]
			expect(l1Node.task.uid).toBe('l1')
			expect(l1Node.deeper).toBe(0)
			expect(l1Node.children).toHaveLength(1)

			const l2Node = l1Node.children[0]
			expect(l2Node.task.uid).toBe('l2')
			expect(l2Node.deeper).toBe(0)
			expect(l2Node.children).toHaveLength(1)

			const l3Node = l2Node.children[0]
			expect(l3Node.task.uid).toBe('l3')
			expect(l3Node.children).toHaveLength(0)
			expect(l3Node.deeper).toBe(0)
		})

		it('shows +1 deeper on level 3 for a four-level chain (M4 fixture)', () => {
			const tasks = [
				{ uid: 'chain-proj', categories: ['project'], calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'chain-l1', parentUid: 'chain-proj', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'chain-l2', parentUid: 'chain-l1', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'chain-l3', parentUid: 'chain-l2', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'chain-l4', parentUid: 'chain-l3', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
			]

			const result = buildTree(areas, tasks)
			const l3Node = result.areas[0].projects[0].children[0].children[0].children[0]
			expect(l3Node.task.uid).toBe('chain-l3')
			expect(l3Node.children).toEqual([])
			expect(l3Node.deeper).toBe(1)
		})

		it('counts all descendants below level 3 in deeper count', () => {
			const tasks = [
				{ uid: 'proj', categories: ['project'], calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'l1', parentUid: 'proj', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'l2', parentUid: 'l1', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'l3', parentUid: 'l2', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'l4-a', parentUid: 'l3', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'l4-b', parentUid: 'l3', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'l5-a', parentUid: 'l4-a', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
			]

			const result = buildTree(areas, tasks)
			const l3Node = result.areas[0].projects[0].children[0].children[0].children[0]
			expect(l3Node.children).toEqual([])
			expect(l3Node.deeper).toBe(3)
		})

		it('honours custom maxDepth option', () => {
			const tasks = [
				{ uid: 'proj', categories: ['project'], calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'l1', parentUid: 'proj', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'l2', parentUid: 'l1', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'l3', parentUid: 'l2', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
			]

			const result = buildTree(areas, tasks, { maxDepth: 1 })
			const l1Node = result.areas[0].projects[0].children[0]
			expect(l1Node.children).toEqual([])
			expect(l1Node.deeper).toBe(2)
		})

		it('avoids infinite loops when parent relationships form a cycle', () => {
			const tasks = [
				{ uid: 'proj', categories: ['project'], calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'c1', parentUid: 'proj', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'c2', parentUid: 'c1', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 'c1-loop', parentUid: 'c2', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
			]
			// Link c2 back to proj
			tasks.push({ uid: 'proj', parentUid: 'c2', calendarUrl: '/remote.php/dav/calendars/owner/list-a/' })

			expect(() => buildTree(areas, tasks)).not.toThrow()
		})
	})

	describe('progress calculation', () => {
		it('returns done: 0 and total: 0 when project has no descendants', () => {
			const tasks = [
				{ uid: 'proj', categories: ['project'], calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
			]
			const result = buildTree(areas, tasks)
			expect(result.areas[0].projects[0].progress).toEqual({ done: 0, total: 0 })
		})

		it('counts done and total over every descendant across lists and levels', () => {
			const tasks = [
				{ uid: 'proj', categories: ['project'], calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 't1', parentUid: 'proj', completed: true, calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 't2', parentUid: 'proj', completed: false, calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 't3', parentUid: 't2', completed: true, calendarUrl: '/remote.php/dav/calendars/owner/list-b/' },
				{ uid: 't4', parentUid: 't3', completed: false, calendarUrl: '/remote.php/dav/calendars/owner/the-channel/' },
			]

			const result = buildTree(areas, tasks)
			expect(result.areas[0].projects[0].progress).toEqual({ done: 2, total: 4 })
		})

		it('leaves cancelled tasks out of both done and total (M5 fixture: 4 done of 10 plus 1 cancelled = 4/10)', () => {
			const tasks = [
				{ uid: 'prog-proj', categories: ['project'], calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
			]

			// 5 top level tasks: 2 done, 3 open
			for (let i = 1; i <= 5; i++) {
				tasks.push({
					uid: `top-${i}`,
					parentUid: 'prog-proj',
					completed: i <= 2,
					status: i <= 2 ? 'COMPLETED' : 'NEEDS-ACTION',
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				})
			}

			// 5 sub level tasks: 2 done, 3 open
			for (let i = 1; i <= 5; i++) {
				tasks.push({
					uid: `sub-${i}`,
					parentUid: `top-${(i % 2) + 3}`,
					completed: i <= 2,
					status: i <= 2 ? 'COMPLETED' : 'NEEDS-ACTION',
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				})
			}

			// 1 cancelled task
			tasks.push({
				uid: 'prog-cancelled',
				parentUid: 'prog-proj',
				status: 'CANCELLED',
				completed: false,
				calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
			})

			const result = buildTree(areas, tasks)
			expect(result.areas[0].projects[0].progress).toEqual({ done: 4, total: 10 })
		})

		it('does not include the project task itself in its progress', () => {
			const tasks = [
				{
					uid: 'proj',
					categories: ['project'],
					completed: true,
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				{
					uid: 'child',
					parentUid: 'proj',
					completed: false,
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
			]

			const result = buildTree(areas, tasks)
			// proj is completed, so it goes to done
			expect(result.areas[0].done[0].progress).toEqual({ done: 0, total: 1 })
		})
	})

	describe('sorting and order', () => {
		it('sorts sibling tasks by effectiveSortOrder ascending', () => {
			const tasks = [
				{ uid: 'proj', categories: ['project'], calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 't3', parentUid: 'proj', sortOrder: 30, calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 't1', parentUid: 'proj', sortOrder: 10, calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{ uid: 't2', parentUid: 'proj', sortOrder: 20, calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
			]

			const result = buildTree(areas, tasks)
			const childUids = result.areas[0].projects[0].children.map((n) => n.task.uid)
			expect(childUids).toEqual(['t1', 't2', 't3'])
		})

		it('uses created timestamp when sortOrder is null', () => {
			const tasks = [
				{ uid: 'proj', categories: ['project'], calendarUrl: '/remote.php/dav/calendars/owner/list-a/' },
				{
					uid: 'newer',
					parentUid: 'proj',
					sortOrder: null,
					created: new Date('2001-01-01T00:02:00Z'),
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				{
					uid: 'older',
					parentUid: 'proj',
					sortOrder: null,
					created: new Date('2001-01-01T00:01:00Z'),
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
			]

			const result = buildTree(areas, tasks)
			const childUids = result.areas[0].projects[0].children.map((n) => n.task.uid)
			expect(childUids).toEqual(['older', 'newer'])
		})

		it('places someday projects last among open projects in an area', () => {
			const tasks = [
				{
					uid: 'proj-someday-1',
					categories: ['project', 'someday'],
					sortOrder: 10,
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				{
					uid: 'proj-open-2',
					categories: ['project'],
					sortOrder: 50,
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				{
					uid: 'proj-open-1',
					categories: ['project'],
					sortOrder: 20,
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				{
					uid: 'proj-someday-2',
					categories: ['project', 'someday'],
					sortOrder: 5,
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
			]

			const result = buildTree(areas, tasks)
			const projectUids = result.areas[0].projects.map((p) => p.task.uid)
			// Non-someday projects first sorted by order (20 then 50), then someday projects sorted by order (5 then 10)
			expect(projectUids).toEqual(['proj-open-1', 'proj-open-2', 'proj-someday-2', 'proj-someday-1'])
		})
	})

	describe('completed projects', () => {
		it('moves completed projects into area done array', () => {
			const tasks = [
				{
					uid: 'open-proj',
					categories: ['project'],
					completed: false,
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
					sortOrder: 10,
				},
				{
					uid: 'completed-proj',
					categories: ['project'],
					completed: true,
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
					sortOrder: 5,
				},
			]

			const result = buildTree(areas, tasks)
			expect(result.areas[0].projects).toHaveLength(1)
			expect(result.areas[0].projects[0].task.uid).toBe('open-proj')
			expect(result.areas[0].done).toHaveLength(1)
			expect(result.areas[0].done[0].task.uid).toBe('completed-proj')
		})

		it('keeps a project in projects when all its tasks are done but project itself is open (M8)', () => {
			const tasks = [
				{
					uid: 'full-proj',
					categories: ['project'],
					completed: false,
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				{
					uid: 't1',
					parentUid: 'full-proj',
					completed: true,
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				{
					uid: 't2',
					parentUid: 'full-proj',
					completed: true,
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
			]

			const result = buildTree(areas, tasks)
			expect(result.areas[0].projects).toHaveLength(1)
			expect(result.areas[0].projects[0].task.uid).toBe('full-proj')
			expect(result.areas[0].projects[0].progress).toEqual({ done: 2, total: 2 })
			expect(result.areas[0].done).toHaveLength(0)
		})
	})

	describe('Task model integration', () => {
		it('works with real Task.fromIcs instances', () => {
			const icsProj = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Fixture//EN
BEGIN:VTODO
UID:real-proj-001
SUMMARY:Real project
CATEGORIES:project
X-APPLE-SORT-ORDER:15
END:VTODO
END:VCALENDAR`

			const icsChild = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Fixture//EN
BEGIN:VTODO
UID:real-child-001
SUMMARY:Real child
RELATED-TO:real-proj-001
X-APPLE-SORT-ORDER:5
END:VTODO
END:VCALENDAR`

			const taskProj = Task.fromIcs(icsProj, {
				url: '/task/proj.ics',
				etag: '"1"',
				calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
			})
			const taskChild = Task.fromIcs(icsChild, {
				url: '/task/child.ics',
				etag: '"2"',
				calendarUrl: '/remote.php/dav/calendars/owner/list-b/',
			})

			const result = buildTree(areas, [taskProj, taskChild])
			const p = result.areas[0].projects[0]
			expect(p.task.uid).toBe('real-proj-001')
			expect(p.children).toHaveLength(1)
			expect(p.children[0].task.uid).toBe('real-child-001')
			expect(p.progress).toEqual({ done: 0, total: 1 })
		})
	})
})
