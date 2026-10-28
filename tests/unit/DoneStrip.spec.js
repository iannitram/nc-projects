import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DoneStrip from '../../src/components/DoneStrip.vue'
import { Task } from '../../src/models/Task.js'

vi.mock('@nextcloud/router', async (importOriginal) => ({
	...(await importOriginal()),
	generateUrl: vi.fn((route) => `/${route}`),
}))

describe('DoneStrip', () => {
	it('is hidden when completed projects list is empty (N is 0)', () => {
		const wrapper = mount(DoneStrip, {
			props: { projects: [] },
		})

		expect(wrapper.find('.cc-done-strip').exists()).toBe(false)
		expect(wrapper.text()).toBe('')
	})

	it('is collapsed by default, displaying "N done projects" with a disclosure button', () => {
		const projects = [
			{
				task: {
					uid: 'p1',
					summary: 'Done Project 1',
					url: '/remote.php/dav/calendars/owner/list-a/p1.ics',
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				children: [],
				progress: { done: 2, total: 2 },
			},
			{
				task: {
					uid: 'p2',
					summary: 'Done Project 2',
					url: '/remote.php/dav/calendars/owner/list-a/p2.ics',
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				children: [],
				progress: { done: 1, total: 1 },
			},
		]

		const wrapper = mount(DoneStrip, {
			props: { projects },
		})

		expect(wrapper.find('.cc-done-strip').exists()).toBe(true)
		expect(wrapper.text()).toContain('2 done projects')
		const toggle = wrapper.find('button.cc-done-strip__toggle')
		expect(toggle.exists()).toBe(true)
		expect(toggle.find('svg').exists()).toBe(true)
		expect(toggle.attributes('aria-expanded')).toBe('false')
		expect(wrapper.find('.cc-done-strip__list').exists()).toBe(false)
	})

	it('expands on disclosure click to show plain list of project titles with Tasks links', async () => {
		const projects = [
			{
				task: {
					uid: 'p1',
					summary: 'Done Project 1',
					url: '/remote.php/dav/calendars/owner/list-a/p1.ics',
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				children: [],
				progress: { done: 2, total: 2 },
			},
			{
				task: {
					uid: 'p2',
					summary: 'Done Project 2',
					url: '/remote.php/dav/calendars/owner/list-a/p2.ics',
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				children: [],
				progress: { done: 1, total: 1 },
			},
		]

		const wrapper = mount(DoneStrip, {
			props: { projects },
		})

		const toggle = wrapper.find('button.cc-done-strip__toggle')
		await toggle.trigger('click')

		expect(toggle.attributes('aria-expanded')).toBe('true')
		expect(wrapper.find('.cc-done-strip__list').exists()).toBe(true)

		const items = wrapper.findAll('.cc-done-strip__item')
		expect(items).toHaveLength(2)

		const links = wrapper.findAll('.cc-done-strip__link')
		expect(items[0].text()).toContain('Done Project 1')
		expect(links[0].attributes('aria-label')).toBe('Open in Tasks: Done Project 1')
		expect(links[0].attributes('href')).toBe('/apps/tasks/calendars/list-a/tasks/p1.ics')

		expect(items[1].text()).toContain('Done Project 2')
		expect(links[1].attributes('aria-label')).toBe('Open in Tasks: Done Project 2')
		expect(links[1].attributes('href')).toBe('/apps/tasks/calendars/list-a/tasks/p2.ics')

		await toggle.trigger('click')
		expect(toggle.attributes('aria-expanded')).toBe('false')
		expect(wrapper.find('.cc-done-strip__list').exists()).toBe(false)
	})

	it('shows a read-only checked indicator and the actual COMPLETED date only when present', async () => {
		const task = (uid, completed) => Task.fromIcs([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'BEGIN:VTODO',
			`UID:${uid}`,
			`SUMMARY:${uid}`,
			'STATUS:COMPLETED',
			...(completed ? [`COMPLETED:${completed}`] : []),
			'END:VTODO',
			'END:VCALENDAR',
			'',
		].join('\r\n'), { url: `/${uid}.ics`, calendarUrl: '/home/' })
		const wrapper = mount(DoneStrip, { props: { projects: [
			{ task: task('dated', '20261022T120000Z') },
			{ task: task('undated') },
		] } })
		expect(wrapper.find('time').exists()).toBe(false)
		await wrapper.get('.cc-done-strip__toggle').trigger('click')
		const rows = wrapper.findAll('.cc-done-strip__item')
		for (const row of rows) {
			expect(row.get('[role="checkbox"]').attributes('aria-checked')).toBe('true')
			expect(row.get('[role="checkbox"]').attributes('aria-readonly')).toBe('true')
			expect(row.get('a').get('svg').exists()).toBe(true)
		}
		expect(rows[0].get('time').attributes('datetime')).toBe('2026-10-22T12:00:00.000Z')
		expect(rows[0].get('time').text()).toBe(new Date('2026-10-22T12:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))
		expect(rows[1].find('time').exists()).toBe(false)
	})

	it('accepts completed projects via the done prop', () => {
		const done = [
			{
				task: {
					uid: 'p1',
					summary: 'Completed Project',
					url: '/remote.php/dav/calendars/owner/list-a/p1.ics',
					calendarUrl: '/remote.php/dav/calendars/owner/list-a/',
				},
				children: [],
				progress: { done: 3, total: 3 },
			},
		]

		const wrapper = mount(DoneStrip, {
			props: { done },
		})

		expect(wrapper.find('.cc-done-strip').exists()).toBe(true)
		expect(wrapper.text()).toContain('1 done projects')
	})
})
