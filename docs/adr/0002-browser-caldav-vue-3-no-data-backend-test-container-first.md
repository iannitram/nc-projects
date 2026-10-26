# 0002. Browser CalDAV, Vue 3, no data backend; test container first

- Status: accepted
- Date: 2026-10-23
- Grilling decisions: 16

## Context
Tasks itself talks CalDAV from the browser with Vue 3 and Nextcloud's component library.

## Decision
Use Vue 3 with `@nextcloud/vue`, `@nextcloud/cdav-library` and `ical.js` in the browser. The server side only serves the page. Develop against a test Nextcloud container; install on the live server only with the owner's yes, every time.

## Consequences
No PHP endpoints to secure or migrate. A feature that seems to need one is a stop-and-ask. Every check runs in the test container.
