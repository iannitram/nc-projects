/**
 * The page clock (`now`, `minute`, `today`), re-read every 30 s and on window focus;
 * `today` changing is the day-end rule (P19, P22).
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { dayKey } from '../models/day.js'

export const CLOCK_INTERVAL_MS = 30 * 1000

/**
 * Keep the current time for Today and the timeline, re-read every 30 seconds
 * and when the tab gets focus (P19, P22).
 *
 * @param {number} [intervalMs] the interval in milliseconds (default: CLOCK_INTERVAL_MS)
 * @return {{now: import('vue').Ref<Date>, minute: import('vue').ComputedRef<number>, today: import('vue').ComputedRef<string>}}
 */
export function useClock(intervalMs = CLOCK_INTERVAL_MS) {
	const now = ref(new Date())

	const tick = () => {
		now.value = new Date()
	}

	window.addEventListener('focus', tick)
	const id = setInterval(tick, intervalMs)

	onBeforeUnmount(() => {
		window.removeEventListener('focus', tick)
		clearInterval(id)
	})

	return {
		now,
		minute: computed(() => now.value.getHours() * 60 + now.value.getMinutes()),
		today: computed(() => dayKey(now.value)),
	}
}
