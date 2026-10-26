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
| `src/services/areas.js` | Which calendars are areas: the 8 display names, plus the exclusions (lists shared by other people, today Farm Boy; `*_shared_by_*`, `app-generated--deck--*`) | P02 |
| `src/models/Task.js` | `ical.js` wrapper for one VTODO: typed getters and setters for the fields the app uses; **keeps every other property and parameter untouched on write** | P03 |
| `src/models/tree.js` | Pure function: tasks → areas → projects → task tree (follows RELATED-TO across lists, max depth 3, with a count of what lies deeper for "+N deeper"; progress counts every descendant). Also returns orphans and untagged parents for the tray | P04, P15 |
| `src/models/sortOrder.js` | Pure order math: place a task between two neighbours, renumber a project when gaps run out, the unordered-at-bottom (newest last) rule. Matches Tasks' own convention (P00(a)) | P08, P09 |
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
| `src/composables/useDrag.js` | `sortablejs` wiring: drag handles, long-press on touch, drop → store action | P08, P09, P11, P12 |
| `src/composables/useRefresh.js` | Refresh on window focus and every ~2 min | P10 |
| `src/styles/` | Layout, including the phone breakpoint | P11 |

### Tests and tooling

| Path | Job |
|---|---|
| `tests/unit/Task.spec.js` | Round-trip: parse → change one field → serialize keeps everything else byte-equivalent (incl. `X-CC-*`, bare RELATED-TO) |
| `tests/unit/tree.spec.js` | Cross-list children, depth 3, orphans, untagged parents, Deck, agent queues and shared lists excluded |
| `tests/unit/sortOrder.spec.js` | Insert between, renumber, unordered at bottom newest last |
| `tests/fixtures/*.ics` | Sample VTODOs shaped like the real data (copied shapes, no personal content); must cover the fixture table in SPEC.md |
| `package.json`, `vite.config.js` | Build with `@nextcloud/vite-config`; test with Vitest |
| `scripts/dav-get.sh` | Print one stored task's raw iCalendar from the **test** container (CalDAV GET), for the spec's "read the stored task" checks |
| `scripts/deploy-test.sh` | Build and copy into the **test** container, then `occ app:enable cc_projects` there |
| `.gitignore` | `node_modules/`, `vendor/`, `js/` build output |

Live install (copy into the live `custom_apps/cc_projects` + `occ app:enable cc_projects`) has no script on purpose: it happens by hand, on Ian's yes, every time.

## Rules the code keeps

1. **Round-trip what you don't own.** Never drop or rewrite a property or parameter the app doesn't edit. Agents rely on `X-CC-*`, `X-FORK-*` and their own RELATED-TO shape.
2. **Write bare `RELATED-TO:<uid>`** (PARENT by default), as `nc_helpers` does. Never add `RELTYPE`.
3. **Every write is If-Match.** A 412 means someone else changed it: reload, never retry blind.
4. **Areas by display name, never URI segment.**
5. **Exclusions are fixed:** lists shared by other people (today Farm Boy), agent queues (`*_shared_by_*`), Deck boards (`app-generated--deck--*`).
6. **Touch the order field only on what moved,** except when a project's gaps run out and it must be renumbered once.
7. **No data on the server side.** If a feature seems to need a PHP endpoint, stop and ask.

## Facts (fill in at P00)

| Question | Answer | Source |
|---|---|---|
| How Tasks 0.18.1 writes `X-APPLE-SORT-ORDER` | *(open)* | |
| Tasks deep-link URL for one task | *(open)* | |
| `cdav-library` MOVE support | Yes. `VObject.move(calendar, overwrite=false, headers={})` sends MOVE with `Overwrite: F`; `headers` carries `If-Match`. Keeps the file name; refuses same list, other collection type, read-only target. Updates `url` but not `etag`, so re-read after | `@nextcloud/cdav-library` 2.6.2 `dist/index.mjs` (DavObject.move), checked 2026-10-26 |
| Test container recipe | *(open)* | |

Known on 2026-10-23 (installed Tasks 0.18.1 on Hyperion): it ships `@nextcloud/vue` 9.8.2 (Vue 3), `@nextcloud/cdav-library` 2.6.2, `ical.js` 2.2.1, `sortablejs` 1.15.6, `vuex` 4.1.0, and supports Nextcloud 31–35. The live server is 33.0.10. We use Pinia rather than Vuex: it is the current Vue 3 default and the store is small.
