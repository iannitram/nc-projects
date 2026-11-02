/**
 * Append a note to a task description.
 *
 * @param {string|null} description the current description, or null
 * @param {string|undefined} note the note to append, or undefined
 * @param {string} day the date in YYYY-MM-DD format
 * @return {string|null} the new description, or null if note was empty and description was null
 */
export function appendNote(description, note, day) {
	// Trim the note
	const text = (note ?? '').trim()
	if (text === '') {
		// Return description unchanged if note is blank
		return description
	}

	// Create the line to add
	const line = '- ' + day + ' ' + text

	// Trim trailing whitespace from the description
	const kept = (description ?? '').trimEnd()

	// If description is empty, just return the line
	if (kept === '') {
		return line
	}

	// Otherwise append the line to the description
	return kept + '\n' + line
}
