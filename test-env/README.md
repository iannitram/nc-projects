# Test container

A throwaway Nextcloud for building and checking Projects. Every Must's check in [SPEC.md](../SPEC.md) runs here, never on the live server.

- **Same versions as live:** Nextcloud 33.0.10 and Tasks 0.18.1.
- **Separate from live:** compose project `nc-projects-test`, its own volume, bound to `127.0.0.1` only, on the port in `NC_TEST_PORT` (default 8089). It never touches the live Nextcloud's compose project or volumes.
- **Made-up data only:** three accounts (`owner`, `other`, `agent`; password `<name>-test-only`) and the fixture lists from the spec's fixture table.

## Run it

On any machine with Docker, from the repo root:

```
bash test-env/setup.sh
```

Then open http://127.0.0.1:8089 (or your `NC_TEST_PORT`) and log in as `owner` / `owner-test-only`.

- Start clean: the same command with `bash test-env/reset.sh`. It removes only `nc-projects-test` and its volume.
- Stop it: `docker compose -p nc-projects-test -f test-env/compose.yaml stop`.
- Another port (if 8089 is taken): set `NC_TEST_PORT`. Another registry, if Docker Hub rate-limits: `NC_IMAGE=mirror.gcr.io/library/nextcloud:33.0.10-apache`.
- Tasks from a local folder instead of the release download: `TASKS_APP_DIR=<folder holding appinfo/>`.

## Recover

When the container has stopped or the test server answers 503 (for example after a Docker restart or a cut-off `occ upgrade`), run from the repo root:

```
bash test-env/recover.sh
```

It starts the container only if it is not running, waits for `/status.php`, turns maintenance mode off if it is on (or the server answers 503), runs `occ upgrade` only if `/status.php` says `needsDbUpgrade`, and prints the status. It is safe to run at any time and never removes the volume.

## Deploy a new build without `occ upgrade`

From the repo root:

```
bash scripts/deploy-test.sh
```

It runs `npm ci && npm run build`, copies `appinfo/ lib/ templates/ img/ js/ css/` into `cc_projects` in the **test** container, runs `occ app:enable cc_projects`, and bumps the theming cachebuster. It refuses any container that is not compose project `nc-projects-test`; there is no live-install script.
Before copying, it stops if the container has a newer installed version than `appinfo/info.xml`. After deploy, it checks `/status.php` and runs `test-env/recover.sh` if maintenance mode or upgrade is needed.

Nextcloud serves app JS with a 6-month immutable cache keyed on the app version plus the theming cachebuster, so the script's bump is what makes browsers load the new build. It never changes `<version>` in `appinfo/info.xml`: a version change forces `occ upgrade` (and an interrupted one leaves maintenance mode on; see Recover).

`npm run build` writes `js/cc_projects-main.mjs` and `css/cc_projects-style.css` (both git-ignored). `templates/main.php` loads them with `script()` and `style()`; the built file names have no content hash of their own. If a browser still holds an old copy, hard reload: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac), or clear the site data for `http://127.0.0.1:<port>`.

## Docker and podman

Docker's `restart: unless-stopped` brings the test container back after the Docker daemon restarts. Rootless podman has no daemon, so after a reboot it needs the user service `podman-restart.service` enabled: `systemctl --user enable podman-restart.service`. That is the machine owner's choice, not done by these scripts.

**Tested:** Passed 2026-10-26 on a Windows 11 Docker host (Docker 29.9.2) with NC_TEST_PORT=8099: Nextcloud 33.0.10, Tasks 0.18.1 (pinned release), Deck 1.17.8 (app store), users and fixture lists seeded; first run hit a SQLite 'database is locked' on user:add, now retried.

`setup.sh` warns loudly if Tasks isn't exactly 0.18.1. Checks that compare with Tasks aren't valid until that's fixed.

## What's in it

| Owner sees | URI | Why |
|---|---|---|
| The eight areas (Personal, The Channel, Van, Barnum, Cheltenham, DCIS, DPS, System) | `personal-1`, a UUID, `van`, `barnum-2`, … | URIs differ from names on purpose: areas match by display name |
| "Personal", the account's default calendar | `personal` | **Events only.** A trap: area discovery must keep only lists that hold tasks (VTODO), as Tasks does |
| "Shared by another person" | `shared-list_shared_by_other` | Must be ignored (shared by another account) |
| "Agent queue" | `queue_shared_by_agent` | Must be ignored (agent queue) |
| "Test board" from Deck | `app-generated--deck--board-<id>` | Must be ignored. `setup.sh` fails if Deck cannot be installed |

The 78 fixture tasks follow the spec's fixture table, with fixed UIDs (`area-0`, `cross-proj`, `chain-l4`, `mix-old`, `agentf-task`, `orphan`, …) and file names `f-<uid>.ics`. The source of truth is `fixtures()` in `seed.py`.

## Reading a stored task

```
scripts/dav-get.sh <list-uri> <file.ics> [user]
scripts/dav-get.sh personal-1 f-mix-old.ics
```

This prints the raw iCalendar. Diff two runs to compare a task before and after a change.

## Safety

`seed.py` refuses any host but `127.0.0.1` or `localhost`. The passwords are test-only and the port is bound to localhost.
