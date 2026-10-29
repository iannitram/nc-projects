import { emit } from '@nextcloud/event-bus'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppNav from '../../src/components/AppNav.vue'

const mobile = vi.hoisted(() => ({ value: true }))

vi.mock('@nextcloud/vue', async (importOriginal) => ({
	...(await importOriginal()),
	useIsMobile: () => ({
		get value() {
			return mobile.value
		},
	}),
}))

describe('AppNav: Escape closes the drawer on phones (#123)', () => {
	let wrapper

	const toggle = () => document.querySelector('.app-navigation-toggle')
	const escape = (target = document.body) => {
		const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		target.dispatchEvent(event)
		return event
	}

	beforeEach(async () => {
		setActivePinia(createPinia())
		mobile.value = true
		wrapper = mount(AppNav, { attachTo: document.body })
		await flushPromises()
		// On a phone the drawer starts closed (NcAppNavigation's own rule): open it.
		emit('toggle-navigation', { open: true })
		await flushPromises()
	})

	afterEach(() => {
		wrapper.unmount()
		document.body.innerHTML = ''
	})

	it('closes the open drawer and focuses the navigation toggle', async () => {
		expect(toggle().getAttribute('aria-expanded')).toBe('true')
		escape(document.querySelector('nav, .app-navigation') ?? document.body)
		await flushPromises()
		expect(toggle().getAttribute('aria-expanded')).toBe('false')
		expect(document.activeElement).toBe(toggle())
	})

	it('does nothing when the drawer is already closed', async () => {
		emit('toggle-navigation', { open: false })
		await flushPromises()
		toggle().blur()
		escape()
		await flushPromises()
		expect(toggle().getAttribute('aria-expanded')).toBe('false')
		expect(document.activeElement).not.toBe(toggle())
	})

	it('leaves Escape alone when a menu or dialog handled it', async () => {
		const handled = (event) => event.preventDefault()
		document.body.addEventListener('keydown', handled)
		escape()
		document.body.removeEventListener('keydown', handled)
		await flushPromises()
		expect(toggle().getAttribute('aria-expanded')).toBe('true')

		const dialog = document.createElement('div')
		dialog.setAttribute('role', 'dialog')
		document.body.appendChild(dialog)
		escape(dialog)
		await flushPromises()
		expect(toggle().getAttribute('aria-expanded')).toBe('true')
	})

	it('does nothing on desktop width', async () => {
		mobile.value = false
		escape()
		await flushPromises()
		expect(toggle().getAttribute('aria-expanded')).toBe('true')
	})
})
