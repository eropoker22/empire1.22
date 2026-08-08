# Closed-alpha staging runbook

## Status and authority

This runbook deploys one exact Empire Streets release candidate to the isolated public staging environment. It does
not authorize a production cutover, anonymous registration, War, payments, a second worker replica, or use of
production data.

Canonical staging origin: `https://staging.empirestreets.cz`.

The protected GitHub workflows are the executable release authority. Dashboard-only changes are not release
evidence.

## Architecture

- Netlify staging site: frontend, static assets, admin, and Netlify Function API.
- Neon staging project/root branch: staging-only PostgreSQL with TLS and provider snapshots.
- Fly staging app in `fra`: exactly one persistent container from `Dockerfile.hosted-worker`.
- Migration job: direct Neon URL, one invocation from `Deploy Staging` only.
- Netlify Functions: pooled Neon URL for the same staging database.
- Frontend, API, worker, and artifacts: one exact 40-character SHA.

Detailed contracts:

- `docs/deployment/environment-matrix.md`
- `docs/deployment/public-hosted-database-worker-runbook.md`
- `docs/deployment/netlify-dns-and-tls-runbook.md`
- `docs/deployment/admin-bootstrap-and-rotation.md`
- `docs/deployment/observability-and-alerts.md`
- `docs/deployment/rollback-runbook.md`

## Provider preparation

Create isolated staging resources before dispatching a release:

1. Add the custom domain to the staging Netlify site, configure the exact CNAME, and wait for valid TLS.
2. Create the staging Neon project/branch and separate pooled/direct roles or URLs.
3. Enable provider backup/snapshot capability and record the staging project/branch identifiers.
4. Create the Fly staging app; do not create more than one Machine.
5. Create protected GitHub environment `staging` with required reviewer protection where available.
6. Add only the variables and secrets classified for staging in the environment matrix.
7. Configure uptime, database, worker, credit, and registration alerts.

Do not copy production credentials into staging or deploy previews. Never print provider URLs or secrets while
validating configuration.

## Source gate

Freeze a clean exact SHA under Node 24. Record:

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
git log -20 --oneline
node --version
npm --version
```

Run the complete local release gate from an isolated clean worktree. Every command needs an exit code, duration,
skip/retry count, exact SHA, and artifact path. A skipped release-critical test is `NOT RUN`, not `PASS`.

Then run the GitHub `Hosted Acceptance` workflow for the exact SHA. All matrix jobs must complete successfully:

- manual admin/player;
- UI parity and UI parity social;
- Pharmacy, Drug Lab, Factory, and Armory production;
- income;
- building actions day/night;
- non-spawn parity;
- multiplayer visible actions;
- City Events;
- social visible UI and social concurrency/privacy;
- lifecycle stop.

Each job gets its own PostgreSQL service and disposable hosted server and uploads traces, screenshots, logs, and exact
SHA evidence. Any missing or non-success job blocks deployment.

## Deploy Staging

Dispatch `Deploy Staging` with:

- `sha`: exact approved SHA;
- `acceptance_run_id`: successful `Hosted Acceptance` run for that SHA;
- `initialize_database=true` only for the first independently proven-empty staging database;
- `bootstrap_admin=true` only for the first owner bootstrap;
- `leave_registration_open=true` only when deployment must avoid a registration-closing mutation and finish with
  a publicly verified bounded staging window. The default remains fail-closed.

The workflow serializes staging releases and performs:

1. exact clean checkout and Node 24 dependency install;
2. protected input and staging validator checks;
3. direct/pooled database target and transaction-pool smoke;
4. fail-closed Neon project, branch, and read-write endpoint binding to the protected staging target hash;
5. Neon pre-migration snapshot with its source branch and operations bound back to that provider target;
6. optional one-time empty-history initialization;
7. pending migration status, single migration application, strict current status;
8. frontend/API build, asset manifest, worker bundle, and immutable worker image;
9. Netlify deploy with the explicit registration policy: closed by default, or with no closure mutation and a
   publicly verified maximum 23-hour window when `leave_registration_open=true`;
10. one Fly worker deploy with direct TLS PostgreSQL;
11. API/worker health and source/build/deployed asset parity;
12. optional one-owner bootstrap, remote initial login, password rotation, idempotent rerun, and owner verification;
13. authenticated admin control-plane SHA/security check;
14. strict hosted control-plane verification and release artifact upload.

Expected artifact: `staging-release-<SHA>`. It must contain the release manifest, asset manifest, hashed Neon target
binding, safe backup evidence with the same binding hashes, API health, worker health, remote release parity, and
admin control-plane evidence. Creation of configuration without this successful artifact is not a deployment pass.

## Remote staging acceptance

After the deploy artifact is green, dispatch `Staging Remote Acceptance` with:

- the same exact `sha`;
- its successful `staging_deploy_run_id`;
- `soak_minutes` from 120 through 240; default 180;
- an explicit `leave_registration_open` choice. Use `true` only for an approved, time-limited staging playtest window;
  omission or `false` remains fail-closed.

The workflow first opens a maximum 23-hour registration window by exact timestamp, verifies it remotely, and later
enforces the explicitly dispatched final policy. With `leave_registration_open=true`, it verifies the same guarded
window remains open after cleanup; otherwise it closes registration. It uses only staging fixture-write approval and
staging database target pinning.

Required remote evidence covers actual HTTPS browser/server flows, including:

- admin login and disposable server lifecycle;
- three real account registrations and separate faction/avatar/color/spawn setup;
- tick, snapshot, clean/dirty income, population, Heat, Influence, production buildings and reports;
- Spy, Rob, Heist, Attack, Occupy, map effects, City Events, Bounty, Market, Alliance, and private-chat isolation;
- refresh, browser restart, worker restart/redeploy, pause/resume/archive, and return to lobby;
- desktop Chromium, mobile viewport, concurrent sessions, and social privacy;
- a 20-player guarded load/soak with API/command/login/worker latency, PostgreSQL connections, Fly memory/CPU,
  heartbeat, tick, snapshot, 429, and 5xx thresholds.

Remote acceptance must use `https://staging.empirestreets.cz`, never localhost. Quiet Playwright output or a running
process is not a pass; require final summary JSON and successful workflow/artifact status. Flaky retries are disabled
for release suites.

Expected final artifact: `staging-remote-final-<SHA>`, with the explicitly selected registration mode. When the approved
mode is open, the artifact must prove the same validated expiry (at most 23 hours from opening) after cleanup. Missing
telemetry, a skip, a failed cleanup/archive, an unapproved or expired open window, a policy mismatch, or any privacy
leak is `STAGING NO-GO`.

## Soak and observation

The guarded load job is a controlled 20-player staging test. Supplement it with several hours of monitored staging
operation before production approval. Require:

- advancing ticks and recovery-head snapshots;
- heartbeat age at most 30 seconds;
- no duplicated production report or result modal;
- no database pool exhaustion, worker lease loss, session leak, or private-data leak;
- zero 429 and zero 5xx in the release load report;
- latency, database, memory, CPU, and throttling within the tracked thresholds.

Do not run load or soak against `empirestreets.cz`.

## Rollback rehearsal

Run this only after registration is closed. Do not dispatch it while an approved staging registration window must stay
open: the rehearsal deliberately forces registration closed. Once closure is approved, dispatch `Staging Rollback
Rehearsal` using the candidate deploy run, remote acceptance run, and a previous compatible staging SHA that has both
a Netlify deploy and immutable Fly image. The workflow must temporarily restore the previous code, prove health,
return to the candidate, and prove complete asset/SHA parity without restoring the database.

Expected final artifact: `staging-rollback-final-<SHA>`.

## STAGING GO criteria

`STAGING GO` requires all of the following for one exact SHA:

- complete clean local gate;
- successful Hosted Acceptance matrix with no skipped critical suite;
- isolated Neon TLS target, backup, migration checksum parity, and current schema;
- successful Netlify and one-replica Fly deploy;
- frontend/API/worker/source/deployed asset SHA parity;
- owner bootstrap/rotation proof and admin control plane;
- remote gameplay, social concurrency/privacy, mobile, restart, and lifecycle evidence;
- 120-240 minute load/soak workflow plus several-hour observation with no P0;
- tested alerts/log delivery;
- the final artifact matches the explicitly approved registration policy; an open policy includes a valid maximum
  23-hour expiry and is suitable only for staging playtests;
- no remaining P0 and no undocumented P1.

Absent credentials, provider resources, DNS/TLS, or remote artifacts produce `BLOCKED BY CREDENTIALS` or
`STAGING NO-GO`, never a simulated `GO`.

## Production handoff

Before any production handoff, close staging registration and complete the rollback rehearsal. Only a green, closed
`staging-remote-final-<SHA>` and `staging-rollback-final-<SHA>` can enter the guarded
`Deploy Production` workflow. Production still requires its own protected database, snapshot, validator, exact
approved SHA, domain/TLS, observability evidence, rollback pointers, and post-deploy smoke with registration false.
