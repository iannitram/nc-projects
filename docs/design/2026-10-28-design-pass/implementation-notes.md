# NC Projects design pass: implementation issues

For the PM to file on `iannitram/nc-projects` **after the owner approves** the mockups (nc-projects#102). Each issue links to #102 and names its mockup section. The sizes use the repo's labels: `size:easy` is under half a day, `size:medium` is about a day, `size:hard` is more than a day or carries a risky behaviour change.

Ground rules for every issue:
- Use Nextcloud theme variables only, never the mockups' hex values.
- Use `@nextcloud/vue` components where one exists.
- Use `vue-material-design-icons` for icons.
- Every interactive element needs an accessible name.
- Check in the test container at 1280 px, at 390 px with touch on, and in dark mode.

Order: 1 → 2 → 3/5/6 in parallel → the rest. Issues 11 and 12 depend on the store's `moveToProject` (the code map still calls it a stub; commit `c502b7a` suggests it has landed, so check).

---

### 1. App navigation: areas as a table of contents, Needs filing, footer
- **Files:** `src/App.vue`, new `src/components/AppNav.vue`, `src/store/projects.js` (area colour + open-project count getters)
- **What:**
  - Add `NcAppNavigation` with:
    - "All areas"
    - an "Areas" caption with one `NcAppNavigationItem` per area (list colour dot, `NcCounterBubble` with the open-project count)
    - a "Tidy up" caption with "Needs filing" (highlighted counter when greater than 0)
    - a footer with "Choose areas" (opens settings) and a slot for M21's `ReportButton`
  - An area item scrolls its section into view. It doesn't filter anything.
- **Size:** medium · **Mockup:** a
- **Done when:**
  - The nav shows every chosen area with its count, and clicking one scrolls to it.
  - The Needs filing counter matches `orphans.length + untaggedParents.length`.
  - The nav collapses to Nextcloud's drawer below 1024 px.
  - Modals open above the nav.

### 2. Top bar, reading column, status line
- **Files:** `src/App.vue`, `src/styles/projects.css`
- **What:**
  - A slim top bar: the "All areas" title, a muted project count, a "Collapse all/Expand all" icon button and a primary "New project" button. That button opens a small area picker, then the title field.
  - The content column is capped at 920 px with 20–24 px side padding.
  - A status line: "N open projects · M open tasks · Updated X ago", using the store's last refresh time.
  - Remove the loose `h2` and the "Choose areas" button.
- **Size:** medium · **Mockup:** a
- **Done when:**
  - Nothing in the content is wider than the column at 1280 or 1920 px.
  - The status line updates after a focus refresh.

### 3. Project band (replaces the card chrome)
- **Files:** `src/components/ProjectCard.vue`
- **What:**
  - The header grid: grip (hover/focus), chevron, completion checkbox, title, badges, a compact 64 px bar with "X of Y", and an `NcActions` "⋯" (hover/focus).
  - Collapsing is per project in localStorage (`cc_projects:collapsed:<uid>`, same try/catch pattern as show-done).
  - A collapsed project shows its next due date.
  - The menu holds: Show done tasks (count), Check off project…, and Open in Tasks.
  - Checking off with open tasks asks first (`NcDialog`: "Check off X and its N open tasks?").
  - No border and no opacity; the band uses `--color-background-hover`-family variables.
- **Size:** hard (it changes a cascade's confirmation path) · **Mockup:** a, b
- **Done when:**
  - The M5–M8 checks still pass.
  - Collapse survives a reload.
  - A keyboard user can reach the checkbox, the chevron and the menu.
  - The confirmation appears only when open tasks exist.

### 4. Optional: "Mark blocked" / "Move to Someday" menu items
- **Files:** `ProjectCard.vue`, `src/store/projects.js` (toggle a category through `updateTask`)
- **Size:** easy · **Mockup:** b
- **Note:** this adds a feature. File it only if the owner keeps it.
- **Done when:** toggling adds or removes the category, round-trips cleanly (M15), and the badge and position update.

### 5. Task row: text first, actions in a menu
- **Files:** `src/components/TaskRow.vue`
- **What:**
  - Remove the always-on `NcDateTimePickerNative`, the "Clear due date" button and the "Open in Tasks" link.
  - The row is a checkbox (border coloured by priority, as in Tasks: 1–4 high, 5 medium, 6–9 low), the title, then metadata (a due chip only when set, overdue in `--color-error-text`), then an `NcActions` menu.
  - The menu holds: Due date… (`NcActionInput type="date"`), Clear due date, Priority (`NcActionRadio` ×4), Move to project…, and Open in Tasks (`NcActionLink`).
  - Rename stays as it is; match the input's height to the row.
  - "+N deeper" becomes the quiet "N more levels in Tasks" link.
  - Keep `cc-no-drag` and the stopped pointer events on everything interactive.
- **Size:** hard · **Mockup:** a, d (menu)
- **Done when:**
  - The M18 checks pass from the menu.
  - `TaskRow.spec.js` and `TaskRow.inlineEdits.spec.js` are updated and green.
  - An empty due date renders nothing.
  - The priority ring matches the Tasks app for the same task.

### 6. Tree: icons, indent guides, done styling
- **Files:** `src/components/TaskTree.vue`
- **What:**
  - Replace ▶/▼ with `ChevronDown`, rotated when collapsed.
  - Indent 24 px per level, with a 1 px guide line.
  - Remove both opacity rules (the class and the inline `:style`); done rows use `--color-text-maxcontrast` and a strike-through.
  - A collapsed parent shows "N subtasks".
- **Size:** easy · **Mockup:** a, e
- **Done when:** a done subtask under a done parent passes 4.5:1, and the tree specs are green.

### 7. Ghost rows for "+ Add task" and "+ New project"
- **Files:** `src/components/AddTaskInput.vue`, `src/components/AreaSection.vue`
- **What:**
  - Each renders as a muted row with a plus icon. A click or Enter turns it into a focused `NcTextField`.
  - Esc or blur with an empty value turns it back.
  - "+ Add task" carries the project's "N done · Show/Hide" toggle on the right (moved from the header).
  - "New project in <Area>" sits above the Done strip.
- **Size:** medium · **Mockup:** a, e
- **Done when:**
  - Add task (M9) and New project (M19) work by mouse and by keyboard.
  - No boxed inputs are visible at rest.

### 8. Someday group and badges
- **Files:** `src/components/AreaSection.vue`, `ProjectCard.vue`
- **What:**
  - A "Someday" caption above the someday projects.
  - No card opacity; titles use `--color-text-maxcontrast`.
  - The blocked pill keeps `--color-error`.
  - A project with no tasks shows "No tasks yet" instead of "0/0".
- **Size:** easy · **Mockup:** a
- **Done when:** the M7 check passes and no element has opacity below 1.

### 9. Done strip
- **Files:** `src/components/DoneStrip.vue`, `AreaSection.vue` (order)
- **What:**
  - The label becomes "N done projects" with a chevron icon.
  - The strip is the last element of the area.
  - Expanded rows show a muted checked checkbox, the title, the completion date (`COMPLETED`, if present) and an "Open in Tasks" icon link on hover/focus.
- **Size:** easy · **Mockup:** e
- **Done when:** the M8 check passes, and the strip starts collapsed and sits below "New project".

### 10. Needs filing page
- **Files:** `src/components/NeedsFilingTray.vue`, `src/App.vue` (route or view state), `src/models/tree.js` (a reason per item: parent completed, parent missing, N subtasks)
- **What:**
  - Mount the tray as the "Needs filing" view from the nav, with a title, a one-line intro and two groups.
  - Each item has its title, its list (colour dot), why it's there, "Make project" (tertiary) and "Move to project…" (secondary).
- **Size:** medium · **Mockup:** d
- **Done when:**
  - The M20 check passes from this page.
  - The item leaves the list after each action.
  - The empty state reads "Everything is filed".

### 11. Move-to-project dialog
- **Files:** new `src/components/MoveToProjectDialog.vue`; it's called from `TaskRow` and `NeedsFilingTray`
- **What:**
  - An `NcDialog` with a search field and projects grouped by area (with progress). The current project is disabled.
  - A consequence line that names the target, any list change and the subtask count.
  - Cancel and Move. Move calls `store.moveToProject`.
- **Size:** medium · **Mockup:** d
- **Done when:**
  - Moving a fixture task within a list and across lists works (M17), and subtasks follow.
  - The consequence line is right in both cases.
  - The dialog works by keyboard only.

### 12. Drag a task onto another project
- **Files:** `src/components/TaskTree.vue`, `src/composables/useDrag.js`
- **What:**
  - Give the top-level task trees in one area a shared Sortable group (with `put` limited to project top levels) so a task can be dropped into another project.
  - On a cross-project drop, call `store.moveToProject` instead of `reorder`; when the lists differ, confirm first with the dialog's sentence.
  - Drop-target styling uses Sortable's `chosenClass`/`ghostClass` plus a class on the target band (dashed primary outline, "Drop to move here"), and a "+N" badge for subtasks.
- **Size:** hard · **Mockup:** d
- **Done when:**
  - Same-project reorders still use the M10 rule.
  - A cross-project drop re-links (and moves lists when needed).
  - A failed write puts the row back.

### 13. First run and area settings dialog
- **Files:** `src/App.vue`, `src/components/AreaSettings.vue`
- **What:**
  - First run: `NcEmptyContent` (icon, "Choose your areas", one sentence, one button).
  - Settings: `NcDialog` with a help sentence, checkboxes with list colours, a muted note counting the excluded shared lists, agent queues and Deck boards, and Cancel + Save.
  - Optional: open-task counts per list, only if they're free from data already loaded.
- **Size:** easy · **Mockup:** c
- **Done when:**
  - Cancel discards changes.
  - Save behaves as today.
  - The dialog draws above the navigation at 1280 and 390 px.

### 14. Phone layout and long-press drag
- **Files:** `src/styles/projects.css` (replace the override block), `TaskRow.vue`, `TaskTree.vue`, `ProjectCard.vue`
- **What:**
  - Use one `@media (max-width: 600px), (pointer: coarse)` block that sets a row-height variable to 48 px and a target variable to 44 px, instead of per-element `min-height` rules.
  - Rows never wrap their controls.
  - "⋯" is always visible on coarse pointers; the grip is hidden there.
  - Lifted-row styles go on Sortable's `chosenClass` (scale 1.02, shadow), the drop line on `ghostClass`.
  - A one-line hint shows the first three long presses (localStorage counter).
  - `NcActions` opens as a bottom sheet (its built-in mobile behaviour).
- **Size:** medium · **Mockup:** f
- **Done when:**
  - The M16 check passes: no sideways scroll at 390 px, and a long press reorders a task.
  - Every target measures at least 44 × 44.

### 15. Empty, loading and error states
- **Files:** `src/App.vue`, `src/components/AreaSection.vue`
- **What:**
  - An empty area shows one line and a "New project in <Area>" button (the Done strip still shows).
  - Loading shows skeleton rows.
  - A load error shows `NcEmptyContent` with "Try again" (calls `store.load()`).
- **Size:** easy · **Mockup:** g
- **Done when:** each state renders in the test container, the last by stopping the DAV endpoint.

### 16. Highlight the row a conflict reloaded
- **Files:** `src/store/projects.js` (record the reloaded uids with a timestamp), `TaskRow.vue`, `ProjectCard.vue`
- **What:** keep the existing toast; rows whose uid was reloaded get a `--color-warning`-tinted background and a left edge for about 4 seconds.
- **Size:** easy · **Mockup:** a
- **Done when:** the M14 check shows both the toast and the tinted row.

### 17. Sibling alignment with nc-outliner, and a dark-mode pass
- **Files:** `src/styles/projects.css`; coordinate with nc-outliner#174
- **What:**
  - Agree one set of shared measurements between the two apps: top bar height, status line style, reading-column max width, row height, hover-control behaviour and chevron icons.
  - Then check every screen in Nextcloud's dark theme and in high-contrast mode.
- **Size:** easy · **Mockup:** b
- **Done when:**
  - Both apps use the same values (recorded in each `CODE_MAP.md`).
  - There are no hard-coded colours (`grep -E '#[0-9a-fA-F]{3,6}' src/` returns only fallbacks inside `var()`).
  - Dark-mode screenshots are attached to #102.
