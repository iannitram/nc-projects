# 0018. Checking off cascades the way the Tasks app does

- Status: accepted
- Date: 2026-10-26
- Grilling decisions: new

## Context
In Tasks 0.18.1, checking off a task also checks off its open subtasks, and reopening a subtask reopens its closed parent. Tasks writes `STATUS:COMPLETED`, a `COMPLETED` date and `PERCENT-COMPLETE:100`.

## Decision
Projects does the same: checking off a task or a project checks off every open task under it, reopening a task reopens its closed parents, and the fields are written as Tasks writes them.

## Consequences
Both apps behave the same. Checking off a project closes all its open work at once (spec M8, M18). Across lists, Projects cascades through every linked child, which Tasks does only for children it has loaded.
