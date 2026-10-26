# Projects: spec

**Approval:** 2026-10-26, in a session with Claude Code. A changed Must or Won't sets this back to "not yet".

## 1.0 in one sentence

I can open **Projects** from Nextcloud's top bar and, in one panel, see every project on my own task lists with its tasks in my drag order, add and reorder tasks and projects, move a task to another project, make quick edits, start new projects, and file away stray tasks, while the Tasks app, phone clients and agents keep working on the same data unchanged.

All three phases of the roadmap make up 1.0: phase 1 (view, add, reorder), phase 2 (move, edit, create projects) and phase 3 (the Needs filing tray).

## Musts

Each Must is checked in the **test container**, a throwaway Nextcloud with the same Tasks version as live, seeded with **fixture lists** (sample lists named like my eight areas, plus one shared list, one agent queue and one Deck board, all with made-up tasks). A check is a script or numbered steps anyone can repeat there. The live server is never used for a check.

**Reading a stored task.** Where a check says "read the stored task" or "compare stored copies", it means fetching the task's raw iCalendar text from the test container over CalDAV (a plain GET of the task's URL) with the test kit's read script, and diffing before and after copies as text.

**Phone width** means a 390 by 844 viewport with touch input on.

**The fixture tasks** every check relies on (made-up titles, shaped like real data):

| Fixture | Where | Used by |
|---|---|---|
| One open project per area, ordered, with three ordered tasks | Each of the eight area lists | M1, M2, M10, M12 |
| A project with a child on another area's list | Project on one list, child on another | M3, M17 |
| A four-level chain under a project (task, subtask, sub-subtask, one more) | One list | M3, M4 |
| A project with 10 tasks across two levels, 4 completed | One list | M5, M6 |
| A project tagged `blocked`, and one tagged `someday` | One list | M7 |
| A project whose tasks are all completed but which is still open | One list | M8 |
| A project mixing ordered tasks and three unordered tasks with different creation times | One list | M11 |
| A task carrying `X-CC-*` and `X-FORK-*` properties and a parameter the app doesn't use | One list | M15 |
| A task with one subtask, under a project on a different list from a second project | Two lists | M17 |
| An orphan (links to a completed parent) and an untagged parent with two children | One list | M20 |
| A list shared by another account, an agent queue (`*_shared_by_*`) and a Deck board (`app-generated--deck--*`), each holding a `project` task | Outside the areas | M1, M2 |

### Phase 1: view, add, reorder

**M1. Areas.** WHEN I open Projects, THE APP SHALL show one section per area (Personal, The Channel, Van, Barnum, Cheltenham, DCIS, DPS, System), matched by the list's display name, and no other list.
- Done looks like: eight area sections; the shared list, the agent queue and the Deck board are absent.
- Check: open Projects in the test container; count the sections and read their names.

**M2. Projects.** WHEN a task on an area's list has the category `project`, THE APP SHALL show it as a project card in that area; a task without that category SHALL NOT be a project card.
- Done looks like: every `project`-tagged fixture task has a card; an untagged parent with children has none.
- Check: compare the cards against the fixture lists' `project` tasks.

**M3. Tasks under a project.** WHEN a task's link to its parent (bare `RELATED-TO`) points at a project or at a task under it, THE APP SHALL show it under that parent, even if it is on another list, nested up to three levels with each level collapsible.
- Done looks like: a fixture child on another list shows under its project; collapsing a level hides its subtasks.
- Check: open the fixture project that has a child on a second list; collapse and expand a level.

**M4. Deeper than three levels.** WHEN a task has subtasks below the third level, THE APP SHALL show a "+N deeper" note at the third level that opens that task in the Tasks app.
- Done looks like: the fixture four-level chain shows "+1 deeper"; clicking it opens the level-3 task in Tasks.
- Check: open the fixture project with a four-level chain; click the note.

**M5. Progress.** WHEN I look at a project card, THE APP SHALL show a done/total bar counting every task at every level under the project, across lists.
- Done looks like: a fixture project with 4 of 10 descendant tasks completed shows 4/10.
- Check: read the bar on that fixture project.

**M6. Show done.** WHEN I turn on "show done" for a project, THE APP SHALL show its completed tasks; when it is off, completed tasks SHALL be hidden.
- Done looks like: completed fixture tasks appear and disappear with the toggle.
- Check: toggle it on a fixture project with completed tasks.

**M7. Status badges.** WHEN a project has the category `blocked`, THE APP SHALL show a red "blocked" badge; WHEN it has `someday`, THE APP SHALL grey the card and place it below the area's other open projects.
- Done looks like: the fixture blocked project has a red badge; the someday project is grey and last.
- Check: read those two cards and their position.

**M8. Done strip.** WHEN I check off a project, THE APP SHALL move it into a collapsed Done strip at the bottom of its area; a project whose tasks are all done but which I have not checked off SHALL stay open.
- Done looks like: checking off a fixture project moves it into the strip, which starts collapsed; a fixture project at 100% stays open.
- Check: check off one project; reload and confirm the strip is collapsed and holds it; look at the 100% project.

**M9. Add task.** WHEN I type a title in "+ Add task" under a project and confirm, THE APP SHALL create a task on the project's own list, linked to the project by a bare `RELATED-TO`, and show it at the bottom of the project with no sort order.
- Done looks like: the new task shows last in the panel and appears under the project in the Tasks app.
- Check: add a task; read the stored task's list, `RELATED-TO` and `X-APPLE-SORT-ORDER` (absent); open the project in Tasks.

**M10. Reorder tasks.** WHEN I drag a task to a new place among its siblings, THE APP SHALL keep it there after a reload and the Tasks app's manual sort SHALL show the same order, writing `X-APPLE-SORT-ORDER` only on tasks that moved (unless the project must be renumbered once because the gaps ran out).
- Done looks like: same order in Projects after reload and in Tasks' manual sort; only the moved task's stored copy changed.
- Check: drag a task; reload; open Tasks with manual sort; compare the stored copies before and after.

**M11. Unordered tasks.** WHEN tasks have no sort order (for example, filed by an agent), THE APP SHALL show them below the ordered ones, newest last, until the first drag in that project gives them a place.
- Done looks like: fixture tasks without a sort order sit at the bottom by creation time.
- Check: read the order of a fixture project that mixes ordered and unordered tasks.

**M12. Reorder projects.** WHEN I drag a project card to a new place in its area, THE APP SHALL keep it there after a reload, stored the same way on the project task.
- Done looks like: same card order after reload; only the moved project's stored copy changed, in `X-APPLE-SORT-ORDER`.
- Check: drag a card; reload; compare the stored copies before and after.

**M13. Refresh.** WHEN the tab regains focus, or every two minutes while it is open, THE APP SHALL pick up changes made elsewhere without a full page reload.
- Done looks like: a task added to a fixture list through CalDAV appears within two minutes, or at once on refocus.
- Check: add a task with a CalDAV script; wait, then refocus the tab.

**M14. Conflict safety.** WHEN I change a task that someone else changed since the panel loaded it, THE APP SHALL refuse the write, reload that task and show a quiet notice, never overwriting the other change.
- Done looks like: the other change survives; a notice shows; the panel shows the new version.
- Check: load the panel; change a task through CalDAV; then reorder or edit it in the panel.

**M15. Nothing else is touched.** WHEN the app writes a task, THE APP SHALL keep every property and parameter it does not edit exactly as it was (including agents' `X-CC-*` and `X-FORK-*` fields), and SHALL store nothing outside the ordinary task data.
- Done looks like: before and after copies of a written fixture task differ only in the edited fields.
- Check: the round-trip test on the fixture tasks; diff a task before and after a write in the container.

**M16. Phone.** WHEN I open Projects in a phone browser, THE APP SHALL lay out to fit the screen, and long-pressing a task or card SHALL start a drag.
- Done looks like: no sideways scrolling at phone width; a long-press drag reorders a task.
- Check: open the panel at phone width; long-press and drag a task; reload and confirm the new order.

### Phase 2: move, edit, create projects

**M17. Move a task to another project.** WHEN I drag a task onto another project, THE APP SHALL re-link it to that project, and, if that project is on a different list, move the task to that list too; its subtasks SHALL come with it.
- Done looks like: in Tasks, the task and its subtasks sit under the new project on the new project's list.
- Check: drag a fixture task with a subtask onto a project on another list; open both lists in Tasks.

**M18. Quick edits.** WHEN I check off, rename, or change the due date or priority of a task in the panel, THE APP SHALL save that change; every task SHALL also have an "open in Tasks" link for anything bigger.
- Done looks like: each edit shows in the Tasks app; the link opens that task in Tasks.
- Check: make each of the four edits on a fixture task; open it in Tasks; click the link.

**M19. New project.** WHEN I use "+ New project" on an area, THE APP SHALL create a task with the category `project` on that area's list and show it as a card.
- Done looks like: the new card appears; in Tasks it is an ordinary task tagged `project`.
- Check: create one; open the area's list in Tasks.

### Phase 3: tidy up

**M20. Needs filing tray.** WHEN a task links to a missing or completed parent (an orphan), or a task has children but no `project` category (an untagged parent), THE APP SHALL list it in a Needs filing tray with one-click "make project" (adds the category) and "move to project" (re-links it).
- Done looks like: the fixture orphan and untagged parent are listed; each button fixes its case and the item leaves the tray.
- Check: open the tray; use each button on a fixture item; check the result in Tasks.

## Won'ts

- No agent queues and no "Crew" area; only my own eight lists.
- No lists shared with me by other people, and no Deck boards.
- No other users' accounts (revisit if wanted).
- No API of its own for agents; they keep using CalDAV.
- No full task editor; quick edits only, the Tasks app does the rest.
- No auto-completing a project when its tasks reach 100%.
- No adding subtasks under a task; "+ Add task" works at the project's top level only.
- No search or filters.
- No data backend on the server; it only serves the page.
- No native phone app.
- No moving projects between areas.

## Problem

My projects are parent tasks tagged `project` in Nextcloud Tasks, with their tasks linked under them, sometimes from other lists. The Tasks app shows them as flat lists per list, so I can't see a project with all its tasks, can't see my projects side by side by area, and can only read the real structure through scripts.

## Solution

A Nextcloud app, Projects, that reads the same task data and shows it the way I think about it: areas, then projects, then tasks, in an order I set by dragging. It keeps everything in ordinary task fields, so the order shows in Tasks and on phones, and agents filing tasks don't need to change.

## User stories

1. As the owner, I want every project on my lists visible in one place by area, so I can see what's in flight.
2. As the owner, I want a project's tasks under it even when they live on other lists, so the view matches how the work is linked.
3. As the owner, I want to drag tasks and projects into order and see that order in Tasks and on my phone too.
4. As the owner, I want to add a task under a project in one step, without opening Tasks.
5. As the owner, I want a project to finish only when I say so, and then get out of the way.
6. As the owner, I want tasks agents file to appear without any change on their side, and never to lose their fields when I edit.
7. As the owner, I want to move a task to another project, make small edits, and start projects from the panel.
8. As the owner, I want stray tasks (orphans and untagged parents) gathered in one tray with quick fixes.
9. As the owner, I want it to work in my phone's browser.

## Implementation decisions

The full list, with reasons, is in the decision records (ADRs). In short:
- Its own Nextcloud app, display name "Projects", app id `cc_projects`; not a fork of Tasks.
- Vue 3 with Nextcloud's component library, talking CalDAV from the browser like the Tasks app; the server side only serves the page.
- A project is a task tagged `project`; a task belongs to it by bare `RELATED-TO`; order is `X-APPLE-SORT-ORDER`, the field the Tasks app's manual sort uses.
- Areas are matched by list display name; the exclusions are fixed.
- Every write sends the task's etag and is refused if the task changed.
- Developed against the test container; installed on the live server only with the owner's yes, every time.

## Testing decisions

- Every Must's check runs in the test container on fixture lists with made-up content; never against live data.
- Pure logic (reading and writing a task, building the tree, order math) has unit tests on fixture tasks, including a round-trip test that changes one field and proves nothing else changed.
- Panel checks run in a real browser against the test container, at desktop and phone widths.
- Before any order code: confirm how the Tasks app writes `X-APPLE-SORT-ORDER`, so both orders agree (roadmap P00).

## Further notes

- Phase 0 pre-flight answers go in the code map's Facts table. Found so far: the CalDAV library Tasks ships (`@nextcloud/cdav-library` 2.6.2) can move a task between lists and lets the caller send `If-Match`; after a move it keeps the old etag, so the app re-reads the task.
