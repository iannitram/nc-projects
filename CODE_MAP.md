# Code map

**Planned layout.** No code exists yet. When a file lands, fix its row here in the same PR: what a file actually does wins over this plan. Feature IDs are from [ROADMAP.md](ROADMAP.md).

## Shape in one picture

```
Browser (Ian's session)
  App.vue
   └─ AreaSection ×8 ─ ProjectCard ─ TaskTree ─ TaskRow
          ▲                 ▲  (drag: useDrag → sortOrder.js)
          │ reads            │ writes (If-Match)
     store/projects.js  ◄── services/dav.js ── CalDAV (/remote.php/dav) ── same VTODOs the Tasks app and agents use
          ▲
     models/tree.js ◄── models/Task.js (ical.js)
Server (PHP): serves the page only. No data endpoints.
```

## Files

### Nextcloud app shell (PHP; P01)

| Path | Job |
|---|---|
| `appinfo/info.xml` | App id `cc_projects`, name "Projects", nav entry, Nextcloud 33–35 |
| `appinfo/routes.php` | One route: the page |
| `lib/AppInfo/Application.php` | App bootstrap |
| `lib/Controller/PageController.php` | Renders `templates/main.php`. Nothing else: no data API |
| `templates/main.php` | Mount point; loads the built JS and CSS |
| `img/app.svg`, `img/app-dark.svg` | Nav icon |

### Data layer (JS)

| Path | Job | IDs |
|---|---|---|
| `src/services/dav.js` | `@nextcloud/cdav-library` client: discover calendars, REPORT VTODOs, PUT with If-Match, MOVE between calendars (with If-Match; re-read after, since the etag is stale) | P02, P07, P10, P12 |
| `src/services/areas.js` | Which calendars are areas: only lists that hold tasks (VTODO), then the 8 display names, plus the exclusions (lists shared by other people, today Farm Boy; `*_shared_by_*`, `app-generated--deck--*`) | P02 |
| `src/models/Task.js` | `ical.js` wrapper for one VTODO: typed getters and setters for the fields the app uses; **keeps every other property and parameter untouched on write** | P03 |
| `src/models/tree.js` | Pure function: tasks → areas → projects → task tree (follows RELATED-TO across lists, max depth 3, with a count of what lies deeper for "+N deeper"; progress counts every descendant). Also returns orphans and untagged parents for the tray | P04, P15 |
| `src/models/sortOrder.js` | Pure order math, a copy of Tasks' rule (§Facts): effective order, place a moved task at neighbour ±1, bump later colliding siblings | P08, P09 |
| `src/store/projects.js` | Pinia store: load, refresh by etag/ctag, optimistic updates with rollback, 412 handling | P05, P10 |

### UI (Vue 3 + `@nextcloud/vue`)

| Path | Job | IDs |
|---|---|---|
| `src/main.js` | Creates the app, installs Pinia, mounts on `#content` | P01 |
| `src/App.vue` | `NcContent` / `NcAppContent` shell; renders the areas | P01, P05 |
| `src/components/AreaSection.vue` | One area: its project cards, the Done strip, "+ New project" (phase 2) | P05, P06, P14 |
| `src/components/ProjectCard.vue` | Project header (title, badges, progress bar, show-done toggle, "+ Add task") and its task tree | P05, P06, P07 |
| `src/components/TaskTree.vue` | Collapsible nested list of TaskRows, three levels, then a "+N deeper" note; drop zone for reorder and re-parent | P05, P08, P12 |
| `src/components/TaskRow.vue` | One task: checkbox, title, due, priority; inline edits (phase 2); "open in Tasks" link, also used by "+N deeper" | P05, P13 |
| `src/components/AddTaskInput.vue` | Inline new-task field under a project | P07 |
| `src/components/DoneStrip.vue` | Collapsed list of completed projects in an area | P06 |
| `src/components/NeedsFilingTray.vue` | Orphans and untagged parents with fix buttons | P15 |
| `src/composables/useDrag.js` | `sortablejs-vue3` wiring (Tasks' options: `delay: 500, delayOnTouchOnly: true, touchStartThreshold: 3`): drag handles, long-press on touch, drop → store action | P08, P09, P11, P12 |
| `src/composables/useRefresh.js` | Refresh on window focus and every ~2 min | P10 |
| `src/styles/` | Layout, including the phone breakpoint | P11 |

### Tests and tooling

| Path | Job |
|---|---|
| `tests/unit/Task.spec.js` | Round-trip: parse → change one field → serialize keeps everything else byte-equivalent (incl. `X-CC-*`, bare RELATED-TO) |
| `tests/unit/tree.spec.js` | Cross-list children, depth 3, orphans, untagged parents, Deck, agent queues and shared lists excluded |
| `tests/unit/sortOrder.spec.js` | Same results as Tasks' `adjustSortOrder` on the same inputs: insert between, bump, default from CREATED |
| `tests/fixtures/*.ics` | Sample VTODOs shaped like the real data (copied shapes, no personal content); must cover the fixture table in SPEC.md |
| `package.json`, `vite.config.js` | Build with `@nextcloud/vite-config`; test with Vitest |
| `scripts/fetch-tasks-ref.sh` | Shallow-clone Nextcloud Tasks (default v0.18.1) into git-ignored `reference/tasks` for reading |
| `scripts/dav-get.sh` | Print one stored task's raw iCalendar from the **test** container (CalDAV GET), for the spec's "read the stored task" checks |
| `test-env/` | The test container: `compose.yaml`, `setup.sh`, `reset.sh`, `seed.py` (fixture lists and tasks) |
| `scripts/deploy-test.sh` | Build and copy into the **test** container, then `occ app:enable cc_projects` there |
| `.gitignore` | `node_modules/`, `vendor/`, `js/` build output |

Live install (copy into the live `custom_apps/cc_projects` + `occ app:enable cc_projects`) has no script on purpose: it happens by hand, on Ian's yes, every time.

## Rules the code keeps

1. **Round-trip what you don't own.** Never drop or rewrite a property or parameter the app doesn't edit. Agents rely on `X-CC-*`, `X-FORK-*` and their own RELATED-TO shape.
2. **Write bare `RELATED-TO:<uid>`** (PARENT by default), as `nc_helpers` does. Never add `RELTYPE`.
3. **Every write is If-Match.** A 412 means someone else changed it: reload, never retry blind.
4. **Areas by display name, never URI segment.**
5. **Exclusions are fixed:** lists shared by other people (today Farm Boy), agent queues (`*_shared_by_*`), Deck boards (`app-generated--deck--*`).
6. **Order like Tasks does:** write the moved task, plus only the later siblings Tasks' rule bumps. Never renumber a whole project.
7. **No data on the server side.** If a feature seems to need a PHP endpoint, stop and ask.

## Facts (fill in at P00)

| Question | Answer | Source |
|---|---|---|
| How Tasks 0.18.1 writes `X-APPLE-SORT-ORDER` | Integer, ascending (lower first). Missing → effective value = seconds from 2001-01-01T00:00 to CREATED (0 if no CREATED); nothing is written until a drag. Drag: moved task = next sibling − 1 if that is above the previous sibling, else previous + 1, floor 0; then each later sibling whose value is ≤ the one before is set to that + 1 (a bump, written). Ties keep load order. Manual sort ignores pinned and completion | `src/models/task.js` 163-167, 807-822, 901-918; `src/components/TaskDragContainer.vue` 95-157; `src/store/storeHelper.js` 228-286, 452 (tag v0.18.1) |
| Tasks deep-link URL for one task | `<generateUrl('apps/tasks')>/calendars/<calendar URI segment>/tasks/<task file name incl. .ics>` (history routing, no `#`). Without the calendar: `/apps/tasks/collections/all/tasks/<file>.ics`. Don't copy the stale `/#/` form in `TaskCreateDialog.vue` | `src/views/Dashboard.vue` 205; `src/router.js` 33-93; `src/store/tasks.js` 159-171 |
| `cdav-library` MOVE support | Yes. `VObject.move(calendar, overwrite=false, headers={})` sends MOVE with `Overwrite: F`; `headers` carries `If-Match`. Keeps the file name; refuses same list, other collection type, read-only target. Updates `url` but not `etag`, so re-read after | `@nextcloud/cdav-library` 2.6.2 `dist/index.mjs` (DavObject.move), checked 2026-10-26 |
| Test container recipe | `test-env/` (see its README): compose project `nc-projects-test`, Nextcloud 33.0.10 + Tasks 0.18.1, SQLite, `127.0.0.1:8089`; `setup.sh` installs, makes users `owner`/`other`/`agent`, seeds the fixture lists with `seed.py`. Verified 2026-10-26 in a cloud sandbox (Nextcloud, users, lists, shares, 78 tasks; Tasks and Deck install not reachable there): run once on Hyperion to confirm the Tasks and Deck steps | `test-env/` |

### How Tasks behaves (read from v0.18.1 source, 2026-10-26)

- **Saving:** PUT of the whole iCalendar with `If-Match` (cdav-library `update()`). A 412 marks a conflict; Tasks discards its own local edits on refresh. It has **no auto-refresh**, so expect its stale PUTs to hit 412.
- **Every edit** rewrites `LAST-MODIFIED` and `DTSTAMP`; `SEQUENCE` is never bumped. Use etags, not those, to detect change.
- **Completing:** sets `STATUS:COMPLETED`, `COMPLETED` (UTC now) and `PERCENT-COMPLETE:100`; reopening removes `COMPLETED`/`PERCENT-COMPLETE` and sets `NEEDS-ACTION`. Completing cascades to open subtasks; reopening a child reopens its parent. Always write `COMPLETED` with `STATUS:COMPLETED`: Tasks loads "open" tasks as those with no `COMPLETED` property.
- **Closed** = completed or `STATUS:CANCELLED`.
- **Parent link:** reads bare `RELATED-TO` or `RELTYPE=PARENT` (first match); writes bare; keeps CHILD/SIBLING entries.
- **Children on another list** show in Tasks as loose root tasks of their own list, and may or may not be cascaded by load order. Projects follows links across lists (ADR 0007); P12 moving a task to its project's list fixes Tasks' view.
- **Moving between lists:** subtasks first (loaded ones only; unloaded completed ones are left behind as orphans), then the task with `dav.move`; no etag refetch.
- **Creating:** `PRODID:-//Nextcloud Tasks v<version>`, random UUID UID, `CREATED`; no `X-APPLE-SORT-ORDER`; file name is a different random UUID + `.ics` (no `If-None-Match`).
- **Calendars:** `findAllCalDAVCollectionsGrouped()`, keep those with VTODO; shared-with-me = `calendar.owner !== currentUserPrincipal.url`; read-only = `!isWriteable()`; Deck lists are not filtered.
- **Show completed subtasks** is per task (`X-OC-HIDECOMPLETEDSUBTASKS`); Projects' "show done" does not write it (ADR 0019).
- **Shell to copy:** Vite via `@nextcloud/vite-config` `createAppConfig({ main: 'src/main.js' })`, Vue 3, vue-router history mode with a catch-all page route, `@nextcloud/vue` 9.8.2, `@nextcloud/eslint-config/vue3`, Vitest + happy-dom, Node 24; PageController passes initial state and renders a template that loads `<app>-main.js`.

Known on 2026-10-23 (installed Tasks 0.18.1 on Hyperion): it ships `@nextcloud/vue` 9.8.2 (Vue 3), `@nextcloud/cdav-library` 2.6.2, `ical.js` 2.2.1, `sortablejs` 1.15.6 (through `sortablejs-vue3`), `vuex` 4.1.0, and supports Nextcloud 31–35. The live server is 33.0.10. We use Pinia rather than Vuex: it is the current Vue 3 default and the store is small.
