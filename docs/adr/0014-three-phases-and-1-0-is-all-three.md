# 0014. Three phases, and 1.0 is all three

- Status: accepted
- Date: 2026-10-23; 1.0 scope 2026-10-26
- Grilling decisions: 17

## Context
The work splits naturally into view and reorder, then move and edit, then tidy-up.

## Decision
Phase 1: view, add, reorder. Phase 2: move, quick edits, new project. Phase 3: the Needs filing tray. 1.0 is reached only when all three are built and pass their checks.

## Consequences
Phase 1 alone can be dogfooded early, but the 1.0 release waits for phases 2 and 3.
