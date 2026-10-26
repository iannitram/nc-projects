# Roadmap

Goal: a project manager over Nextcloud Tasks, built in three phases (Ian, 2026-10-23). **1.0 is all three phases** (Ian, 2026-10-26; [SPEC.md](SPEC.md), ADR 0014). Phase 1 is the core ask and should be usable day to day on its own, so it can be dogfooded before 1.0.

**How this file works**
- Every feature has a fixed **ID** (P01, P02, …). IDs never change, so Notes can name dependencies even after rows move.
- A feature moves **Unwritten → PR** when a pull request opens (add the PR link in Notes), and **PR → Merged** when it merges (add the merge date).
- **Unwritten is grouped by phase, in build order.**
- **Complexity** is the predicted effort to write it: Low, Medium or High.
- **Notes** names dependencies ("Needs P03") and anything a builder should know.
- Each ID maps to files in [CODE_MAP.md](CODE_MAP.md).

---

## Merged

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| | *(nothing yet)* | | |

## PR

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| | *(nothing yet)* | | |

## Unwritten

### Phase 0: verify before code

| ID | Item | Complexity | Notes |
|---|---|---|---|
| P00 | **Pre-flight checks** | Low | (a) Read how Tasks 0.18.1 computes and writes `X-APPLE-SORT-ORDER` (units, direction, what it does with ties and with tasks that have none), so our order and Tasks' manual sort agree. (b) Find the Tasks deep-link URL format for "open in Tasks". (c) ~~Confirm `cdav-library` exposes MOVE for P12~~: yes, answered 2026-10-26 (CODE_MAP §Facts). (d) Stand up the test Nextcloud container (33.x, Tasks 0.18.1) seeded with fixture lists. Record answers in CODE_MAP §Facts |

### Phase 1: view, add, reorder

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| P01 | **App skeleton**: `cc_projects`, "Projects" nav entry, page that mounts the Vue app, Vite build | Low | Loads in the test container with an empty panel |
| P02 | **Area discovery**: list Ian's calendars and keep the 8 areas | Low | Needs P01. Match by display name, never by URI segment (The Channel's is a UUID, Personal's is `personal-1`). Exclude lists shared by other people (today Farm Boy), `*_shared_by_*`, `app-generated--deck--*` |
| P03 | **Task model**: parse and write VTODOs | Medium | Needs P00(a). Fields: UID, SUMMARY, STATUS, COMPLETED, DUE, PRIORITY, CATEGORIES, RELATED-TO, X-APPLE-SORT-ORDER, etag, calendar. **Must round-trip every property it doesn't understand** (agents write `X-CC-*`). Unit tests on fixtures |
| P04 | **Tree builder**: areas → projects → tasks | Medium | Needs P02, P03. Project = category `project`. Children by RELATED-TO across lists, up to 3 levels; count what lies deeper for the "+N deeper" note. Orphans and untagged parents are set aside for P15, not shown |
| P05 | **Panel view** | Medium | Needs P04, P00(b). Areas, project cards, open tasks, collapsible subtasks with a "+N deeper" note past level 3 (opens that task in Tasks), done/total progress bar over every task at every level under the project, "show done" toggle |
| P06 | **Status badges and Done strip** | Low | Needs P05. `blocked` red, `someday` greyed and sunk to the bottom of its area; completed projects in a collapsed Done strip per area |
| P07 | **+ Add task** under a project | Low | Needs P05. New VTODO on the project's list with bare `RELATED-TO:<project uid>`; lands at the bottom (no sort order until a drag) |
| P08 | **Drag to reorder tasks** within a project | Medium | Needs P05, P00(a). Writes `X-APPLE-SORT-ORDER` only on moved tasks where possible; unordered tasks sit at the bottom, newest last, and get an order on the first drag in that project |
| P09 | **Drag to reorder projects** within an area | Low | Needs P08. Same order field, on the project VTODOs |
| P10 | **Refresh and conflict safety** | Medium | Needs P05. Refresh on tab focus and every ~2 min (etag/ctag compare, not a full reload). Every PUT sends If-Match; a 412 reloads that task and shows a quiet notice |
| P11 | **Phone layout** | Medium | Needs P05, P08. Responsive in Nextcloud's mobile web view; long-press to drag on touch |

### Phase 2: move, edit, create projects

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| P12 | **Drag a task onto another project** | High | Needs P08, P00(c). Changes RELATED-TO. If the target project is on a different list, the task also MOVEs to that list, so the Tasks app nests it correctly. Subtasks move with it |
| P13 | **Quick inline edits** | Medium | Needs P05. Check off, rename, due date, priority. Anything bigger: "open in Tasks" link (P00(b)) |
| P14 | **+ New project** per area | Low | Needs P05. Creates a VTODO with category `project` on that area's list, same shape agents create |

### Phase 3: tidy up

| ID | Feature | Complexity | Notes |
|---|---|---|---|
| P15 | **Needs filing tray** | Medium | Needs P04, P12. Lists orphans (RELATED-TO pointing at a missing or closed parent) and parents with children but no `project` tag. One-click "make project" (adds the category) or "move to project" (re-parent). Today: 5 orphans, 4 untagged parents |

---

## Out of scope (decided 2026-10-23)

| Item | Why |
|---|---|
| Agent queues / a "Crew" area | Ian: only his own lists. Agent work that needs him already lands on System |
| Lists shared by other people (Farm Boy) | Not Ian's own |
| Deck boards | Deck is retired as a project layer; its boards only show up in CalDAV as leftovers |
| Other users (Lani) | Ian first; revisit if wanted |
| Its own REST API for agents | Agents keep using CalDAV through `nc_helpers` |
| A full task editor | Quick edits only; the Tasks app does the rest |
| Auto-completing a project at 100% | Ian closes projects himself |
| Adding subtasks under a task (not a project) | Not asked; use the Tasks app |
| Search and filters | Not asked for 1.0 |
| A PHP data backend | Browser CalDAV, like the Tasks app |
| Native phone app | Phone Tasks/CalDAV clients already show the same data and order |
| Moving projects between areas | Not asked; use the Tasks app |
