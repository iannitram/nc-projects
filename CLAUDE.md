# nc-projects: notes for coding sessions

- **Read first:** `SPEC.md` (the Musts, Won'ts and 1.0 sentence; the source of truth), `GLOSSARY.md` (terms), `docs/adr/` (decisions and why), `README.md` (overview), `ROADMAP.md` (pick the next Unwritten ID; move rows as PRs open and merge), `CODE_MAP.md` (where code goes and the rules it keeps). Decisions live here in the repo; status lives in the vault at `J:\Nextcloud\Workspaces\NC Projects\PROJECT.md`, which links here.
- **Phase 0 first.** P00's checks (how Tasks writes `X-APPLE-SORT-ORDER`, the deep-link format, MOVE support, the test container) come before any order or move code.
- **Hyperion machine rules apply.** This clone lives at `B:\dev\nc-projects`. Heavy commands (builds, `npm install`, multi-minute test runs) go through the dev gate: `python3 "B:/dev/potn-dev/tools/dev-gate.py" run --who nc-projects --cwd B:/dev/nc-projects -- <one command>` (one command after the `--`, never `cd x && ...`; exit 75 = not now, nothing ran). Full rules: part 1 of `J:\Nextcloud\Workspaces\CLAUDE.md`.
- **Keep code out of the vault.** The vault workspace holds docs only.
- **Develop against the test Nextcloud container.** Installing into the live Nextcloud (copy into `custom_apps/cc_projects`, `occ app:enable`) needs Ian's yes every time. Never touch the `nextcloud` compose project or its volumes.
- **The live data is shared with agents.** Never write to Ian's real task lists from tests or scripts. Fixtures are copied shapes, with no personal content.
- **Commit identity:** `iannitram <4624371+iannitram@users.noreply.github.com>`.
