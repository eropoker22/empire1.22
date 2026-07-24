# Closed-alpha staging runbook

## Status and scope

This runbook prepares a production-like staging environment. It does not authorize creating paid services, changing
DNS, enabling production registration, mutating the production database, or inviting public testers.

Proposed staging origin: `https://alpha.empirestreets.cz`.

Until DNS and a custom certificate are explicitly approved, use the dedicated Netlify staging site's HTTPS
`*.netlify.app` origin and put that exact origin in `EMPIRE_PUBLIC_ORIGIN` and `EMPIRE_ALLOWED_ORIGINS`.

The staging database must be a new database with credentials and durable records that are not shared with
`empirestreets.cz`. The account, admin, gameplay and throttle secrets must also be staging-only.

## Audited architecture

| Component | Locally works | Hosting prepared | Deployed version | Blocker |
| --- | --- | --- | --- | --- |
| Frontend | Yes, generated `client/` | Netlify publish contract exists | Not live-verified | Dedicated staging site and origin |
| API/Functions | Yes, bundled Function | Netlify routes exist | Not live-verified | Staging Functions env and HTTP route checks |
| PostgreSQL | Local Docker only | Repositories and migrations 001-015 exist | Not provisioned | Separate TLS staging database |
| Worker | Node 20 bundle and Dockerfile | Always-on Docker contract exists | Not deployed | Approved provider and paid-plan decision |
| Admin | Durable auth/control plane exists | Owner bootstrap and diagnostics exist | Not live-verified | Owner bootstrap and live SHA parity |
| DNS/TLS | Production redirects exist | Proposed `alpha` hostname | Not configured | Explicit DNS approval |
| Backups | Commands documented below | Provider backup policy required | Not verified | Database and secure backup location |
| Monitoring | Heartbeats and safe health exist | Provider alert mapping below | Not configured | Provider service and notification target |

## Canonical component split

- Netlify serves static frontend files and the bundled `gameplay-slice` Function.
- PostgreSQL stores accounts, sessions, control-plane records, memberships, commands, snapshots, leases and results.
- The hosted worker is an always-on Node 20 Docker process. It must not run as a Netlify Function.
- Frontend, Function and worker use one exact 40-character `EMPIRE_BUILD_SHA`.
- Admin writes fail closed when the API or worker SHA is missing or when they differ. The browser also hides write
  controls unless its embedded frontend SHA matches the API and worker.

## Worker provider comparison

Prices change and must be rechecked before creating a paid resource.

| Provider | Always-on | Docker | Health/restart | Logs/rollback | Small-worker cost | Assessment |
| --- | --- | --- | --- | --- | --- | --- |
| Railway | `Always` restart on paid plans | Yes | HTTP healthcheck and restart policy | Deployment logs and image rollback retention | Hobby minimum is currently USD 5/month including USD 5 usage, then usage-based | Recommended for the first staging worker |
| Render | Background worker or private service | Yes | Background workers lack HTTP health checks; private/web services support platform health checks; graceful shutdown up to 300s | Dashboard logs and zero-downtime deploys | Background workers have no free plan; confirm current Starter price | Good alternative, but use a private service if platform health probing is required |
| Fly.io | One always-running Machine with autostop disabled | Yes | Machine restart policy and service checks | CLI/API deployment control; external log retention may be needed | European shared 1x is roughly USD 2-6/month for 256MB-1GB, plus usage | Lowest raw compute cost, highest operational burden |

Recommendation: Railway Hobby for the first single worker, with `restartPolicyType=ALWAYS`, one replica, a hard usage
limit and a region near the selected PostgreSQL. This recommendation does not create an account or billable service.

Official references:

- <https://docs.railway.com/pricing/plans>
- <https://docs.railway.com/deployments/restart-policy>
- <https://docs.railway.com/pricing/cost-control>
- <https://render.com/docs/background-workers>
- <https://render.com/docs/health-checks>
- <https://render.com/docs/blueprint-spec>
- <https://fly.io/docs/about/pricing/>
- <https://fly.io/docs/launch/autostop-autostart/>

## Required staging environment

Never paste values into tickets, Git, screenshots or command output. Generate separate random values with at least
32 bytes of entropy:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Run it independently for each secret and store the result directly in the provider secret manager.

| Variable | Component | Required | Safe format | Initial staging state |
| --- | --- | --- | --- | --- |
| `EMPIRE_RELEASE_ENVIRONMENT` | build tooling | Yes | Exact `staging` environment marker | `staging` |
| `NODE_ENV` | API, worker | Yes | `production` | Required |
| `EMPIRE_PUBLIC_ORIGIN` | frontend, API | Yes | Exact staging HTTPS origin | Missing until site exists |
| `EMPIRE_ALLOWED_ORIGINS` | API | Yes | Comma-separated exact HTTPS origins | Missing until site exists |
| `EMPIRE_DATABASE_URL` | API, worker, migration job | Yes | PostgreSQL TLS URL with `sslmode=require` or stronger | Missing |
| `EMPIRE_PERSISTENCE_DRIVER` | API, worker | Yes | `postgres` | Missing on hosting |
| `GAMEPLAY_PERSISTENCE_DRIVER` | API, worker | Yes | `postgres` | Missing on hosting |
| `GAMEPLAY_SLICE_SESSION_SECRET` | API, worker | Yes | Unique 64 hex or 43+ base64url | Missing |
| `GAMEPLAY_SLICE_SNAPSHOT_SECRET` | API, worker | Yes | Unique 64 hex or 43+ base64url | Missing |
| `EMPIRE_ADMIN_FINGERPRINT_SECRET` | API | Yes | Unique 64 hex or 43+ base64url | Missing |
| `EMPIRE_AUTH_THROTTLE_PEPPER` | API | Required before registration | Unique 64 hex or 43+ base64url | Missing |
| `EMPIRE_BUILD_SHA` | frontend, API, worker | Yes | Exact lowercase 40-character Git SHA | Set per release |
| `EMPIRE_HOSTED_WORKER_ID` | worker | Yes | Stable staging-specific ID | Missing |
| `EMPIRE_HOSTED_WORKER_REGION` | worker | Yes | Provider region near DB | Missing |
| `EMPIRE_ADMIN_WRITES_ENABLED` | API | Yes | Explicit `false` or `true` | Start `false` |
| `EMPIRE_HOSTED_CONTROL_PLANE_ENABLED` | API | Yes | Explicit `false` or `true` | Start `true` |
| `EMPIRE_SERVER_PROVISIONING_ENABLED` | API | Yes | Explicit `false` or `true` | Start `false` |
| `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED` | API | Yes | `false` until all live gates pass | Start `false` |
| `EMPIRE_ADMIN_BOOTSTRAP_USERNAME` | migration/operator job | Bootstrap only | Non-secret normalized username | Missing |
| `EMPIRE_ADMIN_BOOTSTRAP_PASSWORD` | migration/operator job | Bootstrap only | Unique password from secret manager | Missing |
| `EMPIRE_ADMIN_BOOTSTRAP_ROLE` | migration/operator job | Bootstrap only | `owner` | Missing |

Validate without exposing values:

```powershell
npm run verify:staging-env
```

Only after every live preflight is green may the operator validate an open registration configuration:

```powershell
npm run verify:staging-env -- --allow-registration-enabled
```

## Release build

Requirements:

- clean Git worktree;
- Node 20 from `.node-version`;
- `npm ci` from `package-lock.json`;
- no `.env.local` in the build context;
- one exact `EMPIRE_BUILD_SHA` for every component.

Build:

```powershell
npm ci
npm run generate:browser-config
npm run check:browser-config
npm run build:staging:release
docker build --build-arg EMPIRE_BUILD_SHA=$env:EMPIRE_BUILD_SHA `
  --tag "empire-hosted-worker:$env:EMPIRE_BUILD_SHA" `
  --file Dockerfile.hosted-worker .
```

`npm run release:staging:manifest` writes `artifacts/release-manifest.json`. It refuses an invalid staging
environment, a dirty worktree, or a SHA that differs from `HEAD`. The artifact contains no secrets.

Without hosting credentials, `npm run release:staging:manifest:code-level` creates the same public metadata artifact
from a clean SHA without simulating DB or secret readiness. Its `verificationMode` is `code-level`; it is not evidence
of a deployed staging environment.

## External mutation approval plan

Before performing the first external mutation, present and approve this exact scope:

1. Netlify: create or select one dedicated staging site for the approved SHA.
2. Hostname: initially use the site's HTTPS `netlify.app` hostname; `alpha.empirestreets.cz` requires a separate DNS
   approval.
3. PostgreSQL: create one empty staging database, never the production database; cost depends on the chosen provider.
4. Worker: create one paid always-on Railway service from `Dockerfile.hosted-worker`; expected minimum is USD 5/month
   plus usage beyond the included credit.
5. DNS: no DNS change in the initial provider-hostname stage.
6. Rollback: close registration and joins, disable provisioning, drain worker, retain DB/snapshots, restore all three
   components to the same previous compatible SHA, rerun strict preflight, then reopen writes.

Any different provider, hostname, database, price or DNS mutation needs new approval.

## Database creation, backup and migration

Use a limited runtime role. It must not be a superuser or create roles/databases. If the provider supports separate
credentials, use a migration role for schema changes and a runtime role for the application.

For a new database, record exactly:

```text
NEW EMPTY STAGING DATABASE
```

For an existing staging database, create a pre-migration backup:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
pg_dump --format=custom --no-owner --no-acl `
  --file "$env:SECURE_BACKUP_DIR\empire-staging-$stamp.dump" `
  "$env:EMPIRE_DATABASE_URL"
Get-Item "$env:SECURE_BACKUP_DIR\empire-staging-$stamp.dump" | Select-Object Length
Get-FileHash -Algorithm SHA256 "$env:SECURE_BACKUP_DIR\empire-staging-$stamp.dump"
```

Do not store the dump inside the repository. A zero-byte file is not a backup.

Migration sequence:

```powershell
npm run db:migrate:status
npm run db:migrate
npm run db:migrate:status
```

Expected: migrations `001` through `015`, checksum parity, no unknown migration and `pending: 0`.

Concurrent migration drill, only against a new disposable staging-test database:

```powershell
$first = Start-Process npm -ArgumentList "run","db:migrate" -PassThru -NoNewWindow
$second = Start-Process npm -ArgumentList "run","db:migrate" -PassThru -NoNewWindow
$first.WaitForExit()
$second.WaitForExit()
if ($first.ExitCode -ne 0 -or $second.ExitCode -ne 0) { throw "Concurrent migration failed." }
npm run db:migrate:status
```

The migration runner takes transaction-scoped advisory lock `1843771153`, rechecks history under the lock and writes
the migration plus its checksum in the same transaction.

## Restore drill

Run against a separate disposable restore database:

1. Create one account, membership, hosted server, tick-0 snapshot and known command in staging-test.
2. Create a custom-format backup and checksum.
3. Create a new empty restore database.
4. Run `pg_restore --clean --if-exists --no-owner --no-acl`.
5. Point `EMPIRE_DATABASE_URL` only at the restore database.
6. Run `npm run db:migrate:status`.
7. Query safe counts and IDs for the account, membership, hosted server and snapshot metadata.
8. Start a disposable worker and verify restore, heartbeat, lease and tick continuation.
9. Delete only the disposable restore database after evidence is recorded.

Never restore over the source staging database for this drill.

## Connection budget

- Each warm Netlify Function process uses at most 4 pool connections.
- Netlify pool idle timeout is 10 seconds, connect timeout 5 seconds, statement timeout 15 seconds and
  `allowExitOnIdle=true`.
- The worker uses at most 4 connections, idle timeout 10 seconds, connect timeout 5 seconds and statement timeout
  30 seconds.
- Migration tooling is short-lived and closes its pool.
- Because multiple Function isolates can exist, the provider connection limit must exceed worker plus anticipated
  concurrent Function pools. Start with a provider pooler if it is available and document the direct URL for
  migrations versus pooled URL for Functions.

No automatic query retry is used for non-idempotent writes. Clients retry only with the same idempotency/command ID.

## Deployment order

1. Keep registration, admin writes and provisioning disabled.
2. Provision the empty staging DB and record backup status.
3. Apply migrations and verify status.
4. Bootstrap one owner without printing the password.
5. Deploy frontend and Function from the approved SHA.
6. Deploy worker image tagged with the same SHA.
7. Verify public API readiness, schema and safe route responses.
8. Verify worker health, heartbeat freshness, incarnation and lease.
9. Confirm frontend/API/worker SHA parity in admin.
10. Enable admin writes and provisioning.
11. Create one closed 2-player `control` server and verify tick-0 snapshot.
12. Run cookie and two-browser acceptance.
13. Enable staging registration only after every required live gate is green.

## Route acceptance

Check the deployed HTTPS origin, never localhost:

```text
GET  /api/health
GET  /api/account/registration-policy
POST /api/account/register
POST /api/account/login
GET  /api/account/session
POST /api/account/logout
GET  /api/lobby/overview
POST /api/lobby/spawn/select
POST /api/lobby/spawn/confirm
POST /api/lobby/setup/finalize
GET  /api/lobby/membership
POST /api/lobby/early-leave
POST /api/lobby/join-ticket
POST /api/gameplay-slice/join
GET  /api/gameplay-slice/load
POST /api/gameplay-slice/submit
GET  /api/gameplay-slice/poll
GET  /api/admin/control-plane
POST /api/admin/servers
POST /api/admin/servers/:id/actions
GET  /api/lobby/results
```

The public health response may expose only the safe readiness summary
(`status`, `code`, `database`, `schema`, and `buildSha`) and must return HTTP
503 when PostgreSQL or the schema contract is unavailable.

For every write, preserve the canonical cookie, CSRF/origin and idempotency requirements. A route that returns an HTML
404 is a failed Function deployment.

## Browser and cookie acceptance

Use two isolated browser contexts. Inspect response headers, not browser JavaScript:

- account cookie: host-only, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`;
- admin cookie: host-only, `HttpOnly`, `Secure`, `SameSite=Strict`, admin API path;
- gameplay cookie: separate host-only `HttpOnly` cookie scoped to gameplay API;
- staging cookies must not be sent to `empirestreets.cz`;
- logout revokes account session while preserving membership.

On the staging hostname, `?runtimeMode=local-demo` must not enable demo mode. Delete local/session storage and verify
that the HttpOnly session restores the same account, membership, player, district and resources.

## Two-player acceptance evidence

Record only safe IDs and timestamps:

1. Create the closed control server with capacity 2 and minimum ready 2.
2. Verify start at 1/2 fails.
3. Open a server-time registration window for 60 minutes.
4. Register accounts A and B through the public form using separate contexts.
5. Select different districts and different setup values.
6. Verify two account IDs, sessions, memberships, player IDs and districts.
7. Verify ready count 2/2 and start the server.
8. Open `game.html` in both contexts and verify `server-authoritative`.
9. Run the narrow gameplay smoke and one A-to-B interaction.
10. Verify cross-client polling without full-page reload.
11. Test repeated command IDs, lost response and refresh.
12. Delete local/session storage and reload both clients.
13. Capture tick, snapshot ID, ownership, cash, jobs, Heat and command count.
14. Stop the worker, wait for heartbeat expiry, start a fresh container and compare state.
15. Restart/redeploy Functions without DB changes and verify session/lobby continuity.

Do not call this PASS if either account is guest, mock, localStorage-backed or pre-seeded.

## Health and alerts

Public API readiness returns only safe status, schema availability and a safe error code. It must not expose a DB URL
or secret. The worker `/health` endpoint returns 200 only while the process loop is healthy and not shutting down.

During graceful shutdown the worker writes `draining` and then `stopped`. A running server cannot have a null lease
because migration `007` enforces `running => lease`; therefore a running lease is fenced by incarnation and expires
after its 20-second TTL instead of being cleared immediately. Do not start the replacement until the old heartbeat is
stale or the old lease is no longer valid.

Configure provider alerts for:

- worker process restart or repeated crash;
- worker heartbeat older than 30 seconds;
- DB unavailable;
- migration mismatch;
- snapshot older than the accepted tick interval;
- command error spike;
- registration error spike.

Use an email or secret provider webhook. Never commit the webhook URL.

## Backup policy

- automated daily provider backup with at least 7 days retention;
- manual verified backup before every migration;
- restore drill before the first external tester and after material schema changes;
- snapshot persistence is not a replacement for a database backup;
- keep backup checksums and restore evidence outside Git.

## Rollback

1. Set `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED=false`.
2. Close joins on every staging server.
3. Set `EMPIRE_SERVER_PROVISIONING_ENABLED=false`.
4. Drain the worker and wait for the active durable step and snapshot.
5. Preserve the database and every snapshot; do not reverse migrations blindly.
6. Deploy frontend, Function and worker from one previous compatible SHA.
7. Run migration status and strict preflight.
8. Verify fresh heartbeat, lease, SHA parity and restored state.
9. Re-enable admin writes, provisioning and registration in that order only when green.

Never fall back to local demo, reset the database, force-push an old commit or mix component SHAs.

## Release and opening checklist

Proposed tag after successful live acceptance: `closed-alpha-staging-0.1.0`. Do not create or push it without explicit
approval.

Before inviting the first tester, record:

- deployed SHA and migration `001-015`;
- verified and unverified flows;
- backup checksum and restore result;
- rollback SHA;
- worker alert destination;
- legal/privacy P0 ownership;
- exact registration open/close time;
- operator responsible for closing registration and joins.
