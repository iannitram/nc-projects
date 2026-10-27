import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import AreaSection from '../../src/components/AreaSection.vue'

describe('AreaSection', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('renders the area title and each project in area.projects in order', () => {
		const area = {
			name: 'Personal',
			calendarUrl: '/personal/',
			projects: [
				{
					task: { uid: 'p1', summary: 'Project 1', categories: ['project'], url: '/p1.ics', calendarUrl: '/personal/' },
					children: [],
					progress: { done: 1, total: 2 },
				},
				{
					task: { uid: 'p2', summary: 'Project 2', categories: ['project'], url: '/p2.ics', calendarUrl: '/personal/' },
					children: [],
					progress: { done: 0, total: 3 },
				},
			],
			done: [],
		}

		const wrapper = mount(AreaSection, {
			props: { area },
		})

		expect(wrapper.find('h3').text()).toBe('Personal')
		expect(wrapper.findAll('.cc-project-card')).toHaveLength(2)
		expect(wrapper.text()).toContain('Project 1')
		expect(wrapper.text()).toContain('Project 2')
	})
})
