import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { CLOCK_INTERVAL_MS, useClock } from '../../src/composables/useClock.js'

function host(intervalMs) {
	let clock
	const wrapper = mount(defineComponent({
		setup() {
			clock = intervalMs === undefined ? useClock() : useClock(intervalMs)
			return () => null
		},
	}))
	return { wrapper, clock }
}

describe('useClock', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(2026, 9, 31, 23, 59, 10))
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('ticks every 30 seconds by default', () => {
		expect(CLOCK_INTERVAL_MS).toBe(30000)
	})

	it('starts at the current local minute and day', () => {
		const { clock } = host()

		expect(clock.minute.value).toBe(23 * 60 + 59)
		expect(clock.today.value).toBe('2026-10-31')
		expect(clock.now.value.getSeconds()).toBe(10)
	})

	it('rolls over to the next day after midnight, on the next tick', () => {
		const { clock } = host()

		vi.advanceTimersByTime(29999)
		expect(clock.today.value).toBe('2026-10-31')
		vi.advanceTimersByTime(1)
		expect(clock.minute.value).toBe(23 * 60 + 59)
		vi.advanceTimersByTime(30000)
		expect(clock.today.value).toBe('2026-11-01')
		expect(clock.minute.value).toBe(0)
	})

	it('takes another interval', () => {
		const { clock } = host(60000)

		vi.advanceTimersByTime(30000)
		expect(clock.minute.value).toBe(23 * 60 + 59)
		vi.advanceTimersByTime(30000)
		expect(clock.minute.value).toBe(0)
	})

	it('re-reads the clock when the window gets focus', () => {
		const { clock } = host()
		vi.setSystemTime(new Date(2026, 10, 1, 7, 5, 0))

		window.dispatchEvent(new Event('focus'))

		expect(clock.today.value).toBe('2026-11-01')
		expect(clock.minute.value).toBe(7 * 60 + 5)
	})

	it('stops ticking and listening once unmounted', () => {
		const { wrapper, clock } = host()
		wrapper.unmount()
		vi.setSystemTime(new Date(2026, 10, 1, 9, 0, 0))

		vi.advanceTimersByTime(120000)
		window.dispatchEvent(new Event('focus'))

		expect(clock.minute.value).toBe(23 * 60 + 59)
		expect(vi.getTimerCount()).toBe(0)
	})
})
