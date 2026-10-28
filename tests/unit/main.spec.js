import { installErrorBuffer } from 'craft-bugreport-web'
import { expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { attachVueErrorHandler, installCrashLog } from '../../src/services/crashLog.js' // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

vi.mock('craft-bugreport-web', () => ({ installErrorBuffer: vi.fn(() => ({ lines: () => [], uninstall: () => {} })) }))
vi.mock('pinia', () => ({ createPinia: vi.fn(() => ({})) }))
vi.mock('vue', () => ({ createApp: vi.fn(() => ({ config: {}, mount: vi.fn(), use: vi.fn().mockReturnThis() })) }))
vi.mock('../../src/App.vue', () => ({ default: {} }))
// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
vi.mock('../../src/services/crashLog.js', () => ({ installCrashLog: vi.fn(), attachVueErrorHandler: vi.fn() }))

it('installs the crash log first, then starts the error buffer once, then creates the app', async () => {
	await import('../../src/main.js')
	expect(installCrashLog).toHaveBeenCalledOnce() // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	expect(installErrorBuffer).toHaveBeenCalledOnce()
	expect(createApp).toHaveBeenCalledOnce()
	expect(attachVueErrorHandler).toHaveBeenCalledOnce() // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	expect(installCrashLog.mock.invocationCallOrder[0]).toBeLessThan(installErrorBuffer.mock.invocationCallOrder[0]) // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	expect(installErrorBuffer.mock.invocationCallOrder[0]).toBeLessThan(createApp.mock.invocationCallOrder[0])
	expect(createApp.mock.invocationCallOrder[0]).toBeLessThan(attachVueErrorHandler.mock.invocationCallOrder[0]) // TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
})
