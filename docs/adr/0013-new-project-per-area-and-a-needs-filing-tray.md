# 0013. + New project per area, and a Needs filing tray

- Status: accepted
- Date: 2026-10-23
- Grilling decisions: 12, 14

## Context
Projects are created by agents and by hand today; some tasks are orphaned or have untagged parents.

## Decision
Each area has "+ New project", creating a `project`-tagged task on that area's list, the same shape agents create. A Needs filing tray lists orphans (link to a missing or completed parent) and untagged parents, with "make project" and "move to project".

## Consequences
"Move to project" reuses the re-link of ADR 0011.
