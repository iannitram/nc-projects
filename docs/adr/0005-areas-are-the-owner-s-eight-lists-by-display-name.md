# 0005. Areas are the owner's eight lists, by display name

- Status: accepted
- Date: 2026-10-23
- Grilling decisions: 9, 10, 13

## Context
The owner's account also sees agent queues, a list shared by another person, and Deck-generated boards.

## Decision
Each of Personal, The Channel, Van, Barnum, Cheltenham, DCIS, DPS and System is an area, matched by display name (URI segments are unreliable). Excluded, always: other people's shared lists, agent queues (`*_shared_by_*`), and Deck boards (`app-generated--deck--*`). No "Crew" area.

## Consequences
Agent work that needs the owner already lands on System. Renaming a list hides it until the area list is updated.
