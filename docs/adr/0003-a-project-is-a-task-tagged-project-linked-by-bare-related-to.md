# 0003. A project is a task tagged `project`, linked by bare RELATED-TO

- Status: accepted
- Date: 2026-10-23
- Grilling decisions: 2, 5, 12

## Context
Projects already exist as parent tasks tagged `project`, with children linked by bare `RELATED-TO:<uid>` (PARENT by default in RFC 5545), as agents write them.

## Decision
Only the `project` category makes a project. A task belongs to its parent through bare `RELATED-TO`; the app writes it bare, never with `RELTYPE`. No migration.

## Consequences
Every existing project shows on day one. Parents with children but no tag are not projects; they go to the Needs filing tray (ADR 0013).
