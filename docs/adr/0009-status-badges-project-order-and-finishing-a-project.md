# 0009. Status badges, project order, and finishing a project

- Status: accepted
- Date: 2026-10-23
- Grilling decisions: 15, 20

## Context
Projects carry `blocked` and `someday` categories already; the owner closes projects by hand.

## Decision
`blocked` shows a red badge; `someday` greys the card and sinks it to the bottom of its area. Projects can be drag-reordered within an area. A project finishes only when the owner checks it off, and then moves to a collapsed Done strip in its area, never automatically at 100%.

## Consequences
Project order uses the same sort-order field as tasks (ADR 0004).
