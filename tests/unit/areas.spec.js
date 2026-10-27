import { describe, expect, it } from 'vitest'
import { isExcluded, pickAreas } from '../../src/services/areas.js'

describe('isExcluded', () => {
	it('should return true when ownedByMe is false', () => {
		expect(isExcluded({ ownedByMe: false })).toBe(true)
	})

	it('should return true when URL contains _shared_by_', () => {
		expect(isExcluded({ url: '/remote.php/dav/calendars/owner/dps_shared_by_agent/' })).toBe(true)
	})

	it('should return true when URL contains app-generated--deck--', () => {
		expect(isExcluded({ url: '/remote.php/dav/calendars/owner/app-generated--deck--board-7/' })).toBe(true)
	})

	it('should return false for valid calendars', () => {
		expect(isExcluded({ ownedByMe: true, url: '/remote.php/dav/calendars/owner/personal-1/' })).toBe(false)
	})
})

describe('pickAreas', () => {
	it('should handle empty input', () => {
		expect(pickAreas([])).toEqual([])
	})

	it('should filter out excluded calendars and keep valid ones in AREA_NAMES order', () => {
		const calendars = [
			{ displayName: 'System', url: '/remote.php/dav/calendars/owner/system/', ownedByMe: true },
			{ displayName: 'Personal', url: '/remote.php/dav/calendars/owner/personal-1/', ownedByMe: true },
			{ displayName: 'Farm Boy', url: '/remote.php/dav/calendars/owner/farm-boy/', ownedByMe: false },
			{ displayName: 'Van', url: '/remote.php/dav/calendars/owner/van/', ownedByMe: true },
		]
		expect(pickAreas(calendars)).toEqual([
			{ name: 'Personal', calendar: calendars[1] },
			{ name: 'Van', calendar: calendars[3] },
			{ name: 'System', calendar: calendars[0] },
		])
	})

	it('should keep the first occurrence when there are duplicates', () => {
		const calendars = [
			{ displayName: 'Personal', url: '/remote.php/dav/calendars/owner/personal-1/', ownedByMe: true },
			{ displayName: 'Personal', url: '/remote.php/dav/calendars/owner/personal-2/', ownedByMe: true },
		]
		expect(pickAreas(calendars)).toEqual([
			{ name: 'Personal', calendar: calendars[0] },
		])
	})

	it('should handle a calendar with displayName matching AREA_NAMES but excluded by URL', () => {
		const calendars = [
			{ displayName: 'DPS', url: '/remote.php/dav/calendars/owner/dps_shared_by_agent/', ownedByMe: true },
		]
		expect(pickAreas(calendars)).toEqual([])
	})

	it('should keep a calendar with displayName matching AREA_NAMES and valid URL', () => {
		const calendars = [
			{ displayName: 'The Channel', url: '/remote.php/dav/calendars/owner/3f2a9c10-uuid/', ownedByMe: true },
		]
		expect(pickAreas(calendars)).toEqual([
			{ name: 'The Channel', calendar: calendars[0] },
		])
	})

	it('should handle all area names in correct order with excluded items', () => {
		const calendars = [
			{ displayName: 'System', url: '/remote.php/dav/calendars/owner/system/', ownedByMe: true },
			{ displayName: 'Personal', url: '/remote.php/dav/calendars/owner/personal-1/', ownedByMe: true },
			{ displayName: 'DPS', url: '/remote.php/dav/calendars/owner/dps_shared_by_agent/', ownedByMe: true },
			{ displayName: 'Van', url: '/remote.php/dav/calendars/owner/van/', ownedByMe: true },
			{ displayName: 'Barnum', url: '/remote.php/dav/calendars/owner/barnum/', ownedByMe: true },
		]
		expect(pickAreas(calendars)).toEqual([
			{ name: 'Personal', calendar: calendars[1] },
			{ name: 'Van', calendar: calendars[3] },
			{ name: 'Barnum', calendar: calendars[4] },
			{ name: 'System', calendar: calendars[0] },
		])
	})
})
