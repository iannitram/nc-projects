import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// #141: @nextcloud/dialogs 7 toasts use CSS-module classes whose rules ship in
// '@nextcloud/dialogs/style.css'. Without that import every toast renders as bare text.
describe('main.js loads the toast styles (#141)', () => {
	it('imports @nextcloud/dialogs/style.css', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8')
		expect(source).toMatch(/^import '@nextcloud\/dialogs\/style\.css'$/m)
	})
})
