import DavClient from '@nextcloud/cdav-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@nextcloud/auth', () => ({ getRequestToken: vi.fn(() => 'token') }))
vi.mock('@nextcloud/cdav-library', () => ({ default: vi.fn() }))
vi.mock('@nextcloud/router', () => ({ generateRemoteUrl: vi.fn(() => 'https://cloud.example.test/dav') }))

import { createDavSession, createTodo, fetchTodos, listTaskCalendars, putTodo } from '../../src/services/dav.js'

const calendarUrl = '/calendar/'

function makeClient(calendar) {
	return {
		connect: vi.fn(async function() {
			this.currentUserPrincipal = { url: '/principal/' }
			this.calendarHomes = [{
				findAllCalDAVCollectionsGrouped: vi.fn().mockResolvedValue({ calendars: [calendar] }),
			}]
		}),
		calendarHomes: [],
	}
}

function makeCalendar() {
	const todo = {
		url: `${calendarUrl}task.ics`,
		etag: 'e1',
		data: 'ics',
		update: vi.fn(async function() {
			this.etag = 'e2'
		}),
	}
	return {
		url: calendarUrl,
		displayname: 'Garden',
		owner: '/principal/',
		components: ['VTODO'],
		ctag: 'c1',
		_props: {},
		isWriteable: () => true,
		findByType: vi.fn().mockResolvedValue([todo]),
		find: vi.fn().mockResolvedValue(todo),
		createObject: vi.fn().mockResolvedValue(todo),
	}
}

beforeEach(() => vi.clearAllMocks())

describe('reusable DAV session', () => {
	it('connects and discovers once across repeated reads and writes', async () => {
		const calendar = makeCalendar()
		const client = makeClient(calendar)
		DavClient.mockImplementation(function DavClientMock() {
			return client
		})
		const session = createDavSession()

		await listTaskCalendars(session)
		const listing = client.calendarHomes[0].findAllCalDAVCollectionsGrouped
		listing.mockClear()
		await fetchTodos({ url: calendarUrl }, session)
		await createTodo({ url: calendarUrl }, 'new task', session)
		await putTodo(`${calendarUrl}task.ics`, 'edited task', 'e1', session)
		await fetchTodos({ url: calendarUrl }, session)

		expect(DavClient).toHaveBeenCalledOnce()
		expect(client.connect).toHaveBeenCalledOnce()
		expect(listing).not.toHaveBeenCalled()
	})

	it('refreshes calendar handles and ctags from the connected calendar home', async () => {
		const calendar = makeCalendar()
		const client = makeClient(calendar)
		DavClient.mockImplementation(function DavClientMock() {
			return client
		})
		const session = createDavSession()

		const first = await listTaskCalendars(session)
		calendar.ctag = 'c2'
		const second = await listTaskCalendars(session)

		expect(first[0].ctag).toBe('c1')
		expect(second[0].ctag).toBe('c2')
		expect(DavClient).toHaveBeenCalledOnce()
		expect(client.connect).toHaveBeenCalledOnce()
		expect(client.calendarHomes[0].findAllCalDAVCollectionsGrouped).toHaveBeenCalledTimes(2)
	})

	it('reconnects exactly once after an auth error, then completes the action', async () => {
		const calendar = makeCalendar()
		const failedCalendar = makeCalendar()
		failedCalendar.createObject.mockRejectedValueOnce({ status: 401 })
		const clients = [makeClient(failedCalendar), makeClient(calendar)]
		DavClient.mockImplementation(function DavClientMock() {
			return clients.shift()
		})
		const session = createDavSession()

		await expect(createTodo({ url: calendarUrl }, 'new task', session)).resolves.toMatchObject({
			url: `${calendarUrl}task.ics`,
		})
		expect(DavClient).toHaveBeenCalledTimes(2)
		expect(failedCalendar.createObject).toHaveBeenCalledOnce()
		expect(calendar.createObject).toHaveBeenCalledOnce()
	})

	it('clears a failed connection so a later call can connect again', async () => {
		const calendar = makeCalendar()
		const failedClient = makeClient(calendar)
		failedClient.connect.mockRejectedValueOnce({ status: 500 })
		const client = makeClient(calendar)
		const clients = [failedClient, client]
		DavClient.mockImplementation(function DavClientMock() {
			return clients.shift()
		})
		const session = createDavSession()

		await expect(listTaskCalendars(session)).rejects.toMatchObject({ status: 500 })
		await expect(listTaskCalendars(session)).resolves.toHaveLength(1)

		expect(DavClient).toHaveBeenCalledTimes(2)
		expect(failedClient.connect).toHaveBeenCalledOnce()
		expect(client.connect).toHaveBeenCalledOnce()
	})

	it('clears a failed calendar listing so a later create can succeed', async () => {
		const calendar = makeCalendar()
		const client = makeClient(calendar)
		DavClient.mockImplementation(function DavClientMock() {
			return client
		})
		const session = createDavSession()
		await session.client()
		const listing = client.calendarHomes[0].findAllCalDAVCollectionsGrouped
		listing.mockRejectedValueOnce({ status: 500 })

		await expect(listTaskCalendars(session)).rejects.toMatchObject({ status: 500 })
		await expect(createTodo({ url: calendarUrl }, 'new task', session)).resolves.toMatchObject({
			url: `${calendarUrl}task.ics`,
		})

		expect(DavClient).toHaveBeenCalledOnce()
		expect(client.connect).toHaveBeenCalledOnce()
		expect(listing).toHaveBeenCalledTimes(2)
		expect(calendar.createObject).toHaveBeenCalledOnce()
	})
})
