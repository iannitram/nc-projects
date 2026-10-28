# NC Projects: design brief (nc-projects#102)

Status: **for the owner's approval.** No code has changed. The mockups are in `mockups.html` next to this file, sections a–g. Written 2026-10-28 from `main` at `b858493`.

## Assumptions (made without asking)

1. **One page stays one page.** Spec M1 says the panel shows one section per area, so the new navigation is a table of contents: clicking an area scrolls to it and hides nothing. "All areas" is the default and only "view".
2. **Priority is shown the way the Tasks app shows it:** as the checkbox outline colour (high red, medium amber, low blue). This is the most native signal we have, and it costs no extra widget.
3. **"Move to project" has two ways in:** drag (M17) and a "Move to project…" dialog. The dialog is the route for keyboard and phone users, and the tray's button (M20) needs it anyway. Drag stays within projects on the same list for now, because `TaskTree` gives each parent its own drag group. Sharing a group across projects is an implementation issue (#12 in the notes).
4. **Collapsing a project is remembered per project in this browser**, exactly like Show done (localStorage, no task data written). Projects open expanded the first time, so nothing changes until you collapse one.
5. **Checking off a project with open tasks asks once** before cascading (M8 closes every open task under it). That is the only new confirmation.
6. **Nextcloud 33's default theme** is the target. Colours in the mockups are approximations of its variables. The code must use the real `var(--color-…)` names, never the hex values from the mockups.
7. **Sample data only** (Home, Work, Studio, …).
8. **The sibling app.** nc-outliner is being designed in parallel from the same direction. Where the two apps share a pattern (top bar, status line, reading column, row hover controls, disclosure chevrons), they should use the same measurements; implementation issue #17 lines them up.

## What's wrong today (a designer's read of `main`)

**Hierarchy.** Nothing tells you where you are. `App.vue` puts a bare "Projects" heading and a "Choose areas" button loose in the content, with no Nextcloud app navigation and no top bar. Areas exist only as one long scroll. In each card the most important thing, the task title, is the quietest element in its row: every row also carries a boxed date field, a "Clear due date" link, a priority "⋯", and an "Open in Tasks" link.

**Density.** Every control is always visible. With an empty due date, the native date input still reads "mm/dd/yyyy" on every row. Every card has a boxed "+ Add task" field and a "Show done" switch. An area of eight projects carries eight empty inputs and eight switches. Nothing collapses at the project level, so the panel only grows.

**Scaling.** Nothing caps the width. At 1280 px a card header puts its title at the far left and its progress bar, "Show done" switch and unlabelled completion checkbox about 1,000 px to the right. On phones, `projects.css` is a long list of `min-height: 44px` overrides. They make the targets big enough but let each task wrap to three lines (title, then date field, then priority and link).

**Consistency.**
- Disclosure uses text glyphs (▶ ▼), not the Material Design icons the rest of Nextcloud uses.
- Done items fade with opacity, applied twice (a class and an inline style), so a done subtask under a done parent sits at about 0.36 opacity. That is below contrast minimums.
- Someday cards fade the whole card, controls included, so they look disabled rather than parked.
- The project's completion checkbox sits at the far right of its header, but a task's checkbox sits at the left of its row.
- The Done strip comes before "+ New project", so new projects appear to be filed under Done.
- The first-run state says "Choose your areas" twice (a paragraph and a button). The settings dialog has no Cancel and no explanation.

**Missing surfaces.** `NeedsFilingTray.vue` exists but is never mounted, and it has no "Move to project". There is no move control anywhere. Conflict reloads show a toast but don't say which row changed. A load error is plain text with no way to retry.

## Principles

1. **The words are the interface.** A row is a checkbox and a title. Metadata appears only when it carries information: a due date when set, priority as the checkbox colour, a subtask count when collapsed.
2. **Controls appear on intent.** The drag grip and the "⋯" menu show on hover or focus. On touch, where there is no hover, the "⋯" is always visible.
3. **Typography over boxes.** Area headings (18/650), project titles (16/600), tasks (15/400), metadata (13, secondary colour). Projects sit on a soft band, not inside a bordered card.
4. **Native first.** NcAppNavigation, NcAppContent, NcActions, NcDialog, NcEmptyContent, NcCounterBubble, Nextcloud toasts and theme variables. Nothing is styled that Nextcloud already styles.
5. **One reading column.** At most 920 px wide, so a project's title, progress and actions stay together at any window size.
6. **Every Must keeps its control.** Nothing is removed. Some controls move into the "⋯" menu, and each move is listed below.

## Decisions, screen by screen

### Shell (mockup a)
- Add **NcAppNavigation**:
  - "All areas"
  - an "Areas" caption with one item per area (the list colour as a dot, the number of open projects as a counter)
  - a "Tidy up" caption with "Needs filing" and a highlighted counter while anything is waiting
  - a footer with "Report a bug" (M21's planned spot) and "Choose areas"
- Add a **slim top bar** in the content: the title ("All areas"), a muted project count, a "Collapse all" icon button and one primary button, "New project", which asks for the area.
- Add a **status line** at the bottom: "13 open projects · 58 open tasks · Updated 1 min ago". The "updated" part makes the two-minute refresh (M13) visible.

### Area
- An area heading with its project count, then:
  - its open projects in drag order
  - a "Someday" caption with the someday projects
  - a ghost row "New project in Home"
  - the Done strip, last
- **Someday** projects lose the opacity. Their titles use the secondary text colour and their band is transparent. They stay last (M7).

### Project (was: card)
- A header band: drag grip (on hover), disclosure chevron, completion checkbox, title, badges, a compact 64 px bar with "3 of 7", and "⋯" (on hover).
- A collapsed project also shows its **next due date**.
- **Blocked** keeps its red pill (M7).
- The project "⋯" menu holds:
  - Show done tasks (with the count)
  - Check off project… (confirms when there are open tasks)
  - Open in Tasks
  - **Optional, new:** "Mark blocked" and "Move to Someday" (they toggle those categories). Cut them if 1.0 should stay strictly to its Musts.
- Under the tasks: a ghost "+ Add task" row that turns into the input when clicked, and on the right "3 done · Show", which appears only when the project has done tasks. This replaces the per-card "Show done" switch.

### Task row (mockups a, b, d)
- Columns: grip (hover), chevron (if it has subtasks), checkbox with a priority ring, title, metadata, "⋯".
- **Metadata:**
  - The due date as "Fri 31 Oct", shown only when set. Overdue dates are red and bold; dates within a few days use the primary text colour.
  - A collapsed parent shows "3 subtasks".
  - The "+N deeper" note becomes a quiet link: "2 more levels in Tasks ↗".
- **The "⋯" menu** (NcActions):
  - Due date…
  - Clear due date
  - Priority (radio: High, Medium, Low, None)
  - Move to project…
  - Open in Tasks
- **Rename** is unchanged: click the title, Enter saves, Esc cancels. The field matches the row's height, so the list doesn't jump.
- **Done tasks** are struck through in the secondary colour, with no opacity.
- **Subtasks** are indented 24 px with a 1 px guide line.

### Conflict (mockup a)
- The Nextcloud toast stays as it is ("Someone else changed this; reloaded").
- The reloaded row also gets a warning tint and a left edge for about 4 seconds.

### First run and settings (mockup c)
- **First run:** NcEmptyContent. The heading is "Choose your areas", with one sentence on what an area is and that nothing on the lists changes, and one button.
- **The dialog** (NcDialog):
  - a sentence of help
  - one checkbox per list, with the list's colour (and, optionally, its open-task count)
  - a muted note saying how many shared lists, agent queues and Deck boards were left out, and why
  - Cancel and Save
- The dialog must open above the navigation. Today's nc-outliner bug drew the nav over a modal, so this is checked by hand.

### Needs filing and move (mockup d)
- **Needs filing** is its own page, opened from the nav.
  - It has two groups, "Orphan tasks" and "Parents without a project tag", each with a one-line explanation.
  - Each item shows its title, its list (colour dot) and why it's there: "Parent 'Spring clean' is done", "Parent no longer exists", "4 subtasks".
  - Each item has two actions: "Make project" (tertiary) and "Move to project…" (secondary).
- **The Move dialog:**
  - a search field, then projects grouped by area, each with its progress
  - the current project listed but disabled
  - a sentence saying what will happen before you confirm: "Moves under 'Garden shed'. It stays on the Home list." or "…and to the Studio list, with its 2 subtasks."
- **Drag onto a project:**
  - The target band gets a dashed primary outline and the words "Drop to move here".
  - A line shows where the task will land.
  - A "+3" badge on the dragged row shows that its subtasks come along.
  - A drop onto a project on another list asks first, using the same sentence as the dialog.

### Done (mockup e)
- **The Done strip:** "4 done projects" with a chevron, collapsed at first. When expanded, it lists each project with its check-off date. Hovering a project shows "Open in Tasks".
- **Done tasks inside a project:** the footer toggle "N done · Show/Hide".

### Phone, 390 × 844 (mockup f)
- **Rows are the same grammar** at 48 px tall. Every target is at least 44 px. "⋯" is always visible, and the drag grip is hidden: long press is the drag.
- **Dates are short** ("31 Oct"). A collapsed project shows "5/9" with no bar.
- **Long press** (500 ms, as today) lifts the row: it scales to 1.02 with a shadow, the rows part, and a blue line shows where it will land. A one-line hint appears the first few times.
- **Navigation** is Nextcloud's drawer. Menus open as bottom sheets.

### Empty and error (mockup g)
- **An area with no open projects** shows one line ("Nothing open in Studio. Start a project, or tag an existing task as a project in Tasks.") and a "New project in Studio" button. Its Done strip still shows.
- **Needs filing, when empty:** "Everything is filed".
- **A load error:** NcEmptyContent with the reason, reassurance that nothing changed, and "Try again" (it reruns `store.load`).
- **Loading:** skeleton rows under each area heading, not a centred spinner.

## Where each current control went

| Today | Proposed |
|---|---|
| "Choose areas" button in the content | Nav footer "Choose areas"; first-run button |
| Card header "Show done" switch | Project footer "N done · Show"; project menu |
| Card header completion checkbox (far right) | Checkbox at the left of the project band |
| Row date field + "Clear due date" | Date shown when set; menu "Due date…" / "Clear due date" |
| Row priority "⋯" | Checkbox ring colour; menu "Priority" |
| Row "Open in Tasks" link | Row menu "Open in Tasks" |
| "+N deeper" dashed box | "N more levels in Tasks ↗" link |
| Boxed "+ Add task" / "+ New project" | Ghost rows that become inputs on click; top-bar "New project" |
| ▶ ▼ text glyphs | Material chevron icons |
| Tray (not mounted) | "Needs filing" page in the nav |

## Not proposed

Reordering areas, a reopen button in the Done strip, filters or search across tasks, editing anything beyond the M18 quick edits, and a separate view per area. Each would be a new feature, not part of this pass.
