import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../../src/App.vue'

describe('App', () => {
	it('shows the Projects heading', () => {
		const wrapper = mount(App)
		expect(wrapper.find('h2').text()).toBe('Projects')
	})
})
