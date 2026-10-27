# Rules for agents in this repo

Everything you need to work here is in this repo. The full pipeline and rules live in the pipeline repo (private: `PIPELINE.md`, `RULES.md`, `RUBRIC.md`, `roles/`); this is the short copy.

1. **Find the stage** in `PIPELINE.md`. The spec is `SPEC.md` (the Musts, Won'ts and 1.0 sentence; the source of truth), the plan `ROADMAP.md`, the code map `CODE_MAP.md`.
2. **Work from an issue.** Take one that is not `in-progress` and not blocked; add `in-progress` before you start. Its body is your brief; an Easy issue has a "Qwen brief" section with the expected results and the code map snippet.
3. **Your own platform's issues first.** Mac, Windows and Linux all matter: say which you built on.
4. **Check that it builds**, then open the PR. CI and a review by another satellite with another model do the rest.
5. **Label the PR** `by:<machine>` and `model:<model>`, and write `Closes #N`. Move the feature's row in `ROADMAP.md` (Unwritten -> PR -> Merged).
6. **A failed job** gets a comment on the issue saying what happened, and the issue moves up one size (Easy -> Medium -> Hard).
7. **Use the project's words** from `GLOSSARY.md` and the decisions in `docs/adr/`.
8. **No private details** in code, commits or PR text: no names, e-mail addresses, home paths or machine names. Commit as the no-reply identity.

## This project

- **Tasks app reference.** Projects must behave like Nextcloud Tasks 0.18.1. Run `scripts/fetch-tasks-ref.sh` to get its source in `reference/tasks` (git-ignored); what we learned from it is in CODE_MAP §Facts. Check new behaviour against that source, not memory.
- **Phase 0 first.** P00's checks come before any order or move code.
- **Develop against the test Nextcloud container** (compose project `nc-projects-test`, in `test-env/`; `test-env/reset.sh` removes only that). Installing into the live Nextcloud needs the owner's yes every time. Never touch the live Nextcloud's compose project or its volumes.
- **The live data is shared with agents.** Never write to real task lists from tests or scripts. Fixtures are copied shapes, with no personal content.
