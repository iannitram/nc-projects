import { getRequestToken } from '@nextcloud/auth'
import DavClient from '@nextcloud/cdav-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchTodo, listTaskCalendars } from '../../src/services/dav.js'

vi.mock('@nextcloud/auth', () => ({
	getRequestToken: vi.fn(),
}))

vi.mock('@nextcloud/cdav-library', () => ({
	default: vi.fn(),
}))

vi.mock('@nextcloud/router', () => ({
	generateRemoteUrl: vi.fn((service) => `https://cloud.example.test/nextcloud/remote.php/${service}`),
	generateUrl: vi.fn((path) => `/nextcloud/index.php${path}`),
}))

const calendarUrl = '/nextcloud/remote.php/dav/calendars/owner/projects/'

function mockLibrary() {
	const calendar = {
		url: calendarUrl,
		displayname: 'Projects',
		owner: '/nextcloud/remote.php/dav/principals/users/owner/',
		components: ['VTODO'],
		ctag: 'tag',
		isWriteable: () => true,
		find: vi.fn().mockResolvedValue({ url: `${calendarUrl}a.ics`, etag: 'e1', data: 'ICS' }),
	}
	const client = {
		connect: vi.fn(),
		currentUserPrincipal: { url: '/nextcloud/remote.php/dav/principals/users/owner/' },
		calendarHomes: [{ findAllCalDAVCollectionsGrouped: vi.fn().mockResolvedValue({ calendars: [calendar] }) }],
	}
	// Like cdav-library 2.6.2: every request is new URL(path, rootUrl), so a relative rootUrl throws.
	DavClient.mockImplementation(function DavClientMock(options) {
		client.base = new URL('/', options.rootUrl).href
		return client
	})
}

beforeEach(() => {
	vi.clearAllMocks()
	getRequestToken.mockReturnValue('request-token')
	mockLibrary()
})

describe('dav client root URL', () => {
	it('builds the client with an absolute http(s) rootUrl', async () => {
		await listTaskCalendars()

		expect(DavClient).toHaveBeenCalledTimes(1)
		expect(DavClient.mock.calls[0][0].rootUrl).toMatch(/^https?:\/\//)
		expect(new URL(DavClient.mock.calls[0][0].rootUrl).pathname).toContain('/remote.php/dav')
	})

	it('never hands the library a relative rootUrl, whichever function builds the client', async () => {
		await listTaskCalendars()
		await fetchTodo(`${calendarUrl}a.ics`)

		expect(DavClient).toHaveBeenCalledTimes(2)
		for (const [options] of DavClient.mock.calls) {
			expect(options.rootUrl).not.toMatch(/^\//)
			expect(options.rootUrl).toMatch(/^https?:\/\//)
		}
	})

	it('lists the calendars when the library rejects a relative rootUrl as the real one does', async () => {
		const calendars = await listTaskCalendars()

		expect(calendars.map((calendar) => calendar.displayName)).toEqual(['Projects'])
	})
})
