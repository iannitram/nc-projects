/**
 * Placeholder thrown by skeleton stubs until their roadmap issue lands.
 * Passing the arguments keeps them "used" for lint.
 *
 * @param {string} name the stub's name, for the message
 * @param {...*} args the stub's arguments (ignored)
 * @return {never}
 */
export function notImplemented(name, ...args) {
	throw new Error(`${name} is not implemented yet (${args.length} args); see ROADMAP.md`)
}
