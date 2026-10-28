import { describe, expect, it } from 'vitest'
import { candidateLists, isExcluded, pickAreas } from '../../src/services/areas.js'

describe('isExcluded', () => {
	it('excludes calendars not owned by the user', () => {
		expect(isExcluded({ ownedByMe: false, url: '/shared/' })).toBe(true)
	})
	it('excludes shared and generated lists by URL', () => {
		expect(isExcluded({ url: '/remote.php/dav/calendars/user/list_shared_by_agent/' })).toBe(true)
		expect(isExcluded({ url: '/remote.php/dav/calendars/user/app-generated--deck--board/' })).toBe(true)
	})
	it('keeps valid calendars', () => {
		expect(isExcluded({ ownedByMe: true, url: '/remote.php/dav/calendars/user/list-a/' })).toBe(false)
	})
})

describe('candidateLists and pickAreas', () => {
	const calendars = [
		{ displayName: 'Home', url: '/remote.php/dav/calendars/user/list-a/', ownedByMe: true },
		{ displayName: 'Shared', url: '/remote.php/dav/calendars/user/list_shared_by_agent/', ownedByMe: true },
		{ displayName: 'Work', url: '/remote.php/dav/calendars/user/list-b/', ownedByMe: true },
	]

	it('preserves eligible calendars in display order', () => {
		expect(candidateLists(calendars)).toEqual([calendars[0], calendars[2]])
	})

	it('resolves saved URLs in saved order and skips missing or excluded URLs', () => {
		expect(pickAreas(calendars, [calendars[2].url, '/missing/', calendars[1].url, calendars[0].url])).toEqual([
			{ name: 'Work', calendar: calendars[2] },
			{ name: 'Home', calendar: calendars[0] },
		])
	})

	it('uses the current display name after a rename', () => {
		expect(pickAreas([{ ...calendars[0], displayName: 'House' }], [calendars[0].url])).toEqual([
			{ name: 'House', calendar: { ...calendars[0], displayName: 'House' } },
		])
	})
})
