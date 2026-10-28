import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const css = readFileSync(resolve(root, 'src/styles/projects.css'), 'utf8')

/**
 * @param {string} dir the folder to walk
 * @return {string[]} every file under it
 */
function filesUnder(dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name)
		return statSync(path).isDirectory() ? filesUnder(path) : [path]
	})
}

describe('shared measurements with nc-outliner (issue 126)', () => {
	it.each([
		['--cc-top-bar-height', '52px'],
		['--cc-status-height', '30px'],
		['--cc-status-font-size', '12.5px'],
		['--cc-column-max-width', '820px'],
		['--cc-row-height', '34px'],
		['--cc-hover-reveal', 'opacity 0.15s'],
	])('sets %s to %s on the column', (name, value) => {
		const column = css.match(/\n\.cc-column \{[^}]*\}/)[0]
		expect(column).toContain(`${name}: ${value};`)
	})

	it('has no hard-coded colour outside a var() fallback', () => {
		const offenders = filesUnder(resolve(root, 'src'))
			.flatMap((file) => readFileSync(file, 'utf8').split('\n').map((line, index) => ({ file, line, index })))
			.filter(({ line }) => /#[0-9a-fA-F]{3,6}/.test(line) && !/var\(--[\w-]+,\s*#[0-9a-fA-F]{3,6}\)/.test(line))
		expect(offenders).toEqual([])
	})
})
