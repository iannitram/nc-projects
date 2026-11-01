Stage: Dev Loop
Since: 2026-10-26
Kind: own
Spec: SPEC.md   Roadmap: ROADMAP.md   Code map: CODE_MAP.md
Platforms: mac, windows, linux (desktop and phone browsers; the server side is any Nextcloud 33 host)
Notes: Skeleton, CI on Mac, PC and Linux and the lockfiles are in. 2026-10-26: 10 tickets merged (#2, #5-#12, #15: area discovery, dav reads and writes, task model, tree builder, sort order, store load); the panel view (#13) is in review as PR #43. 22 open issues (#3-#4, #13, #14, #16-#27, #34, #39-#42, #44). #3 (P00(d)) needs a Docker host and is claimed. #39, #40 wait on craft-bugreport-web #12; #41-#44 wait on craft-nc-appstore. 2026-10-31: Phase 4 (Today and the wheel, M23-M26) is on the roadmap as P18-P23: issues #152-#174. Free now (nothing blocking): #152 (fixtures), #153 (Task description and location), #154 (day.js), #158 (undo stack), #165 (seeded pick), #169 (events), #171 (timeline maths), #172 (NOW card); the rest wait on those by `Blocked by`. 13 are Easy with locked tests; views, the store and the calendar read are Medium and are checked on the test container (R12). #174 is Phase 4's design pass, the last stage before 1.0 with #102.

Stages: Proposal -> Spec -> Roadmap -> Dev Loop -> Prototype / Beta.
What each stage means and who moves a project: the pipeline repo's PIPELINE.md (private).
The Project Manager updates this file when the stage changes and adds a CHANGELOG line.
