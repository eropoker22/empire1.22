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
- `bootstrap_admin=true` only for the first owner bootstrap.

The workflow serializes staging releases and performs:

1. exact clean checkout and Node 24 dependency install;
2. protected input and staging validator checks;
3. direct/pooled database target and transaction-pool smoke;
4. Neon pre-migration snapshot;
5. optional one-time empty-history initialization;
6. pending migration status, single migration application, strict current status;
7. frontend/API build, asset manifest, worker bundle, and immutable worker image;
8. Netlify deploy with registration closed;
9. one Fly worker deploy with direct TLS PostgreSQL;
10. API/worker health and source/build/deployed asset parity;
11. optional one-owner bootstrap, remote initial login, password rotation, idempotent rerun, and owner verification;
12. authenticated admin control-plane SHA/security check;
13. strict hosted control-plane verification and release artifact upload.

Expected artifact: `staging-release-<SHA>`. It must contain the release manifest, asset manifest, safe backup evidence,
API health, worker health, remote release parity, and admin control-plane evidence. Creation of configuration without
this successful artifact is not a deployment pass.

## Remote staging acceptance

After the deploy artifact is green, dispatch `Staging Remote Acceptance` with:

- the same exact `sha`;
- its successful `staging_deploy_run_id`;
- `soak_minutes` from 120 through 240; default 180.

The workflow first opens a maximum 23-hour registration window by exact timestamp, verifies it remotely, and later
forces registration closed again. It uses only staging fixture-write approval and staging database target pinning.

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

Expected final artifact: `staging-remote-final-<SHA>`, with registration closed. Missing telemetry, a skip, a failed
cleanup/archive, an open registration window, or any privacy leak is `STAGING NO-GO`.

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

With registration closed, dispatch `Staging Rollback Rehearsal` using the candidate deploy run, remote acceptance run,
and a previous compatible staging SHA that has both a Netlify deploy and immutable Fly image. The workflow must
temporarily restore the previous code, prove health, return to the candidate, and prove complete asset/SHA parity
without restoring the database.

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
- successful rollback rehearsal and candidate restoration;
- registration closed in the final artifact;
- no remaining P0 and no undocumented P1.

Absent credentials, provider resources, DNS/TLS, or remote artifacts produce `BLOCKED BY CREDENTIALS` or
`STAGING NO-GO`, never a simulated `GO`.

## Production handoff

Only a green, closed `staging-remote-final-<SHA>` and `staging-rollback-final-<SHA>` can enter the guarded
`Deploy Production` workflow. Production still requires its own protected database, snapshot, validator, exact
approved SHA, domain/TLS, observability evidence, rollback pointers, and post-deploy smoke with registration false.
