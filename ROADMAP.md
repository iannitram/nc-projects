# Roadmap

Goal: a project manager over Nextcloud Tasks, built in three phases (the owner, 2026-10-23). **1.0 is all three phases** (the owner, 2026-10-26; [SPEC.md](SPEC.md), ADR 0014). Phase 1 is the core ask and should be usable day to day on its own, so it can be dogfooded before 1.0.

**How this file works**
- Every feature has a fixed **ID** (P01, P02, …). IDs never change, so Notes can name dependencies even after rows move.
- A feature moves **Unwritten → PR** when a pull request opens (add the PR link in Notes), and **PR → Merged** when it merges (add the merge date).
- **Unwritten is grouped by phase, in build order.**
- **Complexity** is the predicted effort to write it: Low, Medium or High.
- **Notes** names dependencies ("Needs P03") and anything a builder should know.
- Each ID maps to files in [CODE_MAP.md](CODE_MAP.md).

## Dev stages

The phases below are the build order. Phase 0 and phase 1 are usable day to day on their own; 1.0 is all three phases (SPEC.md). Each piece is a GitHub issue, sized by the pipeline repo's rubric, with its order written as `Blocked by #N`.

## Open source we bring in

| Project | Version | Where it fits |
|---|---|---|
| `@nextcloud/vue` | ^9.8.2 (Tasks ships 9.8.2) | Every component: `NcContent`, `NcAppContent`, checkboxes, date and priority pickers, notices |
| `@nextcloud/cdav-library` | ~2.6.2 (Tasks' version; MOVE behaviour checked on it) | `src/services/dav.js` only |
| `ical.js` | ^2.2.1 | `src/models/Task.js` only |
| `sortablejs` + `sortablejs-vue3` | ~1.15.6, ^1.3.0 | `src/composables/useDrag.js` and the drag lists (P08, P09, P11, P12) |
| `pinia` | ^3.0.4 | `src/store/projects.js` |
| `@nextcloud/vite-config`, `@nextcloud/eslint-config` | ^2.5.4, ^9.0.1 | Build and lint |
| Nextcloud Tasks 0.18.1 (source, read only) | v0.18.1 | The reference for every behaviour we match (`scripts/fetch-tasks-ref.sh`); no code is copied |

Platforms (Mac, PC and Linux) are covered in [CODE_MAP.md](CODE_MAP.md#mac-pc-and-linux).

---

## Merged

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| P02 | **Area discovery**: list the owner's calendars and keep the 8 areas | Low | Needs P01. Match by display name, never by URI segment (The Channel's is a UUID, Personal's is `personal-1`). Exclude lists shared by other people (today Farm Boy), `*_shared_by_*`, `app-generated--deck--*` Merged 2026-10-26 (#5 area discovery, #6 dav.js reads). |
| P03 | **Task model**: parse and write VTODOs | Medium | Needs P00(a). Fields: UID, SUMMARY, STATUS, COMPLETED, DUE, PRIORITY, CATEGORIES, RELATED-TO, X-APPLE-SORT-ORDER, etag, calendar. **Must round-trip every property it doesn't understand** (agents write `X-CC-*`). Unit tests on fixtures Merged 2026-10-26 (#7 read and round-trip, #8 setters and `Task.create`). |
| P04 | **Tree builder**: areas → projects → tasks | Medium | Needs P02, P03. Project = category `project`. Children by RELATED-TO across lists, up to 3 levels; count what lies deeper for the "+N deeper" note. Orphans and untagged parents are set aside for P15, not shown Merged 2026-10-26 (#10). |

## PR

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| P05 | **Panel view** | Medium | Needs P04, P00(b). Areas, project cards, open tasks, collapsible subtasks with a "+N deeper" note past level 3 (opens that task in Tasks), done/total progress bar over every task at every level under the project, "show done" toggle Store `load` merged 2026-10-26 (#12); the panel view is PR #43 (#13). Progress bar and show-done (#14) in PR. |

## Unwritten

### Phase 0: verify before code

| ID | Item | Complexity | Notes |
|---|---|---|---|
| P00 | **Pre-flight checks** | Low | (a) ~~Read how Tasks 0.18.1 computes and writes `X-APPLE-SORT-ORDER`~~: answered 2026-10-26 from the Tasks source. (b) ~~Find the Tasks deep-link URL format~~: answered 2026-10-26. (c) ~~Confirm `cdav-library` exposes MOVE for P12~~: yes, answered 2026-10-26 (CODE_MAP §Facts). ~~(d) Stand up the test Nextcloud container (33.x, Tasks 0.18.1) seeded with fixture lists: recipe in `test-env/`. Record answers in CODE_MAP §Facts~~ (done 2026-10-26, #3) |

### Phase 1: view, add, reorder

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| P01 | **App skeleton**: `cc_projects`, "Projects" nav entry, page that mounts the Vue app, Vite build | Low | Files and stubs landed 2026-10-26 (CODE_MAP). Lockfiles and `npm ci` in CI merged 2026-10-26 (#2). Left: `scripts/deploy-test.sh` and loading it in the test container with an empty panel (#4). |
| P06 | **Status badges and Done strip** | Low | Needs P05. `blocked` red, `someday` greyed and sunk to the bottom of its area; completed projects in a collapsed Done strip per area. Checking off a project also checks off its open tasks (as Tasks does) |
| P07 | **+ Add task** under a project | Low | Needs P05. New VTODO on the project's list with bare `RELATED-TO:<project uid>`; lands at the bottom (no sort order until a drag) |
| P08 | **Drag to reorder tasks** within a project | Medium | Needs P05, P00(a). Tasks' own rule (CODE_MAP §Facts): moved task takes neighbour ±1, later colliding siblings bumped by one; unordered tasks placed by creation time exactly as Tasks does Built: the pure order rule `sortOrder.js` (#9, merged 2026-10-26). Left: the drag wiring (#19). |
| P09 | **Drag to reorder projects** within an area | Low | Needs P08. Same order field, on the project VTODOs |
| P10 | **Refresh and conflict safety** | Medium | Needs P05. Refresh on tab focus and every ~2 min (etag/ctag compare, not a full reload). Every PUT sends If-Match; a 412 reloads that task and shows a quiet notice Built: `dav.js` writes with `ConflictError` on 412 (#15, merged 2026-10-26). Left: the store's `refresh`, the 2-minute loop and the notice (#21), and #34. |
| P11 | **Phone layout** | Medium | Needs P05, P08. Responsive in Nextcloud's mobile web view; long-press to drag on touch |

### Phase 2: move, edit, create projects

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| P12 | **Drag a task onto another project** | High | Needs P08, P00(c). Changes RELATED-TO. If the target project is on a different list, the task also MOVEs to that list, so the Tasks app nests it correctly. Subtasks move with it |
| P13 | **Quick inline edits** | Medium | Needs P05. Check off (cascades down to open subtasks; reopening reopens closed parents, as Tasks does), rename, due date, priority. Anything bigger: "open in Tasks" link (P00(b)) |
| P14 | **+ New project** per area | Low | Needs P05. Creates a VTODO with category `project` on that area's list, same shape agents create |

### Phase 3: tidy up

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| P15 | **Needs filing tray** | Medium | Needs P04, P12. Lists orphans (RELATED-TO pointing at a missing or closed parent) and parents with children but no `project` tag. One-click "make project" (adds the category) or "move to project" (re-parent). Today: 5 orphans, 4 untagged parents Built: `tree.js` returns orphans and untagged parents (#11, merged 2026-10-26). Left: the tray (#27). |
| P16 | **Report a bug** (M21) | Medium | The shared craft-bugreport-web form and consent screen in the app navigation; app config for the drop; the open area as the working file; error buffer at startup. #39, #40; blocked by iannitram/craft-bugreport-web#12. Not started |
| P17 | **Updates from the admin panel** (M22) | Medium | info.xml release fields (#41), the tag workflow calling craft-nc-appstore's build-app (#42), first signed release through the merged feed on the test Nextcloud (#44); needs craft-nc-appstore 1.0 |

---

## Out of scope (decided 2026-10-23)

| Item | Why |
|---|---|
| Agent queues / a "Crew" area | The owner's own lists only. Agent work that needs the owner already lands on System |
| Lists shared by other people (Farm Boy) | Not the owner's own |
| Deck boards | Deck is retired as a project layer; its boards only show up in CalDAV as leftovers |
| Other users | The owner first; revisit if wanted |
| Its own REST API for agents | Agents keep using CalDAV through `nc_helpers` |
| A full task editor | Quick edits only; the Tasks app does the rest |
| Auto-completing a project at 100% | The owner closes projects by hand |
| Adding subtasks under a task (not a project) | Not asked; use the Tasks app |
| Search and filters | Not asked for 1.0 |
| A PHP data backend | Browser CalDAV, like the Tasks app |
| Native phone app | Phone Tasks/CalDAV clients already show the same data and order |
| Moving projects between areas | Not asked; use the Tasks app |
