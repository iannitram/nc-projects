import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StatusLine, { formatRelativeTime } from '../../src/components/StatusLine.vue'
import { useProjectsStore } from '../../src/store/projects.js'

describe('StatusLine', () => {
	let pinia
	let store

	beforeEach(() => {
		vi.useFakeTimers()
		pinia = createPinia()
		setActivePinia(pinia)
		store = useProjectsStore()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe('formatRelativeTime', () => {
		it('returns "just now" when timestamp is missing or less than 60s ago', () => {
			const now = 1000000
			expect(formatRelativeTime(null, now)).toBe('just now')
			expect(formatRelativeTime(undefined, now)).toBe('just now')
			expect(formatRelativeTime(now, now)).toBe('just now')
			expect(formatRelativeTime(now - 30000, now)).toBe('just now')
			expect(formatRelativeTime(now - 59000, now)).toBe('just now')
		})

		it('returns "1 min ago" when between 60s and 119s', () => {
			const now = 1000000
			expect(formatRelativeTime(now - 60000, now)).toBe('1 min ago')
			expect(formatRelativeTime(now - 119000, now)).toBe('1 min ago')
		})

		it('returns "N min ago" for N minutes under 1 hour', () => {
			const now = 10000000
			expect(formatRelativeTime(now - 120000, now)).toBe('2 min ago')
			expect(formatRelativeTime(now - 300000, now)).toBe('5 min ago')
			expect(formatRelativeTime(now - 59 * 60 * 1000, now)).toBe('59 min ago')
		})

		it('returns "1 hour ago" or "N hours ago"', () => {
			const now = 100000000
			expect(formatRelativeTime(now - 60 * 60 * 1000, now)).toBe('1 hour ago')
			expect(formatRelativeTime(now - 2 * 60 * 60 * 1000, now)).toBe('2 hours ago')
		})
	})

	it('renders status line text from counts and lastRefreshedAt ("just now")', () => {
		const now = Date.now()
		store.lastRefreshedAt = now
		store.areas = [
			{
				name: 'Home',
				projects: [
					{
						task: { uid: 'p1' },
						progress: { done: 3, total: 7 }, // 4 open tasks
					},
					{
						task: { uid: 'p2' },
						progress: { done: 1, total: 3 }, // 2 open tasks
					},
				],
			},
			{
				name: 'Work',
				projects: [
					{
						task: { uid: 'p3' },
						progress: { done: 0, total: 5 }, // 5 open tasks
					},
				],
			},
		]

		const wrapper = mount(StatusLine, {
			global: { plugins: [pinia] },
		})

		// 3 open projects, 11 open tasks (4 + 2 + 5), Updated just now
		expect(wrapper.text()).toBe('3 open projects · 11 open tasks · Updated just now')
	})

	it('updates relative time to "1 min ago" and "5 min ago" as time advances', async () => {
		const start = Date.now()
		store.lastRefreshedAt = start
		store.areas = [
			{
				name: 'Home',
				projects: [
					{ task: { uid: 'p1' }, progress: { done: 0, total: 1 } },
				],
			},
		]

		const wrapper = mount(StatusLine, {
			global: { plugins: [pinia] },
		})
		expect(wrapper.text()).toContain('Updated just now')

		// Advance 30s (timer ticks, still under 60s)
		vi.advanceTimersByTime(30000)
		await wrapper.vm.$nextTick()
		expect(wrapper.text()).toContain('Updated just now')

		// Advance another 30s (60s total elapsed)
		vi.advanceTimersByTime(30000)
		await wrapper.vm.$nextTick()
		expect(wrapper.text()).toContain('Updated 1 min ago')

		// Advance to 5 minutes total (4 more minutes = 240000 ms)
		vi.advanceTimersByTime(240000)
		await wrapper.vm.$nextTick()
		expect(wrapper.text()).toContain('Updated 5 min ago')
	})

	it('resets "Updated" time when lastRefreshedAt is updated by refresh()', async () => {
		const start = Date.now()
		store.lastRefreshedAt = start
		store.areas = [
			{
				name: 'Home',
				projects: [
					{ task: { uid: 'p1' }, progress: { done: 0, total: 1 } },
				],
			},
		]

		const wrapper = mount(StatusLine, {
			global: { plugins: [pinia] },
		})

		// Advance time by 3 minutes
		vi.advanceTimersByTime(180000)
		await wrapper.vm.$nextTick()
		expect(wrapper.text()).toContain('Updated 3 min ago')

		// Simulate refresh() succeeding and setting lastRefreshedAt to Date.now()
		store.lastRefreshedAt = Date.now()
		await wrapper.vm.$nextTick()
		expect(wrapper.text()).toContain('Updated just now')
	})

	it('handles singular counts properly (1 open project · 1 open task)', () => {
		store.lastRefreshedAt = Date.now()
		store.areas = [
			{
				name: 'Studio',
				projects: [
					{ task: { uid: 'p1' }, progress: { done: 0, total: 1 } },
				],
			},
		]

		const wrapper = mount(StatusLine, {
			global: { plugins: [pinia] },
		})

		expect(wrapper.text()).toBe('1 open project · 1 open task · Updated just now')
	})
})
