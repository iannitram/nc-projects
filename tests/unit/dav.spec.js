import { getRequestToken } from '@nextcloud/auth'
import DavClient from '@nextcloud/cdav-library'
import { generateRemoteUrl } from '@nextcloud/router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTodo, fetchTodo, fetchTodos, listTaskCalendars, putTodo } from '../../src/services/dav.js'

vi.mock('@nextcloud/auth', () => ({
	getRequestToken: vi.fn(),
}))

vi.mock('@nextcloud/cdav-library', () => ({
	default: vi.fn(),
}))

vi.mock('@nextcloud/router', () => ({
	generateRemoteUrl: vi.fn(),
}))

const calendarUrl = '/remote.php/dav/calendars/owner/projects/'
const todoUrl = `${calendarUrl}first.ics`

function makeCalendar(overrides = {}) {
	return {
		url: calendarUrl,
		displayname: 'Projects',
		owner: '/remote.php/dav/principals/users/owner/',
		components: ['VEVENT', 'VTODO'],
		ctag: 'calendar-tag',
		isWriteable: vi.fn(() => true),
		findByType: vi.fn(),
		find: vi.fn(),
		...overrides,
	}
}

function mockClient(calendars) {
	const client = {
		connect: vi.fn(),
		currentUserPrincipal: { url: '/remote.php/dav/principals/users/owner/' },
		calendarHomes: [{
			findAllCalDAVCollectionsGrouped: vi.fn().mockResolvedValue({ calendars }),
		}],
	}
	DavClient.mockImplementation(function DavClientMock() {
		return client
	})
	return client
}

beforeEach(() => {
	vi.clearAllMocks()
	getRequestToken.mockReturnValue('request-token')
	generateRemoteUrl.mockReturnValue('https://cloud.example.test/nextcloud/remote.php/dav')
})

describe('listTaskCalendars', () => {
	it('lists only VTODO calendars with ownership and write access', async () => {
		const taskCalendar = makeCalendar()
		const eventsCalendar = makeCalendar({
			url: '/remote.php/dav/calendars/owner/events/',
			components: ['VEVENT'],
		})
		const sharedCalendar = makeCalendar({
			url: '/remote.php/dav/calendars/other/shared/',
			owner: '/remote.php/dav/principals/users/other/',
			isWriteable: vi.fn(() => false),
			_props: { '{http://calendarserver.org/ns/}getctag': 'fallback-tag' },
			ctag: undefined,
		})
		const client = mockClient([taskCalendar, eventsCalendar, sharedCalendar])

		await expect(listTaskCalendars()).resolves.toEqual([
			{
				url: calendarUrl,
				displayName: 'Projects',
				ownedByMe: true,
				writable: true,
				ctag: 'calendar-tag',
			},
			{
				url: '/remote.php/dav/calendars/other/shared/',
				displayName: 'Projects',
				ownedByMe: false,
				writable: false,
				ctag: 'fallback-tag',
			},
		])
		expect(DavClient).toHaveBeenCalledWith({
			rootUrl: 'https://cloud.example.test/nextcloud/remote.php/dav',
			defaultHeaders: { requesttoken: 'request-token' },
		})
		expect(client.connect).toHaveBeenCalledWith({ enableCalDAV: true })
	})
})

describe('todo reads', () => {
	it('returns every VTODO in a calendar', async () => {
		const calendar = makeCalendar()
		calendar.findByType.mockResolvedValue([
			{ url: todoUrl, etag: '"one"', data: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n' },
			{ url: `${calendarUrl}done.ics`, etag: '"two"', data: 'DONE' },
		])
		mockClient([calendar])

		await expect(fetchTodos({ url: calendarUrl })).resolves.toEqual([
			{ url: todoUrl, etag: '"one"', ics: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', calendarUrl },
			{ url: `${calendarUrl}done.ics`, etag: '"two"', ics: 'DONE', calendarUrl },
		])
		expect(calendar.findByType).toHaveBeenCalledWith('VTODO')
	})

	it('re-reads one task from its containing calendar', async () => {
		const calendar = makeCalendar()
		calendar.find.mockResolvedValue({ url: todoUrl, etag: '"fresh"', data: 'FRESH' })
		mockClient([calendar])

		await expect(fetchTodo(todoUrl)).resolves.toEqual({
			url: todoUrl,
			etag: '"fresh"',
			ics: 'FRESH',
			calendarUrl,
		})
		expect(calendar.find).toHaveBeenCalledWith('first.ics')
	})
})

describe('todo writes', () => {
	it('replaces the full iCalendar with If-Match and returns its new etag', async () => {
		const calendar = makeCalendar()
		const todo = {
			url: todoUrl,
			etag: '"old"',
			data: 'OLD',
			update: vi.fn(async function() {
				this.etag = '"new"'
			}),
		}
		calendar.find.mockResolvedValue(todo)
		mockClient([calendar])

		await expect(putTodo(todoUrl, 'FULL ICALENDAR', '"old"')).resolves.toEqual({ etag: '"new"' })
		expect(calendar.find).toHaveBeenCalledWith('first.ics')
		expect(todo.data).toBe('FULL ICALENDAR')
		expect(todo.update).toHaveBeenCalledOnce()
	})

	it('maps HTTP 412 to ConflictError with the task URL', async () => {
		const calendar = makeCalendar()
		const todo = { etag: '"old"', data: 'OLD', update: vi.fn().mockRejectedValue({ status: 412 }) }
		calendar.find.mockResolvedValue(todo)
		mockClient([calendar])

		await expect(putTodo(todoUrl, 'FULL ICALENDAR', '"old"')).rejects.toMatchObject({
			name: 'ConflictError',
			url: todoUrl,
		})
	})

	it('creates an iCalendar object on the requested list', async () => {
		vi.spyOn(crypto, 'randomUUID').mockReturnValue('random')
		const calendar = makeCalendar({
			createObject: vi.fn().mockResolvedValue({ url: `${calendarUrl}random.ics`, etag: '"created"', data: 'FULL ICALENDAR' }),
		})
		mockClient([calendar])

		await expect(createTodo({ url: calendarUrl }, 'FULL ICALENDAR')).resolves.toEqual({
			url: `${calendarUrl}random.ics`,
			etag: '"created"',
			ics: 'FULL ICALENDAR',
			calendarUrl,
		})
		expect(calendar.createObject).toHaveBeenCalledWith('random.ics', { 'Content-Type': 'text/calendar; charset=utf-8' }, 'FULL ICALENDAR')
	})

	it('maps HTTP 412 during creation to ConflictError with the created URL', async () => {
		vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-uuid')
		const calendar = makeCalendar({ createObject: vi.fn().mockRejectedValue({ status: 412 }) })
		mockClient([calendar])

		await expect(createTodo({ url: calendarUrl }, 'FULL ICALENDAR')).rejects.toMatchObject({
			name: 'ConflictError',
			url: `${calendarUrl}new-uuid.ics`,
		})
	})
})
