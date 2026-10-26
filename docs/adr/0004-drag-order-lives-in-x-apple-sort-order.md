# 0004. Drag order lives in X-APPLE-SORT-ORDER, using Tasks' own rule

- Status: accepted
- Date: 2026-10-23; rule matched to Tasks 2026-10-26
- Grilling decisions: 3, 21

## Context
Tasks' manual sort already uses `X-APPLE-SORT-ORDER`, and phone clients read it. Reading Tasks 0.18.1 showed that a task with no value is placed by its creation time (seconds from 2001-01-01 to CREATED), not at the bottom, and that a drag gives the moved task its neighbour's number ±1 and bumps later colliding siblings.

## Decision
Store drag order in `X-APPLE-SORT-ORDER` and copy Tasks' rule exactly: the same default for tasks with no value, the same neighbour ±1 placement, the same bump. (This replaces the 2026-10-23 wording "unordered tasks sit at the bottom, newest last, until the first drag", decided 2026-10-26.)

## Consequences
Projects and Tasks never show different orders. New tasks, including agent-filed ones, still land at the bottom, newest last; an old task with no value can sit mid-list, as it does in Tasks. A drag can write a few bumped siblings as well as the moved task.
