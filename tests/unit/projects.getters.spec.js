import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectsStore } from '../../src/store/projects.js'

describe('projects store getters', () => {
	let store

	beforeEach(() => {
		setActivePinia(createPinia())
		store = useProjectsStore()
	})

	describe('areaColor', () => {
		it('returns calendar colour when hex formatted', () => {
			store.areas = [
				{
					name: 'Home',
					calendarUrl: '/home/',
					calendar: { url: '/home/', color: '#e67e22' },
					projects: [],
					done: [],
				},
			]
			expect(store.areaColor('Home')).toBe('#e67e22')
		})

		it('prepends # to bare hex color codes', () => {
			store.areas = [
				{
					name: 'Work',
					calendarUrl: '/work/',
					calendar: { url: '/work/', color: '0082c9' },
					projects: [],
					done: [],
				},
			]
			expect(store.areaColor('Work')).toBe('#0082c9')
		})

		it('falls back to var(--color-primary-element) when list has no colour', () => {
			store.areas = [
				{
					name: 'Garden',
					calendarUrl: '/garden/',
					calendar: { url: '/garden/' },
					projects: [],
					done: [],
				},
			]
			expect(store.areaColor('Garden')).toBe('var(--color-primary-element)')
		})

		it('falls back to var(--color-primary-element) when area is not found', () => {
			expect(store.areaColor('Unknown Area')).toBe('var(--color-primary-element)')
		})

		it('accepts an area object as parameter', () => {
			const area = {
				name: 'Custom',
				calendar: { color: '#ff0000' },
			}
			expect(store.areaColor(area)).toBe('#ff0000')
		})
	})

	describe('openProjectCount', () => {
		it('counts open projects including someday and excludes done projects', () => {
			store.areas = [
				{
					name: 'Home',
					calendarUrl: '/home/',
					projects: [
						{ task: { uid: 'p1', summary: 'Active project 1', categories: ['project'] } },
						{ task: { uid: 'p2', summary: 'Active project 2', categories: ['project'] } },
						{ task: { uid: 'p-someday', summary: 'Someday project', categories: ['project', 'someday'] } },
					],
					done: [
						{ task: { uid: 'p-done1', summary: 'Done project 1', categories: ['project'], completed: true } },
						{ task: { uid: 'p-done2', summary: 'Done project 2', categories: ['project'], completed: true } },
					],
				},
			]

			// 2 active + 1 someday = 3 open projects (done projects excluded)
			expect(store.openProjectCount('Home')).toBe(3)
		})

		it('returns 0 when area has no projects or does not exist', () => {
			store.areas = [
				{
					name: 'Empty',
					calendarUrl: '/empty/',
					projects: [],
					done: [],
				},
			]
			expect(store.openProjectCount('Empty')).toBe(0)
			expect(store.openProjectCount('Nonexistent')).toBe(0)
		})

		it('accepts an area object as parameter', () => {
			const area = {
				name: 'AreaObj',
				projects: [
					{ task: { uid: 'p1' } },
				],
			}
			expect(store.openProjectCount(area)).toBe(1)
		})

		it('returns total count across all areas when called without arguments', () => {
			store.areas = [
				{
					name: 'Home',
					projects: [{ task: { uid: 'p1' } }, { task: { uid: 'p2' } }],
					done: [{ task: { uid: 'p-done' } }],
				},
				{
					name: 'Work',
					projects: [{ task: { uid: 'p3' } }],
					done: [],
				},
			]
			expect(store.openProjectCount()).toBe(3)
			expect(store.totalOpenProjects).toBe(3)
		})
	})

	describe('openTaskCount and totalOpenTasks', () => {
		it('counts open tasks from progress (total - done) across open projects', () => {
			store.areas = [
				{
					name: 'Home',
					projects: [
						{ task: { uid: 'p1' }, progress: { done: 2, total: 5 } }, // 3 open
						{ task: { uid: 'p2' }, progress: { done: 1, total: 4 } }, // 3 open
					],
					done: [
						{ task: { uid: 'pd1' }, progress: { done: 3, total: 3 } }, // excluded
					],
				},
				{
					name: 'Work',
					projects: [
						{ task: { uid: 'p3' }, progress: { done: 0, total: 2 } }, // 2 open
					],
					done: [],
				},
			]

			expect(store.openTaskCount('Home')).toBe(6)
			expect(store.openTaskCount('Work')).toBe(2)
			expect(store.openTaskCount()).toBe(8)
			expect(store.totalOpenTasks).toBe(8)
		})

		it('falls back to recursive children walk when progress is not provided', () => {
			store.areas = [
				{
					name: 'Garden',
					projects: [
						{
							task: { uid: 'p1' },
							children: [
								{
									task: { uid: 't1', completed: false, status: 'NEEDS-ACTION' },
									children: [
										{ task: { uid: 't1-1', completed: false } },
										{ task: { uid: 't1-2', completed: true, status: 'COMPLETED' } },
									],
								},
								{
									task: { uid: 't2', completed: false, status: 'CANCELLED' },
									children: [],
								},
							],
						},
					],
				},
			]

			// t1 (open) + t1-1 (open) = 2 open tasks (t1-2 is completed, t2 is cancelled)
			expect(store.openTaskCount('Garden')).toBe(2)
			expect(store.totalOpenTasks).toBe(2)
		})
	})

	describe('allCollapsed', () => {
		it('returns false when no projects exist', () => {
			store.areas = []
			expect(store.allCollapsed).toBe(false)
		})

		it('returns false when any open project is expanded', () => {
			store.areas = [
				{
					name: 'Home',
					projects: [
						{ task: { uid: 'p1' } },
						{ task: { uid: 'p2' } },
					],
				},
			]
			store.collapsedProjects = new Set(['p1'])
			expect(store.allCollapsed).toBe(false)
		})

		it('returns true when all open projects are collapsed', () => {
			store.areas = [
				{
					name: 'Home',
					projects: [
						{ task: { uid: 'p1' } },
						{ task: { uid: 'p2' } },
					],
				},
			]
			store.collapsedProjects = new Set(['p1', 'p2'])
			expect(store.allCollapsed).toBe(true)
		})
	})
})
