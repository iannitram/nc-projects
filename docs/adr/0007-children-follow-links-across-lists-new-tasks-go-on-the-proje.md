# 0007. Children follow links across lists; new tasks go on the project's list

- Status: accepted
- Date: 2026-10-23
- Grilling decisions: 11

## Context
Real projects have children and grandchildren on other lists than the project's own.

## Decision
Show a child under its parent wherever it lives. "+ Add task" creates the task on the project's own list, linked to the project, at its top level.

## Consequences
The tree is built from all eight areas at once, not list by list.
