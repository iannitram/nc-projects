# Glossary

Terms used in the spec's Musts, with the meaning the app gives them.

| Term | Meaning |
|---|---|
| **Agent** | An automated helper that files and edits tasks through CalDAV. Its tasks appear in the panel like any other. |
| **Agent queue** | A task list an agent shares with the owner (display name ends `_shared_by_*`). Never an area. |
| **Area** | One of the owner's own eight task lists: Personal, Channel, Project A, Project B, School 1, School 2, Home, System. Matched by display name. |
| **Badge** | A label on a project card: `blocked` (red) or `someday` (greyed, sunk to the bottom of its area). Read from the task's categories. |
| **Card** | How a project shows in the panel: header (title, badges, progress bar, show-done toggle, + Add task) and its tasks. |
| **"+ Add task"** | The field under a project card that creates a task at the project's top level, on the project's own list. |
| **"+ New project"** | The button on an area that creates a `project`-tagged task on that area's list. |
| **Agent fields** | Properties agents write that the app never edits but always keeps: `X-CC-*` and `X-FORK-*`. |
| **CalDAV** | The standard protocol Nextcloud uses to store and serve tasks. The app, the Tasks app, phones and agents all read and write tasks through it. |
| **Cancelled** | A task with status Cancelled. Closed, like a completed task, but left out of the progress bar. |
| **Category** | A task's tag (iCalendar `CATEGORIES`). `project`, `blocked` and `someday` have meaning here. |
| **Conflict** | Trying to write a task that changed elsewhere since the panel loaded it. Detected by etag; the write is refused. |
| **Deck board** | A list Nextcloud Deck generates in CalDAV (`app-generated--deck--*`). Never an area. |
| **Done strip** | The collapsed row at the bottom of an area holding projects the owner has checked off. |
| **Etag** | The server's version tag for one stored task. Every write sends it (`If-Match`). |
| **Fixture lists** | Sample task lists in the test container, named like the eight areas plus one shared list, one agent queue and one Deck board, holding made-up tasks shaped like real ones. |
| **List** | A Nextcloud task list (a CalDAV calendar holding tasks). |
| **Move (to another list)** | Relocating a stored task from one list to another (WebDAV `MOVE`), used when a task joins a project on a different list. |
| **Open in Tasks** | A link that opens one task in the Nextcloud Tasks app. |
| **Move to another project** | Dragging a task onto another project: re-link it, and move it to that project's list if different. Its subtasks come along. |
| **Orphan** | A task whose parent link points at a task that is missing or completed. Listed in the Needs filing tray. |
| **Needs filing tray** | The panel section listing orphans and untagged parents, with "make project" and "move to project" buttons. |
| **Panel** | The Projects page: all areas with their cards, the Done strips and the Needs filing tray. |
| **Parent link** | A task's bare `RELATED-TO:<uid>`, which means "my parent is this task". Written without `RELTYPE`. |
| **Phase** | One of the roadmap's three build stages: 1 view, add, reorder; 2 move, edit, create projects; 3 the Needs filing tray. 1.0 needs all three. |
| **Progress bar** | A project's done/total count over every task at every level under it, across lists. |
| **Project** | A task with the category `project`. Its tasks are those linked under it. |
| **Quick edit** | Check off, rename, due date or priority, done in the panel. Anything else goes through Open in Tasks. |
| **Re-link (re-parent)** | Changing a task's parent link to point at a different project. |
| **Refresh** | Re-reading what changed on the server (by etag) without reloading the page: on tab focus and every two minutes. |
| **Bump** | When a drag leaves a later sibling with a number no higher than the one before it, raising that sibling's number by one, as the Tasks app does. |
| **Round-trip** | Reading a task and writing it back with every property and parameter the app did not edit unchanged. |
| **Shared list** | A list another person shares with the owner. Never an area. |
| **Show done** | A per-project toggle that shows or hides its completed tasks. Remembered in this browser only; writes nothing. |
| **Sort order** | A task's `X-APPLE-SORT-ORDER`, the field the Tasks app's manual sort uses: lower numbers first. Drag order is stored here. |
| **Subtask** | A task linked under another task rather than directly under the project. Shown nested, up to three levels. |
| **Tasks app** | Nextcloud's own Tasks app, at the same version as on the live server. Its manual sort reads the same sort order. |
| **Test container** | A throwaway Nextcloud with the same Tasks version as live, seeded with fixture lists, used for every check. |
| **Unordered task** | A task with no sort order (often agent-filed). Placed by its creation time, as the Tasks app does: seconds from 2001-01-01 to its creation, so new ones land at the bottom, newest last. |
| **Untagged parent** | A task that has children but no `project` category. Listed in the Needs filing tray. |
| **"+N deeper"** | The note at the third level of nesting that counts hidden deeper tasks and opens that task in Tasks. |
