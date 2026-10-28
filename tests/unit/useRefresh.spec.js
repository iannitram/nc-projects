import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { REFRESH_INTERVAL_MS, useRefresh } from '../../src/composables/useRefresh.js'

function host(refresh, intervalMs) {
	return mount(defineComponent({
		setup() {
			if (intervalMs === undefined) {
				useRefresh(refresh)
			} else {
				useRefresh(refresh, intervalMs)
			}
			return () => null
		},
	}))
}

const focus = () => window.dispatchEvent(new Event('focus'))

describe('useRefresh', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('uses an interval of 2 minutes by default', () => {
		expect(REFRESH_INTERVAL_MS).toBe(120000)
	})

	it('does not call refresh just by mounting', () => {
		const refresh = vi.fn().mockResolvedValue()

		host(refresh)

		expect(refresh).not.toHaveBeenCalled()
	})

	it('calls refresh once each time the window gets focus', () => {
		const refresh = vi.fn().mockResolvedValue()
		host(refresh)

		focus()
		expect(refresh).toHaveBeenCalledTimes(1)
		focus()
		expect(refresh).toHaveBeenCalledTimes(2)
	})

	it('calls refresh every 2 minutes by default, and not before', () => {
		const refresh = vi.fn().mockResolvedValue()
		host(refresh)

		vi.advanceTimersByTime(119999)
		expect(refresh).toHaveBeenCalledTimes(0)
		vi.advanceTimersByTime(1)
		expect(refresh).toHaveBeenCalledTimes(1)
		vi.advanceTimersByTime(240000)
		expect(refresh).toHaveBeenCalledTimes(3)
	})

	it('takes the interval as the second argument', () => {
		const refresh = vi.fn().mockResolvedValue()
		host(refresh, 1000)

		vi.advanceTimersByTime(3500)

		expect(refresh).toHaveBeenCalledTimes(3)
	})

	it('stops both triggers when the component unmounts', () => {
		const refresh = vi.fn().mockResolvedValue()
		const wrapper = host(refresh, 1000)

		wrapper.unmount()
		focus()
		vi.advanceTimersByTime(60000)

		expect(refresh).not.toHaveBeenCalled()
	})

	it('keeps going after a refresh that fails, without throwing', async () => {
		const refresh = vi.fn().mockRejectedValue(new Error('offline'))
		host(refresh, 1000)

		focus()
		await vi.advanceTimersByTimeAsync(2500)

		expect(refresh).toHaveBeenCalledTimes(3)
	})
})
