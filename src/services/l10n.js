/**
 * Plurals, shaped like n() from @nextcloud/l10n without the app id, so it can be swapped
 * for the real one when the app gets translations. English rule: 1 is singular.
 *
 * @param {string} singular the text for one, with %n for the count
 * @param {string} plural the text for any other count, with %n for the count
 * @param {number} count the count
 * @return {string} the text with the count filled in
 */
export function n(singular, plural, count) {
	return (count === 1 ? singular : plural).replaceAll('%n', String(count))
}
