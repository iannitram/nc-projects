# 0008. What a project card shows

- Status: accepted
- Date: 2026-10-23; depth, progress and cancelled 2026-10-26
- Grilling decisions: 8

## Context
A card has to show enough to work from without becoming the Tasks app.

## Decision
Open tasks with collapsible subtasks up to three levels; a "+N deeper" note at level three that opens that task in Tasks; a done/total progress bar counting every task at every level under the project, across lists, leaving cancelled tasks out of both numbers; a "show done" toggle for completed tasks (ADR 0019).

## Consequences
Nothing is silently hidden. The "+N deeper" note needs the Tasks deep-link format (roadmap P00(b)).
