#!/usr/bin/env node
/* eslint-disable no-console */
/* global Buffer, process */
/**
 * Check dav.js's three call shapes against the real `@nextcloud/cdav-library`
 * and the test Nextcloud container (#34):
 *
 *   1. fetchTodo: `calendar.find()` with a path relative to the calendar URL.
 *   2. createTodo: `calendar.createObject(name, headers, data)`.
 *   3. putTodo: a write with a stale etag is a plain HTTP 412. The library
 *      folds every HTTP error into a status -1 error, so dav.js re-reads the
 *      etag and throws `ConflictError`.
 *
 * The library wants a browser, so jsdom supplies DOMParser and the XPath
 * globals. jsdom's XPath lacks `namespace-uri()`; the two functions the library
 * needs are shimmed below.
 *
 * Usage: node scripts/check-dav-real.mjs
 * Base URL: NC_TEST_URL (default http://127.0.0.1:8089).
 * Only the created task is written; it is deleted at the end.
 */
import { JSDOM } from 'jsdom'

const BASE_URL = process.env.NC_TEST_URL ?? 'http://127.0.0.1:8089'
const USER = 'owner'
const PASSWORD = 'owner-test-only'
const LIST_URI = 'area-a-1'
const EXISTING_FILE = 'f-mix-old.ics'

function installDom() {
	const dom = new JSDOM('', { url: BASE_URL })
	const { Document } = dom.window
	const originalEvaluate = Document.prototype.evaluate
	Document.prototype.evaluate = function(expression, contextNode, resolver, type, result) {
		if (expression === 'namespace-uri(.)') {
			return { stringValue: contextNode.namespaceURI ?? '' }
		}
		if (expression === 'local-name(.)') {
			return { stringValue: contextNode.localName ?? '' }
		}
		return originalEvaluate.call(this, expression, contextNode, resolver, type, result)
	}
	globalThis.window = dom.window
	globalThis.document = dom.window.document
	globalThis.DOMParser = dom.window.DOMParser
	globalThis.XMLSerializer = dom.window.XMLSerializer
	globalThis.XPathResult = dom.window.XPathResult
	globalThis.localStorage = dom.window.localStorage
}

function ics(uid, summary, modified) {
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//cc-projects//check-dav-real//EN',
		'BEGIN:VTODO',
		`UID:${uid}`,
		`DTSTAMP:${modified}`,
		`CREATED:${modified}`,
		`LAST-MODIFIED:${modified}`,
		`SUMMARY:${summary}`,
		'END:VTODO',
		'END:VCALENDAR',
		'',
	].join('\r\n')
}

function pass(name, detail) {
	console.log(`PASS ${name}${detail ? `: ${detail}` : ''}`)
}

function fail(name, error) {
	const message = error instanceof Error ? error.message : String(error)
	console.log(`FAIL ${name}: ${message}`)
}

installDom()

const { default: DavClient } = await import('@nextcloud/cdav-library')
const { createTodo, fetchTodo, putTodo } = await import('../src/services/dav.js')

const authorization = `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`
const client = new DavClient({
	rootUrl: `${BASE_URL}/remote.php/dav`,
	defaultHeaders: { Authorization: authorization },
})
await client.connect({ enableCalDAV: true })
const grouped = await Promise.all(client.calendarHomes.map((home) => home.findAllCalDAVCollectionsGrouped()))
const calendars = grouped.flatMap((collections) => collections.calendars)
const calendar = calendars.find((candidate) => candidate.url.endsWith(`/${LIST_URI}/`))
if (!calendar) {
	throw new Error(`No fixture list ${LIST_URI} on ${BASE_URL}`)
}

const session = {
	client: async () => client,
	calendars: async () => calendars,
	reset() {},
}

let createdUrl
let failures = 0

try {
	const existingUrl = calendar.url + EXISTING_FILE
	try {
		const todo = await fetchTodo(existingUrl, session)
		if (!todo.ics.includes('UID:mix-old')) {
			throw new Error(`read ${todo.url} but its UID is not mix-old`)
		}
		if (!todo.etag) {
			throw new Error('read returned no etag')
		}
		pass('fetchTodo find(relative path)', `read ${existingUrl}`)
	} catch (error) {
		failures++
		fail('fetchTodo find(relative path)', error)
	}

	const uid = `check-dav-real-${Date.now()}`
	try {
		const created = await createTodo(calendar, ics(uid, 'check-dav-real', '20261028T120000Z'), session)
		createdUrl = created.url
		if (!created.ics.includes(`UID:${uid}`)) {
			throw new Error('created object did not read back its UID')
		}
		if (!created.url.startsWith(calendar.url) || !created.url.endsWith('.ics')) {
			throw new Error(`created object has an unexpected URL ${created.url}`)
		}
		pass('createTodo createObject(name, headers, data)', `created ${created.url}`)
	} catch (error) {
		failures++
		fail('createTodo createObject(name, headers, data)', error)
	}

	if (createdUrl) {
		try {
			const first = await fetchTodo(createdUrl, session)
			const changed = ics(uid, 'check-dav-real changed', '20261028T120100Z')
			const updated = await putTodo(createdUrl, changed, first.etag, session)
			if (!updated.etag || updated.etag === first.etag) {
				throw new Error('a correct write did not change the etag')
			}

			const staleIcs = ics(uid, 'check-dav-real stale', '20261028T120200Z')
			const stale = await calendar.find(createdUrl.slice(calendar.url.length))
			stale.data = staleIcs
			stale.etag = first.etag
			let libraryError
			try {
				await stale.update()
			} catch (error) {
				libraryError = error
			}
			if (!libraryError) {
				throw new Error('stale library update unexpectedly succeeded')
			}
			if (libraryError.status !== -1 && libraryError.status !== 412) {
				throw new Error(`stale library update gave status ${libraryError.status}, expected -1 or 412`)
			}

			const raw = await fetch(`${BASE_URL}${createdUrl}`, {
				method: 'PUT',
				headers: {
					Authorization: authorization,
					'Content-Type': 'text/calendar; charset=utf-8',
					'If-Match': first.etag,
				},
				body: staleIcs,
			})
			if (raw.status !== 412) {
				throw new Error(`stale HTTP write gave ${raw.status}, expected 412`)
			}

			let conflict
			try {
				await putTodo(createdUrl, ics(uid, 'check-dav-real stale 2', '20261028T120300Z'), first.etag, session)
			} catch (error) {
				conflict = error
			}
			if (conflict?.name !== 'ConflictError') {
				throw new Error(`stale putTodo threw ${conflict?.name ?? 'nothing'}, expected ConflictError`)
			}
			pass('putTodo stale etag', `HTTP 412, library status ${libraryError.status}, ConflictError thrown`)
		} catch (error) {
			failures++
			fail('putTodo stale etag', error)
		}
	} else {
		failures++
		fail('putTodo stale etag', new Error('no created task to write to'))
	}
} finally {
	if (createdUrl) {
		try {
			const todo = await calendar.find(createdUrl.slice(calendar.url.length))
			await todo.delete()
			console.log(`cleaned up ${createdUrl}`)
		} catch (error) {
			failures++
			fail('cleanup', error)
		}
	}
}

process.exit(failures === 0 ? 0 : 1)
