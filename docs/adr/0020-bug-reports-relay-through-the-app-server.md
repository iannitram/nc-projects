# 0020. Bug reports relay through the app server

- Status: accepted
- Date: 2026-10-28

## Context

The owner replaced issue #39's plan to pass the File Drop base and token to the page with “Relay through the app's server”.

## Decision

Port the reviewed nc-outliner relay. The browser sends one report zip to a signed-in, CSRF-protected Projects route. PHP reads the File Drop configuration and forwards the bytes with redirects disabled. Drop settings never enter the app page or relay responses. Admin settings may show the configured base and token status, but never the saved token.

## Consequences

This is the owner's authorized exception to ADR 0002's page-only server. Task data still uses browser CalDAV. Reports require explicit consent in craft-bugreport-web; working data is optional for each report. The relay caps uploads at 10 MB and counts at most five accepted forwarding attempts per user per hour.
