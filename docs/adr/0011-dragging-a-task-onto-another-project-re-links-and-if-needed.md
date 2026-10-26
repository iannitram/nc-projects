# 0011. Dragging a task onto another project re-links and, if needed, moves it

- Status: accepted
- Date: 2026-10-23
- Grilling decisions: 7, 23

## Context
Tasks nests a child correctly only when it is on its parent's list.

## Decision
Dropping a task on another project changes its parent link. If that project is on another list, the task also moves to that list, and its subtasks come with it.

## Consequences
Needs CalDAV MOVE. `@nextcloud/cdav-library` 2.6.2 supports it and accepts an `If-Match` header; it keeps the old etag afterwards, so the app re-reads the task.
