import { vi } from 'vitest'

vi.mock('../../src/services/settings.js', () => ({
	getAreaLists: vi.fn(async () => ['/list-a/', '/list-b/', '/list-c/']),
	saveAreaLists: vi.fn(async (urls) => urls),
}))
