import { describe, expect, it } from 'vitest'
import { mulberry32, pickWeighted } from '../../src/models/random.js'

const POOL = Object.freeze([
	Object.freeze({ uid: 'a', weight: 10 }),
	Object.freeze({ uid: 'b', weight: 5 }),
	Object.freeze({ uid: 'c', weight: 5 }),
])
const fixed = (value) => () => value

describe('mulberry32', () => {
	it('gives the same numbers for the same seed', () => {
		const random = mulberry32(42)

		expect([random(), random(), random()]).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099])
		expect(mulberry32(0)()).toBe(0.26642920868471265)
	})

	it('gives numbers in [0, 1), and different seeds differ', () => {
		const random = mulberry32(7)
		const values = Array.from({ length: 1000 }, () => random())

		expect(values.every((value) => value >= 0 && value < 1)).toBe(true)
		expect(mulberry32(1)()).not.toBe(mulberry32(2)())
	})
})

describe('pickWeighted', () => {
	it('walks the slices in order: each takes its share of [0, total)', () => {
		expect(pickWeighted(POOL, fixed(0))).toBe('a')
		expect(pickWeighted(POOL, fixed(0.49))).toBe('a')
		expect(pickWeighted(POOL, fixed(0.5))).toBe('b')
		expect(pickWeighted(POOL, fixed(0.74))).toBe('b')
		expect(pickWeighted(POOL, fixed(0.75))).toBe('c')
		expect(pickWeighted(POOL, fixed(0.9999))).toBe('c')
	})

	it('follows the weights with a fixed seed', () => {
		const random = mulberry32(7)
		const counts = { a: 0, b: 0, c: 0 }
		for (let i = 0; i < 10000; i++) {
			counts[pickWeighted(POOL, random)]++
		}

		expect(counts).toEqual({ a: 4997, b: 2586, c: 2417 })
	})

	it('gives the same picks for the same seed', () => {
		const random = mulberry32(2026)

		expect([1, 2, 3, 4, 5].map(() => pickWeighted(POOL, random))).toEqual(['a', 'a', 'b', 'b', 'a'])
	})

	it('never picks a slice of weight 0 or less', () => {
		const pool = [{ uid: 'zero', weight: 0 }, { uid: 'x', weight: 1 }, { uid: 'minus', weight: -3 }]

		expect(pickWeighted(pool, fixed(0))).toBe('x')
		expect(pickWeighted(pool, fixed(0.9999))).toBe('x')
	})

	it('gives null for an empty wheel or one with no weight', () => {
		expect(pickWeighted([], fixed(0.5))).toBeNull()
		expect(pickWeighted([{ uid: 'zero', weight: 0 }], fixed(0.5))).toBeNull()
	})

	it('uses Math.random when no source is given', () => {
		expect(['a', 'b', 'c']).toContain(pickWeighted(POOL))
	})

	it('calls the random source once per pick', () => {
		let calls = 0
		pickWeighted(POOL, () => {
			calls++
			return 0.3
		})

		expect(calls).toBe(1)
	})
})
