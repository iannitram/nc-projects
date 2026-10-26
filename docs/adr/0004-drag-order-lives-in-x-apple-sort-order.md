# 0004. Drag order lives in X-APPLE-SORT-ORDER

- Status: accepted
- Date: 2026-10-23
- Grilling decisions: 3, 21

## Context
Tasks' manual sort already uses `X-APPLE-SORT-ORDER`, and phone clients read it.

## Decision
Store drag order in `X-APPLE-SORT-ORDER` on each task, touching only tasks that moved except for a one-time renumber when gaps run out. Tasks with no value sit at the bottom, newest last, until the first drag in that project gives them one.

## Consequences
The order matches Tasks and phones only if the app uses Tasks' own convention, so it must be confirmed before order code (roadmap P00(a)).
