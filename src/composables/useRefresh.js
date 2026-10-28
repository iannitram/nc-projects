/**
 * Refresh on window focus and every ~2 minutes (P10).
 */
import { onBeforeUnmount } from 'vue'

export const REFRESH_INTERVAL_MS = 2 * 60 * 1000

/**
 * Call `refresh` when the window regains focus and every interval; stop on unmount.
 *
 * @param {() => Promise<void>} refresh the store's refresh action
 * @param {number} [intervalMs] the interval
 */
export function useRefresh(refresh, intervalMs = REFRESH_INTERVAL_MS) {
	const run = () => {
		Promise.resolve(refresh()).catch(() => {})
	}

	window.addEventListener('focus', run)
	const id = setInterval(run, intervalMs)

	onBeforeUnmount(() => {
		window.removeEventListener('focus', run)
		clearInterval(id)
	})
}
