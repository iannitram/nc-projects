# 0001. Its own Nextcloud app, named Projects

- Status: accepted
- Date: 2026-10-23
- Grilling decisions: 1, 19

## Context
The owner wants a project view over Nextcloud Tasks. Options were forking Tasks, a page outside Nextcloud, or a new app.

## Decision
Build a separate Nextcloud app with display name "Projects" and app id `cc_projects`, opened from the top bar.

## Consequences
No fork to keep in sync with Tasks upstream. The app must read the same CalDAV data Tasks does and leave it valid for Tasks.
