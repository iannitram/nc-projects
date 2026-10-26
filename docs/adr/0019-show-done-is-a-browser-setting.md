# 0019. "Show done" is remembered in this browser only

- Status: accepted
- Date: 2026-10-26
- Grilling decisions: new

## Context
Tasks keeps "hide completed subtasks" on each task (`X-OC-HIDECOMPLETEDSUBTASKS`), so it syncs. Projects could write the same field or keep its own setting.

## Decision
The per-project "show done" toggle is remembered in this browser and writes nothing to the task data.

## Consequences
No extra writes and no effect on Tasks. The setting doesn't follow the owner to another device or browser.
