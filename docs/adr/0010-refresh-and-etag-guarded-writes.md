# 0010. Refresh and etag-guarded writes

- Status: accepted
- Date: 2026-10-23
- Grilling decisions: 22

## Context
Agents, Tasks and phones edit the same data while the panel is open.

## Decision
Refresh on tab focus and every couple of minutes by comparing etags, not reloading everything. Every write sends `If-Match`; a refusal reloads that task and shows a quiet notice, never retries blind.

## Consequences
No silent overwrites. The panel can briefly show stale data between refreshes.
