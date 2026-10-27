/**
 * Refresh on window focus and every ~2 minutes (P10). Stub.
 */
import { notImplemented } from '../notImplemented.js'

export const REFRESH_INTERVAL_MS = 2 * 60 * 1000

/**
 * Call `refresh` when the window regains focus and every interval; stop on unmount.
 *
 * @param {Function} refresh the store's refresh action
 * @param {number} [intervalMs] the interval
 */
export function useRefresh(refresh, intervalMs = REFRESH_INTERVAL_MS) {
	notImplemented('useRefresh', refresh, intervalMs)
}
