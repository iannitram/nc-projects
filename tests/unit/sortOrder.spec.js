import { describe, expect, it } from 'vitest'
import { effectiveSortOrder, placeMoved } from '../../src/models/sortOrder.js'

describe('sortOrder', () => {
	describe('effectiveSortOrder', () => {
		it('should return task.sortOrder when it is a number', () => {
			const task = { sortOrder: 42, created: null }
			expect(effectiveSortOrder(task)).toBe(42)
		})

		it('should calculate from created timestamp when sortOrder is not a number', () => {
			const task = { sortOrder: null, created: new Date('2001-01-01T00:01:40Z') }
			expect(effectiveSortOrder(task)).toBe(100)
		})

		it('should return 0 when neither sortOrder nor created is set', () => {
			const task = { sortOrder: null, created: null }
			expect(effectiveSortOrder(task)).toBe(0)
		})
	})

	describe('placeMoved', () => {
		// Test case 1: [a:10, b:20, c:30], move c to index 1 -> [{uid:'c', sortOrder:19}]
		it('should handle basic move with bumping', () => {
			const siblings = [
				{ uid: 'a', sortOrder: 10 },
				{ uid: 'b', sortOrder: 20 },
				{ uid: 'c', sortOrder: 30 },
			]
			const result = placeMoved(siblings, 'c', 1)
			expect(result).toEqual([{ uid: 'c', sortOrder: 19 }])
		})

		// Test case 2: [a:10, b:11, c:12], move c to index 1 -> new order a, c, b; next b - 1 = 10 is not above prev a (10), so c = 10 + 1 = 11; then b (11) <= 11 is bumped to 12
		it('should handle move with multiple bumps', () => {
			const siblings = [
				{ uid: 'a', sortOrder: 10 },
				{ uid: 'b', sortOrder: 11 },
				{ uid: 'c', sortOrder: 12 },
			]
			const result = placeMoved(siblings, 'c', 1)
			expect(result).toEqual([
				{ uid: 'c', sortOrder: 11 },
				{ uid: 'b', sortOrder: 12 },
			])
		})

		// Test case 3: [a:5, b:6], move b to index 0 -> no prev, next a - 1 = 4 -> [{uid:'b', sortOrder:4}]
		it('should handle move with no previous element', () => {
			const siblings = [
				{ uid: 'a', sortOrder: 5 },
				{ uid: 'b', sortOrder: 6 },
			]
			const result = placeMoved(siblings, 'b', 0)
			expect(result).toEqual([{ uid: 'b', sortOrder: 4 }])
		})

		// Test case 4: [a:0, b:1], move b to index 0 -> next a - 1 = -1, floored to 0; then a (0) <= 0 is bumped to 1
		it('should handle move with floor at zero', () => {
			const siblings = [
				{ uid: 'a', sortOrder: 0 },
				{ uid: 'b', sortOrder: 1 },
			]
			const result = placeMoved(siblings, 'b', 0)
			expect(result).toEqual([
				{ uid: 'b', sortOrder: 0 },
				{ uid: 'a', sortOrder: 1 },
			])
		})

		// Test case for single sibling - this was failing before the fix
		it('should handle move with single sibling (no neighbors)', () => {
			const siblings = [
				{ uid: 'a', sortOrder: 5 },
			]
			const result = placeMoved(siblings, 'a', 0)
			expect(result).toEqual([{ uid: 'a', sortOrder: 5 }])
		})
	})
})
