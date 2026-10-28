import { mount } from '@vue/test-utils'
import { ReportButton } from 'craft-bugreport-web'
import { createPinia, setActivePinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import App from '../../src/App.vue'
import AppNav from '../../src/components/AppNav.vue'
import { useProjectsStore } from '../../src/store/projects.js'

vi.mock('craft-bugreport-web', () => ({ ReportButton: {
	name: 'ReportButton',
	props: ['config', 'getWorkingFile'],
	template: '<button>Report a bug</button>',
} }))
vi.mock('@nextcloud/auth', async (importOriginal) => ({ ...(await importOriginal()), getRequestToken: () => 'test-csrf-token' }))
vi.mock('@nextcloud/initial-state', async (importOriginal) => {
	const actual = await importOriginal()
	return { ...actual, loadState: (app, key, ...args) => key === 'bugReport' ? { version: '0.1.0', commit: 'abcdef1', ncVersion: '33.0.10', configured: false } : actual.loadState(app, key, ...args) }
})
vi.mock('../../src/composables/useRefresh.js', () => ({ useRefresh: vi.fn() }))

it('mounts the report button in navigation with relay-only config and an optional area snapshot', async () => {
	const pinia = createPinia()
	setActivePinia(pinia)
	const store = useProjectsStore()
	vi.spyOn(store, 'load').mockResolvedValue()
	const project = { uid: 'p1', summary: 'Example project', status: 'NEEDS-ACTION', sortOrder: 2, parentUid: null, url: '/own/project.ics' }
	const task = { uid: 't1', summary: 'Example task', status: 'COMPLETED', sortOrder: 3, parentUid: 'p1', url: '/own/task.ics', privateField: 'must not be copied' }
	const deeper = { uid: 't2', summary: 'Deep task', status: 'NEEDS-ACTION', sortOrder: 4, parentUid: 't1', url: '/own/deep.ics' }
	store.areas = [{ name: 'Area A', calendarUrl: '/own/', projects: [{ task: project, children: [] }], done: [] }]
	store.tasksByUid = { p1: project, t1: task, t2: deeper, unrelated: { uid: 'unrelated', summary: 'Unrelated task' } }
	const wrapper = mount(App, {
		global: {
			plugins: [pinia],
			stubs: { AreaSection: true, AreaSettings: true, TopBar: true, StatusLine: true },
		},
	})
	const button = wrapper.getComponent(ReportButton)
	expect(wrapper.getComponent(AppNav).findComponent(ReportButton).exists()).toBe(true)
	const config = button.props('config')
	expect(config).toEqual({ app: 'Projects', version: '0.1.0', commit: 'abcdef1', ncVersion: '33.0.10', relayUrl: expect.stringMatching(/\/apps\/cc_projects\/api\/bugreport$/), headers: { requesttoken: 'test-csrf-token' } })
	expect(config).not.toHaveProperty('dropBase')
	expect(config).not.toHaveProperty('dropToken')
	expect(wrapper.text()).toContain('Bug reports are not set up for this app.')
	expect(await button.props('getWorkingFile')()).toBeNull()
	wrapper.getComponent(AppNav).vm.$emit('selectArea', 'Area A')
	await wrapper.vm.$nextTick()
	const file = await button.props('getWorkingFile')()
	expect(file).toMatchObject({ name: 'area.json', type: 'application/json', data: expect.any(String) })
	const data = JSON.parse(file.data)
	expect(data.name).toBe('Area A')
	expect(data.projects).toEqual([{ uid: 'p1', title: 'Example project', status: 'NEEDS-ACTION', order: 2, parentUid: null, url: '/own/project.ics' }])
	expect(data.tasks).toEqual([
		{ uid: 't1', title: 'Example task', status: 'COMPLETED', order: 3, parentUid: 'p1', url: '/own/task.ics' },
		{ uid: 't2', title: 'Deep task', status: 'NEEDS-ACTION', order: 4, parentUid: 't1', url: '/own/deep.ics' },
	])
	expect(file.data).not.toContain('privateField')
	expect(file.data).not.toContain('Unrelated task')
	store.tasksByUid.t1.summary = 'Edited title'
	expect((await button.props('getWorkingFile')()).data).toContain('Edited title')
	store.view = 'needs-filing'
	await wrapper.vm.$nextTick()
	expect(await button.props('getWorkingFile')()).toBeNull()
	store.view = 'areas'
	wrapper.getComponent(AppNav).vm.$emit('selectArea', null)
	await wrapper.vm.$nextTick()
	expect(await button.props('getWorkingFile')()).toBeNull()
	wrapper.unmount()
})
