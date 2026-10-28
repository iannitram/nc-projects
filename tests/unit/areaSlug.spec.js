import { describe, expect, it } from 'vitest'
import { areaId, areaSlug } from '../../src/models/tree.js'

describe('areaSlug and areaId', () => {
	it('lowercases and hyphenates', () => {
		expect(areaSlug('  Home & Garden ')).toBe('home-garden')
		expect(areaId('  Home & Garden ')).toBe('area-home-garden')
	})

	it('keeps names that differ only by accents distinct', () => {
		expect(areaSlug('Café')).not.toBe(areaSlug('Cafe'))
		expect(areaId('Café')).not.toBe(areaId('Cafe'))
	})

	it('keeps non-Latin names usable', () => {
		expect(areaSlug('家庭')).toBe('家庭')
		expect(areaId('家庭')).toBe('area-家庭')
	})

	it('NFC and NFD forms of the same name give the same id', () => {
		const nfc = 'Café'
		const nfd = 'Cafe\u0301' // 'e' + combining acute accent
		expect(nfc).not.toBe(nfd)
		expect(areaSlug(nfc)).toBe(areaSlug(nfd))
		expect(areaId(nfc)).toBe(areaId(nfd))
		expect(areaId(nfc)).toBe('area-café')
	})

	it('keeps names with combining marks distinct', () => {
		// Devanagari "किम" (ki-m) and "कोम" (ko-m)
		expect(areaSlug('किम')).toBe('किम')
		expect(areaSlug('कोम')).toBe('कोम')
		expect(areaSlug('किम')).not.toBe(areaSlug('कोम'))
		expect(areaId('किम')).not.toBe(areaId('कोम'))
		expect(areaId('किम')).toBe('area-किम')
		expect(areaId('कोम')).toBe('area-कोम')
	})

	it('falls back to index for an emoji-only name', () => {
		expect(areaSlug('🏠', 1)).toBe('1')
		expect(areaId('🏠', 1)).toBe('area-1')
	})

	it('falls back to index for an empty name', () => {
		expect(areaSlug('', 0)).toBe('0')
		expect(areaId('', 0)).toBe('area-0')
	})

	it('falls back to index for an all-symbol name', () => {
		expect(areaSlug('!!!', 0)).toBe('0')
		expect(areaId('!!!', 0)).toBe('area-0')
	})

	it('gives non-empty and distinct ids for symbol and emoji names next to each other', () => {
		const unusualAreas = ['!!!', '🏠', '💼']
		const ids = unusualAreas.map((name, index) => areaId(name, index, unusualAreas))
		expect(ids).toEqual(['area-0', 'area-1', 'area-2'])
		expect(new Set(ids).size).toBe(3)
	})

	it('gives distinct ids when two different areas normalise to the same base slug', () => {
		const areas = ['Home/Garden', 'Home & Garden']
		const id0 = areaId(areas[0], 0, areas)
		const id1 = areaId(areas[1], 1, areas)
		expect(id0).toBe('area-home-garden')
		expect(id1).toBe('area-home-garden-2')
		expect(id0).not.toBe(id1)
	})
})
