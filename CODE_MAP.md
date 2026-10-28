# Code map

Describes commit: eb3b328 (2026-10-28)

**Skeleton in place (2026-10-26), data layer and the panel merged since.** Every file below exists except those marked planned. The app shell, build files, models, `areas.js`, `dav.js` (all but `moveTodo`), the panel (`App.vue`, `AreaSection`, `ProjectCard`, `TaskTree`, `TaskRow`, `AddTaskInput`) and the store's `load`, `addTask`, `calendarOf` and `createProject` are **present**; the rest of the store, `useRefresh.js`, `useDrag.js`'s drop wiring and `DoneStrip.vue` are **stubs**: their exported names, signatures and JSDoc are the contract, and their bodies throw `notImplemented` (`src/notImplemented.js`) or render an empty element until their roadmap issue lands. When a file's code lands, fix its row here in the same PR: what a file actually does wins over this map. Feature IDs are from [ROADMAP.md](ROADMAP.md).

## Shape in one picture

```
Browser (the owner's session)
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
| `appinfo/routes.php` | One route: the page (`GET /`) |
| `lib/AppInfo/Application.php` | App bootstrap |
| `lib/Controller/PageController.php` | Renders `templates/main.php`. Nothing else: no data API |
| `templates/main.php` | Mount point `#cc_projects`; loads `js/cc_projects-main.mjs` and `css/cc_projects-style.css` |
| `img/app.svg`, `img/app-dark.svg` | Nav icon |

### Data layer (JS)

| Path | Job | IDs |
|---|---|---|
| `src/services/dav.js` | **Present** (`listTaskCalendars`, `fetchTodos`, `fetchTodo`, `putTodo`, `createTodo`, `ConflictError`); **stub**: `moveTodo` (P12). `@nextcloud/cdav-library` client, made per call (`getClient`) with `rootUrl: generateRemoteUrl('dav')` (an absolute URL, #49) and the request token from `@nextcloud/auth`: discover calendars, REPORT VTODOs, PUT with If-Match, create with a random-UUID file name, MOVE between calendars (with If-Match; re-read after, since the etag is stale). A 412 on a PUT or create throws `ConflictError`. Known: `createTodo` uses `crypto.randomUUID()`, which fails over plain HTTP (#53); one connection per page is #54 | P02, P07, P10, P12 |
| `src/services/areas.js` | **Present** (`AREA_NAMES`, `isExcluded`, `pickAreas`). Which calendars are areas: only lists that hold tasks (VTODO), then the 8 display names, plus the exclusions (lists shared by other people; `*_shared_by_*`, `app-generated--deck--*`) | P02 |
| `src/models/Task.js` | **Present.** `ical.js` wrapper for one VTODO (`Task.fromIcs`, `Task.create`, `toIcs`): typed getters and setters for the fields the app uses; **keeps every other property and parameter untouched on write** | P03 |
| `src/models/tree.js` | **Present** (`buildTree`). Pure function: tasks → areas → projects → task tree (follows RELATED-TO across lists, max depth 3, with a count of what lies deeper for "+N deeper"; progress counts every descendant). Also returns orphans and untagged parents for the tray | P04, P15 |
| `src/models/completion.js` | **Present** (`planCompletion`). Pure: which tasks a check-off or reopen changes, following Tasks' cascades (checking off closes the task and its open descendants breadth-first; reopening opens the task and its closed ancestors up to the first project). Changes no task | P06, P13 |
| `src/notImplemented.js` | The stubs' placeholder error; delete once nothing imports it (today `dav.js` for `moveTodo`, `store/projects.js`, `useRefresh.js`) | P01 |
| `src/models/sortOrder.js` | **Present** (`APPLE_EPOCH_MS`, `effectiveSortOrder`, `placeMoved`). Pure order math, a copy of Tasks' rule (§Facts): effective order, place a moved task at neighbour ±1, bump later colliding siblings. `CREATED` may be a `Date` or an `ICAL.Time` (also through a store proxy): it is turned into ms before the Apple-epoch maths (#50). Open: a `CREATED` with a TZID sorts an hour off (#68) | P08, P09 |
| `src/store/projects.js` | **Present**: state (`areas`, `orphans`, `untaggedParents`, `tasksByUid`, `ctags`, `loading`, `error`), `load` (a failure leaves a non-empty `error`, #49), `addTask` (P07: creates the task on the project's list with `parentUid`, rebuilds the tree, shows an error toast on failure and returns `null`), `calendarOf`, `createProject` (P14: `project` category on the area's list; rethrows after the toast). **Stubs**: `refresh`, `reorder`, `moveToProject`, `setCompleted`, `updateTask`, `makeProject`. Pinia store: load, refresh by etag/ctag, optimistic updates with rollback, 412 handling | P05, P07, P10, P14 |

### UI (Vue 3 + `@nextcloud/vue`)

| Path | Job | IDs |
|---|---|---|
| `src/main.js` | Creates the app, installs Pinia, mounts on `#cc_projects` | P01 |
| `src/App.vue` | `NcContent` / `NcAppContent` shell; calls the store's `load` on mount, shows a spinner, the error text, or one `AreaSection` per area. Does not call `useRefresh` yet (P10) | P01, P05 |
| `src/components/AreaSection.vue` | Present: one area with its project cards, rendered in order, and the "+ New project" field (Enter calls `store.createProject`, Esc clears) | P05, P14 |
| `src/components/ProjectCard.vue` | Present: project title, task tree and the `AddTaskInput` under it | P05, P07 |
| `src/components/TaskTree.vue` | Present: collapsible nested task list, three levels, then a "+N deeper" Tasks link | P05 |
| `src/components/TaskRow.vue` | Present: task completion checkbox (display only until `setCompleted` lands) and title; "+N deeper" Tasks link (built with `generateUrl`) when descendants exceed the rendered depth | P05 |
| `src/components/AddTaskInput.vue` | Present: inline "+ Add task" field under a project; Enter calls `store.addTask` (one submit at a time), Esc clears | P07 |
| `src/components/DoneStrip.vue` | **Stub** (empty element; not mounted anywhere yet). Collapsed list of completed projects in an area | P06 |
| `src/components/NeedsFilingTray.vue` | **Present** (not mounted anywhere yet): orphans and untagged parents in two lists with counts; each item has a "Make project" button that calls `store.makeProject`; hidden when both lists are empty | P15 |
| `src/composables/useDrag.js` | **Stub** (`DRAG_OPTIONS` present, with `handle: '.drag-handle'`; the drop wiring is not, and no component uses it yet). `sortablejs-vue3` wiring (Tasks' options: `delay: 500, delayOnTouchOnly: true, touchStartThreshold: 3`): drag handles, long-press on touch, drop → store action | P08, P09, P11, P12 |
| `src/composables/useRefresh.js` | **Present** (`REFRESH_INTERVAL_MS`, `useRefresh`). Refresh on window focus and every ~2 min | P10 |
| `src/styles/projects.css` | Layout, including the phone breakpoint | P05, P11 |
| `src/main.js` + `src/App.vue` (Report a bug; planned) | `installErrorBuffer()` at startup; craft-bugreport-web's `ReportButton` in the app navigation, given `{ app, version, commit, ncVersion, dropBase, dropToken, userName }` and `getWorkingFile()` returning the open area's projects and tasks as JSON; drop base and token are an app config value (`occ config:app:set cc_projects bug_drop_base/bug_drop_token`) handed to the page as initial state by `PageController`, never committed | M21 (#39, #40) |
| `appinfo/info.xml` + `.github/workflows/release.yml` (updates from the admin panel; planned) | The release fields the merged feed reads (id, a.b.c version, Nextcloud range, PHP minimum; guarded by `tests/unit/release.infoxml.spec.js`, planned in #41) and the tag workflow that calls craft-nc-appstore's `build-app.yml@v1`; signing and publishing happen on the release-key machine (R35), never in CI | M22 (#41, #42, #44) |

### Tests and tooling

| Path | Job |
|---|---|
| `tests/unit/App.spec.js` | The app mounts and shows its heading |
| `tests/unit/AreaSection.spec.js`, `ProjectCard.spec.js`, `TaskTree.spec.js`, `TaskRow.spec.js`, `AddTaskInput.spec.js` | The panel components render their props, depth and links; `AddTaskInput` submits through the store |
| `tests/php/PageControllerTest.php` | Smoke test: the page route returns the `main` template (skeleton) |
| `tests/tools/php.mjs` | Runs PHP lint and phpunit with a local PHP 8.4+, else a throwaway `nextcloud:33.0.10-apache` container |
| `tests/unit/areas.spec.js` | `isExcluded` and `pickAreas`: the eight areas by display name, the exclusions |
| `tests/unit/dav.spec.js` | `dav.js` reads and writes against a fake `cdav-library`: `putTodo`, `createTodo`, `ConflictError` on 412 |
| `tests/unit/davRootUrl.spec.js` | The client is built with the absolute `generateRemoteUrl('dav')` root (#49) |
| `tests/unit/projects.spec.js` | The store's `load`: areas read, tree built |
| `tests/unit/projectsLoadError.spec.js` | `load` leaves a non-empty `error` when a read fails (#49) |
| `tests/unit/projects.addTask.spec.js`, `projects.addTask.failure.spec.js` | `addTask`: the task is created on the project's list and appears in the tree; a failure toasts and returns `null` |
| `tests/unit/projects.createProject.spec.js` | `createProject`: a `project`-tagged task on the area's list |
| `tests/unit/Task.spec.js` | Round-trip: parse → change one field → serialize keeps everything else byte-equivalent (incl. `X-CC-*`, bare RELATED-TO) |
| `tests/unit/tree.spec.js` | Cross-list children, depth 3, orphans, untagged parents, Deck, agent queues and shared lists excluded |
| `tests/unit/sortOrder.spec.js` | Same results as Tasks' `adjustSortOrder` on the same inputs: insert between, bump, default from CREATED |
| `tests/unit/sortOrderFromIcs.spec.js` | `effectiveSortOrder` on tasks parsed from `.ics` text, including a frozen store proxy (#50) |
| `tests/fixtures/*.ics` | Sample VTODOs shaped like the real data (copied shapes, no personal content); must cover the fixture table in SPEC.md |
| `package-lock.json`, `composer.lock` | Committed lockfiles; CI installs with `npm ci` |
| `package.json`, `vite.config.mjs`, `vitest.config.mjs`, `eslint.config.mjs` | Build with `@nextcloud/vite-config`; test with Vitest (jsdom, `tests/unit/**/*.spec.js`); lint with `@nextcloud/eslint-config` |
| `composer.json` | PHP autoload (`OCA\CcProjects\` to `lib/`), phpunit and `nextcloud/ocp` for tests |
| `.github/workflows/check.yml` | CI on GitHub-hosted runners: lint, tests, PHP lint and PHP tests on Linux and Windows (`check` job); `npm run build` on Linux (`build` job) |
| `.gitattributes` | LF line endings in every checkout |
| `scripts/fetch-tasks-ref.sh` | Shallow-clone Nextcloud Tasks (default v0.18.1) into git-ignored `reference/tasks` for reading |
| `scripts/dav-get.sh` | Print one stored task's raw iCalendar from the **test** container (CalDAV GET), for the spec's "read the stored task" checks |
| `scripts/check-dav-real.mjs` | **Real-library check (#34):** against the test container it proves `fetchTodo`'s relative-path `find()`, `createTodo`'s `createObject(name, headers, data)`, and a stale-etag write; the library files every HTTP error as status -1, so `dav.js` re-reads the etag to throw `ConflictError` |
| `test-env/` | The test container: `compose.yaml`, `setup.sh`, `reset.sh`, `seed.py` (fixture lists and tasks) |
| `scripts/deploy-test.sh` (planned, #4) | Build and copy into the **test** container, then `occ app:enable cc_projects` there |
| `.gitignore` | `node_modules/`, `vendor/`, `js/` and `css/` build output, `reference/` |

Live install (copy into the live `custom_apps/cc_projects` + `occ app:enable cc_projects`) has no script on purpose: it happens by hand, on the owner's yes, every time.

## How the modules interlink

Calls go one way, top to bottom. Only `services/dav.js` talks to the server; the models are pure and import nothing but `ical.js`.

| Module | Calls | Called by |
|---|---|---|
| `components/*` | the store's actions; `composables/useDrag.js` | `App.vue`, each other (AreaSection → ProjectCard → TaskTree → TaskRow) |
| `App.vue` | `store/projects.js` (`load`), `composables/useRefresh.js` | `main.js` |
| `store/projects.js` | `services/dav.js`, `services/areas.js`, `models/Task.js`, `models/tree.js`, `models/sortOrder.js` | components, `App.vue` |
| `services/areas.js` | nothing (pure filter over `TaskCalendar`) | the store |
| `services/dav.js` | `@nextcloud/cdav-library` | the store |
| `models/tree.js` | `models/sortOrder.js` (sibling order) | the store |
| `models/Task.js` | `ical.js` | the store, `models/tree.js` (as data) |
| `models/sortOrder.js` | nothing | `models/tree.js`, the store |

## Mac, PC and Linux

Projects is a browser app on a Nextcloud server, so "platform" means the developer's machine and the user's browser:

- **Browsers:** current Firefox, Chrome, Safari and Edge on Mac, Windows and Linux, plus Safari on iOS and Chrome on Android for the phone layout (P11). Nextcloud's own browser list is the floor.
- **Server:** any Nextcloud 33–35 host; nothing in the app depends on the host OS.
- **Building:** Node 24 and PHP 8.4 on any OS. CI (`.github/workflows/check.yml`, GitHub-hosted runners) runs lint and tests on Linux and Windows; macOS is not covered yet, so Mac is checked by hand until one exists. PHP comes from `setup-php` on Linux and from the runner's own install on Windows. Bounding the Vitest workers on those runners is #67.
- **Line endings:** LF everywhere (`.gitattributes`); the lint config rejects CRLF.
- **Scripts:** `scripts/*.sh` and `test-env/*.sh` are bash: on Windows run them in Git Bash or WSL. Node scripts build paths with `node:path`, never string joins with `/` or `\`.
- **Test container:** needs Docker (Docker Desktop on Mac and Windows). `tests/tools/php.mjs` falls back to it when no PHP 8.4 is installed.

## Rules the code keeps

1. **Round-trip what you don't own.** Never drop or rewrite a property or parameter the app doesn't edit. Agents rely on `X-CC-*`, `X-FORK-*` and their own RELATED-TO shape.
2. **Write bare `RELATED-TO:<uid>`** (PARENT by default), as `nc_helpers` does. Never add `RELTYPE`.
3. **Every write is If-Match.** A 412 means someone else changed it: reload, never retry blind.
4. **Areas by display name, never URI segment.**
5. **Exclusions are fixed:** lists shared by other people (for example, a list a colleague shares), agent queues (`*_shared_by_*`), Deck boards (`app-generated--deck--*`).
6. **Order like Tasks does:** write the moved task, plus only the later siblings Tasks' rule bumps. Never renumber a whole project.
7. **No data on the server side.** If a feature seems to need a PHP endpoint, stop and ask.

## Facts (fill in at P00)

| Question | Answer | Source |
|---|---|---|
| How Tasks 0.18.1 writes `X-APPLE-SORT-ORDER` | Integer, ascending (lower first). Missing → effective value = seconds from 2001-01-01T00:00 to CREATED (0 if no CREATED); nothing is written until a drag. Drag: moved task = next sibling − 1 if that is above the previous sibling, else previous + 1, floor 0; then each later sibling whose value is ≤ the one before is set to that + 1 (a bump, written). Ties keep load order. Manual sort ignores pinned and completion | `src/models/task.js` 163-167, 807-822, 901-918; `src/components/TaskDragContainer.vue` 95-157; `src/store/storeHelper.js` 228-286, 452 (tag v0.18.1) |
| Tasks deep-link URL for one task | `<generateUrl('apps/tasks')>/calendars/<calendar URI segment>/tasks/<task file name incl. .ics>` (history routing, no `#`). Without the calendar: `/apps/tasks/collections/all/tasks/<file>.ics`. Don't copy the stale `/#/` form in `TaskCreateDialog.vue` | `src/views/Dashboard.vue` 205; `src/router.js` 33-93; `src/store/tasks.js` 159-171 |
| How much data the panel shows | 61 project roots exist; 22 are on the owner's own lists (what the panel shows), 39 on agent queues the owner's account cannot see | Observed while speccing, 2026-10-23 |
| Deck lists in CalDAV | Deck publishes its boards as `app-generated--deck--*` task lists (many boards), so area discovery must filter them | Observed while speccing, 2026-10-23 |
| `cdav-library` MOVE support | Yes. `VObject.move(calendar, overwrite=false, headers={})` sends MOVE with `Overwrite: F`; `headers` carries `If-Match`. Keeps the file name; refuses same list, other collection type, read-only target. Updates `url` but not `etag`, so re-read after | `@nextcloud/cdav-library` 2.6.2 `dist/index.mjs` (DavObject.move), checked 2026-10-26 |
| Test container recipe | `test-env/` (see its README): compose project `nc-projects-test`, Nextcloud 33.0.10 + Tasks 0.18.1, SQLite, `127.0.0.1:$NC_TEST_PORT` (default 8089); `setup.sh` installs, makes users `owner`/`other`/`agent`, seeds the fixture lists with `seed.py`. Passed 2026-10-26 on a Windows 11 Docker host with NC_TEST_PORT=8099: Nextcloud 33.0.10, Tasks 0.18.1 (pinned release), Deck 1.17.8 (app store), users and fixture lists seeded; first run hit a SQLite 'database is locked' on user:add, now retried | `test-env/` |

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

Known on 2026-10-23 (installed Tasks 0.18.1 on the production server): it ships `@nextcloud/vue` 9.8.2 (Vue 3), `@nextcloud/cdav-library` 2.6.2, `ical.js` 2.2.1, `sortablejs` 1.15.6 (through `sortablejs-vue3`), `vuex` 4.1.0, and supports Nextcloud 31–35. The production server runs Nextcloud 33. We use Pinia rather than Vuex: it is the current Vue 3 default and the store is small.
