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
	})
})
