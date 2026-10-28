import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useRefresh } from '../../src/composables/useRefresh.js'

const wrappers = []

function host(refresh, intervalMs) {
	const wrapper = mount(defineComponent({
		setup() {
			if (intervalMs === undefined) {
				useRefresh(refresh)
			} else {
				useRefresh(refresh, intervalMs)
			}
			return () => null
		},
	}))
	wrappers.push(wrapper)
	return wrapper
}

const focus = () => window.dispatchEvent(new Event('focus'))

describe('useRefresh when refresh throws synchronously', () => {
	let errors

	const onError = (event) => {
		errors.push(event.error ?? event.message)
		// Keep jsdom from printing the error to the console.
		event.preventDefault()
	}

	beforeEach(() => {
		vi.useFakeTimers()
		errors = []
		window.addEventListener('error', onError)
	})

	afterEach(() => {
		while (wrappers.length) {
			wrappers.pop().unmount()
		}
		window.removeEventListener('error', onError)
		vi.useRealTimers()
	})

	it('a focus event does not throw or produce an uncaught error', () => {
		const refresh = vi.fn(() => {
			throw new Error('sync failure')
		})
		host(refresh)

		expect(() => focus()).not.toThrow()

		expect(refresh).toHaveBeenCalledTimes(1)
		expect(errors).toEqual([])
	})

	it('a later focus still calls refresh again', () => {
		const refresh = vi.fn(() => {
			throw new Error('sync failure')
		})
		host(refresh)

		focus()
		focus()

		expect(refresh).toHaveBeenCalledTimes(2)
		expect(errors).toEqual([])
	})

	it('an interval tick does not throw, and later ticks still call refresh', () => {
		const refresh = vi.fn(() => {
			throw new Error('sync failure')
		})
		host(refresh, 1000)

		expect(() => vi.advanceTimersByTime(3500)).not.toThrow()

		expect(refresh).toHaveBeenCalledTimes(3)
		expect(errors).toEqual([])
	})
})
