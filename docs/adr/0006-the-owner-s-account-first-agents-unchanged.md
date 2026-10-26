# 0006. The owner's account first; agents unchanged

- Status: accepted
- Date: 2026-10-23
- Grilling decisions: 4

## Context
Agents file tasks through CalDAV helpers today.

## Decision
Build for the owner's account in the browser. Agents keep using CalDAV; the app adds no API for them.

## Consequences
The app must round-trip every property it does not edit, including agents' `X-CC-*` and `X-FORK-*` fields (spec M15).
