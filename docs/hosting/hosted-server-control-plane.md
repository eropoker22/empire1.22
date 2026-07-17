# Hosted server control plane

## Ownership boundaries

Netlify serves static browser assets and short request/response functions. It authenticates admin users, reads durable monitoring data, and appends create or lifecycle requests. A Netlify function never owns a game tick loop and never treats its process-local `ServerApp` registry as hosted authority.

PostgreSQL owns admin users and sessions, player accounts and sessions, server memberships, spawn reservations, setup/leave jobs and events, hosted instance metadata, idempotency records, provisioning jobs, lifecycle requests, snapshots, command persistence, worker heartbeats, and leases.

The hosted runtime worker is an always-on Node 20 process. It claims jobs with database locking, provisions a canonical runtime, restores snapshots, owns per-instance leases, ticks running instances, persists snapshots, and writes heartbeats. Multiple workers may run, but only the valid lease owner may tick an instance.

## Local PostgreSQL

Start the development database:

```powershell
docker compose -f docker-compose.hosted-dev.yml config
docker compose -f docker-compose.hosted-dev.yml up -d postgres
docker compose -f docker-compose.hosted-dev.yml ps
npm run db:migrate
npm run db:migrate:status
```

The compose database uses trust authentication bound only to `127.0.0.1` for isolated local development. Do not expose that port or reuse this configuration outside local development.

Local commands load the ignored `.env.local` file. Configure PostgreSQL drivers, generated session and snapshot secrets, the local owner credentials, feature flags, worker identity, region, and `EMPIRE_PUBLIC_ORIGIN=http://127.0.0.1:5173` there. Verify `git check-ignore .env.local` before continuing. Never commit this file.

## Bootstrap owner

The initial closed-alpha username is `Erik22`. Supply the password only through a non-committed local environment or a secret manager:

```powershell
$env:EMPIRE_ADMIN_BOOTSTRAP_USERNAME='Erik22'
$env:EMPIRE_ADMIN_BOOTSTRAP_PASSWORD='<ADMIN_BOOTSTRAP_PASSWORD>'
$env:EMPIRE_ADMIN_BOOTSTRAP_ROLE='owner'
$env:EMPIRE_ADMIN_BOOTSTRAP_DISPLAY_NAME='Erik'
npm run admin:bootstrap-user
```

The bootstrap command verifies migration status, normalizes the username, generates a random salt, derives a `scrypt` hash, and writes an audit entry. It never prints the password, hash, salt, or database URL. Re-running it updates safe profile fields but does not replace the password.

Rotate the password through environment input, never a command-line password argument:

```powershell
$env:EMPIRE_ADMIN_NEW_PASSWORD='<NEW_ADMIN_PASSWORD>'
npm run admin:rotate-password -- --username=Erik22
```

Rotation increments `passwordVersion` and revokes existing sessions.

## Worker startup

Apply migrations and bootstrap the owner before starting the worker. Configure the worker with secrets from the hosting platform:

```powershell
$env:EMPIRE_HOSTED_WORKER_ID='worker-eu-central-1'
$env:EMPIRE_HOSTED_WORKER_REGION='eu-central'
$env:EMPIRE_BUILD_SHA='<DEPLOY_SHA>'
npm run dev:hosted-worker
```

Run the local API and admin page in separate terminals:

```powershell
npm run dev:hosted-api
npm run dev:admin -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/admin.html`. The development API listens on `127.0.0.1:8787`, and Vite proxies `/api` to it. The worker health endpoint is `http://127.0.0.1:8080/health`.

For a container deployment build `Dockerfile.hosted-worker`. The final image runs as the non-root `node` user, exposes `/health` on port 8080, handles `SIGTERM`, and contains no secrets.

## Enabling writes

All three flags are false by default and must be explicitly enabled:

```text
EMPIRE_ADMIN_WRITES_ENABLED=true
EMPIRE_HOSTED_CONTROL_PLANE_ENABLED=true
EMPIRE_SERVER_PROVISIONING_ENABLED=true
```

Also configure `EMPIRE_ADMIN_FINGERPRINT_SECRET`, the allowed/public origin, PostgreSQL, current migrations, and a live worker. Run `npm run verify:hosted-control-plane` in strict mode before exposing write controls. Without PostgreSQL, current migration history, or a fresh worker heartbeat, the API returns a fail-closed unavailable code and the browser cannot fall back to an in-memory server.

## Create server flow

The admin wizard submits only mode, display name, region, capacity, join policy, and canonical map composition. The server generates `serverInstanceId` and `worldSeed`. An `Idempotency-Key` is mandatory.

One PostgreSQL transaction reserves the idempotency key, inserts the base and hosted instance records in `REQUESTED`, inserts one provisioning job, and appends the admin audit record. The API responds `202 Accepted`; it does not create a runtime.

The worker claims the job, changes the state to `PROVISIONING`, acquires a lease, uses the canonical server creation and map validation code, persists the tick-zero snapshot, and finishes in `LOBBY` with joins closed. A retry reuses the same world seed and snapshot identifier, so it cannot create a second initial seed.

For the verified local fixture, create `Local Free Alpha 1` in mode `free`, region `eu-central`, capacity `4`, with joins closed. The canonical map contains 161 districts including 8 Downtown districts. Wait for `REQUESTED -> PROVISIONING -> LOBBY` and `WORKER ONLINE` before opening joins.

## Durable join reservations

Hosted matchmaking requires an account identity and an `Idempotency-Key`. The API locks the hosted server row in one PostgreSQL transaction, validates lifecycle and join policy, counts committed registrations and unexpired reservations, checks capacity, and inserts one reservation plus one outbox job. A concurrent request for the final slot receives `SERVER_FULL`.

The API reports a reserved join as preparing; it never reports the player joined before the worker commits it. Under the runtime lease, the worker restores the latest snapshot, creates or reuses the durable player registration, adds membership idempotently, saves the snapshot, creates the durable join ticket, and commits the reservation. Claimed jobs can be reclaimed after lease expiry. Reservations expire after a finite interval and release their slot.

The production player path does not call this compatibility matchmaking route. It uses the account-session lobby flow below. `EMPIRE_LEGACY_MATCHMAKING_ENABLED` must remain unset in production; enable it only for the isolated pending-join compatibility smoke.

## Player account and lobby entry

`login.html` creates or resumes an HttpOnly account session. Passwords, account IDs, player IDs, faction choices, avatars, capacity, and server state are never accepted as browser authority. Registration can be opened for a closed-alpha deployment with `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED=true` and a SHA-256 invite hash in `EMPIRE_CLOSED_ALPHA_INVITE_CODE_HASH`.

`lobby.html` reads `/api/lobby/overview`. Můj gang, available servers, membership history, capacity, join policy, and active membership come from PostgreSQL. No static server catalog, guest identity, fake online count, or localStorage membership is used by the production page.

Selecting a server loads `/api/lobby/servers/:serverInstanceId/spawn-districts`. The canvas only renders the returned district IDs. Clicking a district is a local preview; `POST /api/lobby/spawn-confirm` with an `Idempotency-Key` atomically locks the server, verifies the snapshot revision, capacity and district, then creates one `setup_required` membership, committed slot reservation, district reservation, and membership event.

`faction.html` finalizes the membership with canonical faction, avatar ID, and server-specific color. It never creates starter inventory in the browser. The worker claims the activation job under the runtime lease, creates the Core Player, claims the exact reserved district, applies starter state once, saves the snapshot, records activation, and changes the membership to `active`. A reconnect obtains a fresh one-use join ticket from the owned active membership.

Returning from `game.html` to lobby does not mutate membership or revoke sessions. Account logout revokes account and gameplay sessions but retains membership. Early leave is a separate server request and uses the authoritative first-start timestamp; before start or during the first 60 real minutes it releases setup reservations or queues active-player cleanup. After the deadline the API rejects leave regardless of browser time.

## Lifecycle operations

Operators may create servers, open or close joins, start, pause, resume, and request a safe restart. Only owners may stop a server. Every request requires an authenticated HttpOnly admin session, same-origin JSON request, idempotency key, expected version, reason, feature gates, current PostgreSQL schema, and a fresh worker.

`open-joins` is accepted only after provisioning with a snapshot and live worker. `close-joins` blocks new reservations without disconnecting current players. `pause` saves a snapshot and stops ticking. `resume` reacquires the lease before ticking. `restart` saves and restores the same snapshot, server ID, world seed, map, players, tick, and command results. `stop` saves state, closes joins, releases the lease, and retains all durable data.

Reset, hard delete, grants, player edits, district ownership edits, and conflict result edits are intentionally absent.

## Outages and rollback

During worker outage, durable servers remain visible as `WORKER STALE` or `NO WORKER`; writes remain unavailable and no server is reported running solely because an HTTP request succeeded. After worker recovery, lease expiry allows another worker to restore the latest snapshot.

During database outage, login, monitoring, create, and lifecycle requests fail closed. Do not enable an in-memory production fallback.

Verify local recovery without removing the volume:

```powershell
docker compose -f docker-compose.hosted-dev.yml stop postgres
docker compose -f docker-compose.hosted-dev.yml start postgres
docker compose -f docker-compose.hosted-dev.yml ps
```

The API must report `ADMIN_DATABASE_UNAVAILABLE`, the worker health endpoint must return `503`, and both must recover after PostgreSQL becomes healthy. To verify process recovery, stop and restart `dev:hosted-api` and `dev:hosted-worker`; the admin account, hosted server, snapshots, registrations, and world seed must remain unchanged.

For application rollback, stop or drain the new worker, deploy the previous request/function build, and retain migrations `007`, `008`, `009`, `010`, and all durable data. Database migrations are additive; do not drop hosted or membership tables during an application rollback.

## Production readiness gate

Before a public rollout, all of these must be live-verified against the target PostgreSQL and hosting environment: migration status, active owner account, durable session and audit repositories, create idempotency under concurrency, provisioning retry, snapshot restore, worker heartbeat, lease failover, no double tick, public registry filtering, and the complete lifecycle E2E. Code-level or in-memory test success is not a deployment.

Run strict local verification with the ignored environment loaded:

```powershell
$env:EMPIRE_HOSTED_PREFLIGHT_STRICT='1'
npm run verify:hosted-control-plane
npm run test:persistence:postgres
npm run test:persistence:postgres:smoke
npm run test:hosted-join:postgres
npm run test:player-entry:postgres
```

Strict mode verifies live connectivity, every migration checksum, the active owner, durable account/session, join reservation, membership/job/event and snapshot tables, PostgreSQL persistence drivers, fresh worker heartbeat, and an acquire/release tick lease probe. A skipped PostgreSQL test is not a pass.
