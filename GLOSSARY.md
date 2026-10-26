# Glossary

Terms used in the spec's Musts, with the meaning the app gives them.

| Term | Meaning |
|---|---|
| **Agent** | An automated helper that files and edits tasks through CalDAV. Its tasks appear in the panel like any other. |
| **Agent queue** | A task list an agent shares with the owner (display name ends `_shared_by_*`). Never an area. |
| **Area** | One of the owner's own eight task lists: Personal, The Channel, Van, Barnum, Cheltenham, DCIS, DPS, System. Matched by display name. |
| **Badge** | A label on a project card: `blocked` (red) or `someday` (greyed, sunk to the bottom of its area). Read from the task's categories. |
| **Card** | How a project shows in the panel: header (title, badges, progress bar, show-done toggle, + Add task) and its tasks. |
| **Category** | A task's tag (iCalendar `CATEGORIES`). `project`, `blocked` and `someday` have meaning here. |
| **Conflict** | Trying to write a task that changed elsewhere since the panel loaded it. Detected by etag; the write is refused. |
| **Deck board** | A list Nextcloud Deck generates in CalDAV (`app-generated--deck--*`). Never an area. |
| **Done strip** | The collapsed row at the bottom of an area holding projects the owner has checked off. |
| **Etag** | The server's version tag for one stored task. Every write sends it (`If-Match`). |
| **Fixture lists** | Sample task lists in the test container, named like the eight areas plus one shared list, one agent queue and one Deck board, holding made-up tasks shaped like real ones. |
| **List** | A Nextcloud task list (a CalDAV calendar holding tasks). |
| **Move (to another list)** | Relocating a stored task from one list to another (WebDAV `MOVE`), used when a task joins a project on a different list. |
| **Open in Tasks** | A link that opens one task in the Nextcloud Tasks app. |
| **Orphan** | A task whose parent link points at a task that is missing or completed. Listed in the Needs filing tray. |
| **Needs filing tray** | The panel section listing orphans and untagged parents, with "make project" and "move to project" buttons. |
| **Parent link** | A task's bare `RELATED-TO:<uid>`, which means "my parent is this task". Written without `RELTYPE`. |
| **Progress bar** | A project's done/total count over every task at every level under it, across lists. |
| **Project** | A task with the category `project`. Its tasks are those linked under it. |
| **Quick edit** | Check off, rename, due date or priority, done in the panel. Anything else goes through Open in Tasks. |
| **Re-link (re-parent)** | Changing a task's parent link to point at a different project. |
| **Renumber** | Rewriting the sort order of every task in one project, once, when there is no room left between two neighbours. |
| **Round-trip** | Reading a task and writing it back with every property and parameter the app did not edit unchanged. |
| **Shared list** | A list another person shares with the owner. Never an area. |
| **Show done** | A per-project toggle that shows or hides its completed tasks. |
| **Sort order** | A task's `X-APPLE-SORT-ORDER`, the field the Tasks app's manual sort uses. Drag order is stored here. |
| **Subtask** | A task linked under another task rather than directly under the project. Shown nested, up to three levels. |
| **Test container** | A throwaway Nextcloud with the same Tasks version as live, seeded with fixture lists, used for every check. |
| **Unordered task** | A task with no sort order (often agent-filed). Sits below ordered tasks, newest last, until the first drag. |
| **Untagged parent** | A task that has children but no `project` category. Listed in the Needs filing tray. |
| **"+N deeper"** | The note at the third level of nesting that counts hidden deeper tasks and opens that task in Tasks. |
