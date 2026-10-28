import { describe, expect, it } from 'vitest'
import { areaSlug } from '../../src/models/tree.js'

describe('areaSlug', () => {
	it('lowercases and hyphenates', () => {
		expect(areaSlug('  Home & Garden ')).toBe('home-garden')
	})

	it('keeps names that differ only by accents distinct', () => {
		expect(areaSlug('Café')).not.toBe(areaSlug('Cafe'))
	})

	it('keeps non-Latin names usable', () => {
		expect(areaSlug('家庭')).toBe('家庭')
	})
})
