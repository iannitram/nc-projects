# Test container

A throwaway Nextcloud for building and checking Projects. Every Must's check in [SPEC.md](../SPEC.md) runs here, never on the live server.

- **Same versions as live:** Nextcloud 33.0.10 and Tasks 0.18.1.
- **Separate from live:** compose project `nc-projects-test`, its own volume, bound to `127.0.0.1:8089` only. It never touches the live Nextcloud's compose project or volumes.
- **Made-up data only:** three accounts (`owner`, `other`, `agent`; password `<name>-test-only`) and the fixture lists from the spec's fixture table.

## Run it

On any machine with Docker, from the repo root:

```
bash test-env/setup.sh
```

Then open http://127.0.0.1:8089 and log in as `owner` / `owner-test-only`.

- Start clean: the same command with `bash test-env/reset.sh`. It removes only `nc-projects-test` and its volume.
- Stop it: `docker compose -p nc-projects-test -f test-env/compose.yaml stop`.
- Another port: set `NC_TEST_PORT`. Another registry, if Docker Hub rate-limits: `NC_IMAGE=mirror.gcr.io/library/nextcloud:33.0.10-apache`.
- Tasks from a local folder instead of the release download: `TASKS_APP_DIR=<folder holding appinfo/>`.

`setup.sh` warns loudly if Tasks isn't exactly 0.18.1. Checks that compare with Tasks aren't valid until that's fixed.

## What's in it

| Owner sees | URI | Why |
|---|---|---|
| The eight areas (Personal, The Channel, Van, Barnum, Cheltenham, DCIS, DPS, System) | `personal-1`, a UUID, `van`, `barnum-2`, … | URIs differ from names on purpose: areas match by display name |
| "Personal", the account's default calendar | `personal` | **Events only.** A trap: area discovery must keep only lists that hold tasks (VTODO), as Tasks does |
| "Shared by another person" | `shared-list_shared_by_other` | Must be ignored (shared by another account) |
| "Agent queue" | `queue_shared_by_agent` | Must be ignored (agent queue) |
| "Test board" from Deck | `app-generated--deck--board-<id>` | Must be ignored. Only made when Deck installs |

The 78 fixture tasks follow the spec's fixture table, with fixed UIDs (`area-0`, `cross-proj`, `chain-l4`, `mix-old`, `agentf-task`, `orphan`, …) and file names `f-<uid>.ics`. The source of truth is `fixtures()` in `seed.py`.

## Reading a stored task

```
scripts/dav-get.sh <list-uri> <file.ics> [user]
scripts/dav-get.sh personal-1 f-mix-old.ics
```

This prints the raw iCalendar. Diff two runs to compare a task before and after a change.

## Safety

`seed.py` refuses any host but `127.0.0.1` or `localhost`. The passwords are test-only and the port is bound to localhost.
