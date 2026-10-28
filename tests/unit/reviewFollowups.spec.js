import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import TaskRow from '../../src/components/TaskRow.vue'
import { n } from '../../src/services/l10n.js'

vi.mock('@nextcloud/router', async (importOriginal) => ({
	...(await importOriginal()),
	generateUrl: vi.fn((route) => `/${route}`),
}))

describe('n() plural helper', () => {
	it.each([[0, '0 open tasks'], [1, '1 open task'], [2, '2 open tasks']])('%i gives "%s"', (count, text) => {
		expect(n('%n open task', '%n open tasks', count)).toBe(text)
	})
})

/**
 * Mount a row with the real "Due date…" picker (only the menu shell is stubbed, so its items render).
 *
 * @param {object} task the task fields
 * @return {Promise<import('@vue/test-utils').VueWrapper>} the mounted row
 */
async function mountWithPicker(task) {
	const wrapper = mount(TaskRow, {
		props: { node: { task: { uid: 't1', summary: 'Fix it', ...task }, children: [], deeper: 0 } },
		global: { stubs: { NcActions: { template: '<div class="nc-actions-stub"><slot /></div>' } } },
		attachTo: document.body,
	})
	await flushPromises()
	await new Promise((resolve) => setTimeout(resolve, 20))
	return wrapper
}

describe('the row menu\'s "Due date…" picker', () => {
	it('is empty with the "No due date" placeholder for a task with no due date, not today', async () => {
		const wrapper = await mountWithPicker({ due: null })
		const input = wrapper.get('.cc-task-row__due-input input')
		expect(input.element.value).toBe('')
		expect(input.attributes('placeholder')).toBe('No due date')
		wrapper.unmount()
	})

	it('shows the due date when there is one', async () => {
		const wrapper = await mountWithPicker({ due: new Date(2030, 2, 4) })
		const input = wrapper.get('.cc-task-row__due-input input')
		expect(input.element.value).not.toBe('')
		expect(input.element.value).toMatch(/2030/)
		wrapper.unmount()
	})
})

describe('phone measurements', () => {
	const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')

	it('gives the project band\'s buttons the 44 px touch target', () => {
		const css = read('src/styles/projects.css')
		const rule = css.match(/\/\* Touch targets: 44 x 44[^*]*\*\/([^{]*)\{([^}]*)\}/)
		for (const selector of ['.cc-project-card__collapse', '.cc-project-card__completion', '.cc-project-card__menu .action-item__menutoggle']) {
			expect(rule[1]).toContain(selector)
		}
		expect(rule[2]).toMatch(/min-height:\s*var\(--cc-target\)/)
		expect(rule[2]).toMatch(/min-width:\s*var\(--cc-target\)/)
	})

	it('keeps the top-bar title on one line', () => {
		const title = read('src/components/TopBar.vue').match(/\n\.cc-top-bar__title \{([^}]*)\}/)[1]
		expect(title).toMatch(/white-space:\s*nowrap/)
		expect(title).toMatch(/text-overflow:\s*ellipsis/)
		expect(title).toMatch(/overflow:\s*hidden/)
	})
})
