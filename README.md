# Projects (`cc_projects`)

A Nextcloud app that turns Nextcloud Tasks into a project manager. A **Projects** icon in the top bar opens a panel that shows each focus area, the projects in it, and the tasks in each project, inline, in the order you drag them into.

It replaces today's workaround (parent VTODOs tagged `project`, read only through scripts) with a real view. It stores nothing new: everything it shows and writes is ordinary CalDAV task data, so the Tasks app, phone clients and Ian's agents keep working unchanged.

Spec settled with Ian in a grilling session, 2026-10-23 (24 decisions; record in the vault at `Workspaces/NC Projects/PROJECT.md`).

## How it reads your data

| Concept | What it is in CalDAV | Notes |
|---|---|---|
| **Area** | One of Ian's own task lists: Personal, The Channel, Van, Barnum, Cheltenham, DCIS, DPS, System | Matched by display name. Excluded: Farm Boy (Lani's), every agent queue (`*_shared_by_*`), and Deck's `app-generated--deck--*` boards |
| **Project** | A VTODO with the category `project` | No migration: every existing project appears on day one |
| **Task in a project** | A VTODO whose `RELATED-TO` is the project's UID (bare, which means PARENT per RFC 5545) | Followed across lists, so a child on another list still shows under its parent |
| **Order** | `X-APPLE-SORT-ORDER` on each VTODO | The field the Tasks app's manual sort uses, so the order shows in Tasks and on phones too |
| **Status** | The existing `blocked` and `someday` categories | Badges on the project header |

## What you see

- Areas → projects → open tasks, with subtasks collapsible (up to 3 levels).
- Each project header: title, a done/total progress bar, and status badges. `blocked` is red; `someday` is greyed and sinks to the bottom of its area.
- Completed tasks hide behind a **show done** toggle. A project is finished only when you check it off yourself. It then moves to a collapsed **Done** strip at the bottom of its area, never automatically at 100%.
- **+ Add task** under a project creates a VTODO on the project's own list, linked to the project. It lands at the bottom.
- Drag to reorder tasks within a project, and projects within an area. Tasks with no sort order (agent-filed ones) sit at the bottom, newest last, until the first drag gives them a place.
- Refreshes when the tab regains focus and every couple of minutes. Every write is guarded by the task's etag: a stale edit is refused and the panel reloads, never silently overwrites.
- Works in the phone browser, with long-press to drag.

## Who it is for

Ian's account, in the browser. Agents keep filing through CalDAV (`nc_helpers`) as they do today, and anything they file on Ian's lists appears in the panel.

## Status and plan

- Phases and every feature: [ROADMAP.md](ROADMAP.md).
- Where the code goes and the rules it keeps: [CODE_MAP.md](CODE_MAP.md).
- Notes for coding sessions: [CLAUDE.md](CLAUDE.md).

## Stack

Vue 3 with `@nextcloud/vue`, talking CalDAV from the browser (`@nextcloud/cdav-library` + `ical.js`), the same way the Tasks app does. There is no PHP data backend: the server side only serves the page. Drag and drop uses `sortablejs`. Built with Vite (`@nextcloud/vite-config`). Developed against a test Nextcloud container; installed into the live server only on Ian's yes.
