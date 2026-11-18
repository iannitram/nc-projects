import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// tools/package.mjs refuses to package when info.xml and package.json disagree on the version (nc-projects#196).
// It does that before it calls git, so the check runs in a throwaway folder with no repository.
function run(infoVersion, packageVersion) {
	const root = mkdtempSync(join(tmpdir(), 'ccp-package-'))
	try {
		mkdirSync(join(root, 'tools'))
		mkdirSync(join(root, 'appinfo'))
		cpSync(resolve(process.cwd(), 'tools/package.mjs'), join(root, 'tools/package.mjs'))
		writeFileSync(join(root, 'appinfo/info.xml'), `<info><version>${infoVersion}</version></info>`)
		writeFileSync(join(root, 'package.json'), JSON.stringify({ version: packageVersion }))
		try {
			execFileSync(process.execPath, [join(root, 'tools/package.mjs')], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
			return { code: 0, stderr: '' }
		} catch (e) {
			return { code: e.status, stderr: String(e.stderr) }
		}
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
}

describe('tools/package.mjs', () => {
	it('refuses when info.xml and package.json disagree on the version', () => {
		const r = run('0.2.0', '0.1.0')
		expect(r.code).toBe(1)
		expect(r.stderr).toContain('appinfo/info.xml says 0.2.0 but package.json says 0.1.0')
	})
	it('does not stop on the version when they agree (it goes on to the git checks)', () => {
		const r = run('0.1.0', '0.1.0')
		expect(r.stderr).not.toContain('says')
	})
})
