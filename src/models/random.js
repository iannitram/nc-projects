/**
 * Creates a mulberry32 random number generator with the given seed.
 *
 * @param {number} seed - The seed for the random number generator
 * @return {() => number} A function that returns random numbers in [0, 1)
 */
export function mulberry32(seed) {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6D2B79F5) >>> 0
		let t = state
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/**
 * Picks a weighted item from a pool using the provided random function.
 *
 * @param {Array<{uid: string, weight: number}>} pool - The pool of items to pick from
 * @param {() => number} random - The random number generator to use (defaults to Math.random)
 * @return {string|null} The uid of the picked item, or null if no valid items
 */
export function pickWeighted(pool, random = Math.random) {
	const slices = pool.filter((item) => item.weight > 0)
	if (slices.length === 0) {
		return null
	}

	let total = 0
	for (const slice of slices) {
		total += slice.weight
	}
	if (total === 0) {
		return null
	}

	const r = random() * total
	let accumulated = 0

	for (const slice of slices) {
		if (r < accumulated + slice.weight) {
			return slice.uid
		}
		accumulated += slice.weight
	}

	// Return the last slice if we're past all weights (shouldn't happen with proper total calculation)
	return slices[slices.length - 1].uid
}
