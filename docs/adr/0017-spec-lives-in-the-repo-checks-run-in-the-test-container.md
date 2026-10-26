# 0017. Spec lives in the repo; checks run in the test container

- Status: accepted
- Date: 2026-10-26
- Grilling decisions: new

## Context
Build jobs run where only the repo is visible; the vault holds status.

## Decision
The spec, glossary and decision records live in this repo; the vault's project page keeps status and links here. Every Must's check runs in the test container on fixture lists, as a script or repeatable steps.

## Consequences
The repo's notes for coding sessions point here for decisions. No check ever touches live data.
