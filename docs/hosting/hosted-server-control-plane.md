# Hosted server control plane

## Current launch decision: code-ready, deployment unproven

The hosted control-plane implementation now closes the previously identified code-level authority gaps:

- cold gameplay Function processes load ready hosted metadata and the latest PostgreSQL snapshot before join, load, submit, or command-result access;
- hosted ticks and HTTP commands serialize through the same per-instance atomic transaction boundary;
- snapshot persistence rejects stale root versions and divergent writes at the same root version;
- provisioning and lifecycle workers use claim/version/expiry fencing, and successful lifecycle completion also requires the worker's live runtime lease;
- production startup uses one exact migration filename/checksum contract;
- the game page enables visibility-aware five-second polling with failure backoff.

This is not proof that the public deployment is ready. The actual Netlify Functions environment, target database migration state, production secrets, deployed JSON routes, and live hosted worker have not been verified on `empirestreets.cz`. Real-player registration and its final account-to-gameplay session boundary are intentionally deferred and must remain closed. War mode remains closed.

## Ownership boundaries

The target boundary is: Netlify serves static browser assets and short request/response functions. It authenticates players and admins, reads durable state, validates sessions, and submits account, lobby, admin, and gameplay operations. A Netlify function never owns a game tick loop and must never treat its process-local `ServerApp` registry or a browser snapshot token as hosted authority.

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

Local Node commands load the ignored `.env.local` file, and the `runtime-worker` Compose service imports the same file. Configure both PostgreSQL drivers, generated session and snapshot secrets of at least 32 characters with different values, the local owner credentials, feature flags, worker identity, region, and `EMPIRE_ALLOWED_ORIGINS=http://127.0.0.1:5173` there. `EMPIRE_PUBLIC_ORIGIN` does not satisfy the gameplay CSRF allowlist. Verify `git check-ignore .env.local` before continuing. Never commit this file.

Minimum Netlify Functions configuration:

```text
NODE_ENV=production
EMPIRE_DATABASE_URL=<POSTGRES_CONNECTION_STRING>
EMPIRE_PERSISTENCE_DRIVER=postgres
GAMEPLAY_PERSISTENCE_DRIVER=postgres
GAMEPLAY_SLICE_SESSION_SECRET=<UNIQUE_SECRET_AT_LEAST_32_CHARACTERS>
GAMEPLAY_SLICE_SNAPSHOT_SECRET=<DIFFERENT_SECRET_AT_LEAST_32_CHARACTERS>
EMPIRE_ALLOWED_ORIGINS=https://empirestreets.cz
EMPIRE_ADMIN_FINGERPRINT_SECRET=<SECRET_AT_LEAST_32_CHARACTERS>
EMPIRE_ADMIN_WRITES_ENABLED=true
EMPIRE_HOSTED_CONTROL_PLANE_ENABLED=true
EMPIRE_SERVER_PROVISIONING_ENABLED=true
EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED=false
EMPIRE_LEGACY_MATCHMAKING_ENABLED=false
```

Minimum hosted worker configuration:

```text
NODE_ENV=production
EMPIRE_DATABASE_URL=<POSTGRES_CONNECTION_STRING>
EMPIRE_PERSISTENCE_DRIVER=postgres
GAMEPLAY_PERSISTENCE_DRIVER=postgres
GAMEPLAY_SLICE_SESSION_SECRET=<SAME_SESSION_SECRET_USED_BY_FUNCTIONS>
GAMEPLAY_SLICE_SNAPSHOT_SECRET=<SAME_SNAPSHOT_SECRET_USED_BY_FUNCTIONS>
EMPIRE_HOSTED_WORKER_ID=<STABLE_WORKER_ID>
EMPIRE_HOSTED_WORKER_REGION=eu-central
EMPIRE_BUILD_SHA=<DEPLOY_SHA>
```

For local development, replace the allowed origin with the actual loopback origin used by the browser.

## Database migrations

Apply every migration in filename order and verify checksums before starting the API or worker:

```text
001_initial_runtime_persistence.sql
002_command_reservations.sql
003_gameplay_identity_sessions.sql
004_atomic_command_execution.sql
005_gameplay_identity_session_invariants.sql
006_admin_read_only_control_plane.sql
007_hosted_server_control_plane.sql
008_hosted_join_reservations.sql
009_player_entry_control_plane.sql
010_runtime_instance_foreign_keys.sql
011_hosted_runtime_lease_incarnation.sql
```

`npm run db:migrate:status` must report the complete current set. `PRODUCTION_MIGRATION_CONTRACT` is also enforced by API/worker readiness and requires the exact ordered filename/checksum set; missing, modified, extra, or unavailable history fails closed. A partially applied schema is a deployment failure, not a degraded mode.

Migration `011` changes runtime lease authority. Drain every pre-`011` worker before applying it, then deploy only the matching API and worker builds; do not run old and new worker binaries together during this rollout.

## Netlify routes and environment

The deployed route contract is:

- `/api/servers` -> the public server catalog handler
- `/api/account/*` -> account registration, login, session, and logout handlers
- `/api/lobby/*` -> lobby overview, spawn selection, membership, and server-entry handlers
- `/api/gameplay-slice/*` -> gameplay join, load, submit, result, and logout handlers
- `/api/admin/*` -> authenticated admin handlers

Verify these routes in both `netlify.toml` and the built deploy artifact. A JSON API returning the static HTML 404 page is a failed deployment.

Set all database credentials, session secrets, snapshot secrets, origin allowlists, and feature flags through the Netlify UI, CLI, or API with Functions scope. Environment values declared in `netlify.toml`, including `[build.environment]`, are not available to Functions at runtime. Netlify exposes only its documented read-only runtime values such as `URL`, `SITE_NAME`, and `SITE_ID`; see [Netlify Functions environment variables](https://docs.netlify.com/build/functions/environment-variables/). Redeploy after changing runtime environment values.

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
$env:EMPIRE_PERSISTENCE_DRIVER='postgres'
$env:GAMEPLAY_PERSISTENCE_DRIVER='postgres'
$env:GAMEPLAY_SLICE_SESSION_SECRET='<UNIQUE_SECRET_AT_LEAST_32_CHARACTERS>'
$env:GAMEPLAY_SLICE_SNAPSHOT_SECRET='<DIFFERENT_SECRET_AT_LEAST_32_CHARACTERS>'
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

Also configure `EMPIRE_ADMIN_FINGERPRINT_SECRET`, `EMPIRE_ALLOWED_ORIGINS`, both PostgreSQL drivers, distinct session and snapshot secrets, current migrations, and a live worker. Run `npm run verify:hosted-control-plane` in strict mode before exposing write controls. `EMPIRE_PUBLIC_ORIGIN` is not accepted as a CSRF allowlist fallback. Without PostgreSQL, current migration history, production-ready gameplay sessions, or a fresh worker heartbeat, the API must fail closed and the browser must not fall back to an in-memory server.

## Create server flow

The admin wizard submits only mode, display name, region, capacity, join policy, and canonical map composition. The server generates `serverInstanceId` and `worldSeed`. An `Idempotency-Key` is mandatory.

One PostgreSQL transaction reserves the idempotency key, inserts the base and hosted instance records in `REQUESTED`, inserts one provisioning job, and appends the admin audit record. The API responds `202 Accepted`; it does not create a runtime.

The worker claims the job, acquires a lease, changes the state to `PROVISIONING`, uses the canonical server creation and map validation code, persists the tick-zero snapshot, and finishes in `LOBBY` with joins closed. Begin, completion, and failure accept only the current claimed worker incarnation, job version, unexpired claim, and matching live runtime lease. A delayed or superseded worker cannot overwrite a reclaimed job. A retry reuses the same world seed and snapshot identifier, so it cannot create a second initial seed.

For the verified local fixture, create `Local Free Alpha 1` in mode `free`, region `eu-central`, capacity `20`, with joins closed. Free capacity must exceed the canonical Final Lockdown trigger so the server cannot enter its endgame on the first tick. The canonical map contains 161 districts including 8 Downtown districts. Wait for `REQUESTED -> PROVISIONING -> LOBBY` and `WORKER ONLINE` before opening joins. Keep the server in `LOBBY` until the active roster also exceeds that canonical trigger; the worker rejects an unsafe start.

## Durable join reservations

Hosted matchmaking requires an account identity and an `Idempotency-Key`. The API locks the hosted server row in one PostgreSQL transaction, validates lifecycle and join policy, counts committed registrations and unexpired reservations, checks capacity, and inserts one reservation plus one outbox job. A concurrent request for the final slot receives `SERVER_FULL`.

The API reports a reserved join as preparing; it never reports the player joined before the worker commits it. Under the runtime lease, the worker restores the latest snapshot, creates or reuses the durable player registration, adds membership idempotently, saves the snapshot, creates the durable join ticket, and commits the reservation. Claimed jobs can be reclaimed after lease expiry. Reservations expire after a finite interval and release their slot.

The production player path does not call this compatibility matchmaking route. It uses the account-session lobby flow below. `EMPIRE_LEGACY_MATCHMAKING_ENABLED` must remain unset in production; enable it only for the isolated pending-join compatibility smoke.

## Player account and lobby entry

`login.html` creates or resumes an HttpOnly account session. Passwords, account IDs, player IDs, faction choices, avatars, capacity, and server state are never accepted as browser authority. Public account registration can be opened with `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED=true`; it does not use invitations. Every new account supplies a nick, gang name, date of birth, and the password twice. PostgreSQL time is authoritative for the minimum age of 16 years, and production registration additionally requires durable auth throttling through `EMPIRE_AUTH_THROTTLE_PEPPER`.

`lobby.html` reads `/api/lobby/overview`. Můj gang, available servers, membership history, capacity, join policy, and active membership come from PostgreSQL. No static server catalog, guest identity, fake online count, or localStorage membership is used by the production page.

Selecting a server loads `/api/lobby/servers/:serverInstanceId/spawn-districts`. The canvas only renders the returned district IDs. Clicking a district is a local preview; `POST /api/lobby/spawn-confirm` with an `Idempotency-Key` atomically locks the server, verifies the snapshot revision, capacity and district, then creates one `setup_required` membership, committed slot reservation, district reservation, and membership event.

`faction.html` finalizes the membership with canonical faction, avatar ID, and server-specific color. It never creates starter inventory in the browser. The worker claims the activation job under the runtime lease, creates the Core Player, claims the exact reserved district, applies starter state once, saves the snapshot, records activation, and changes the membership to `active`. A reconnect obtains a fresh one-use join ticket from the owned active membership.

Returning from `game.html` to lobby does not mutate membership or revoke sessions. Account logout revokes account and gameplay sessions but retains membership. Early leave is a separate server request and uses the authoritative first-start timestamp; before start or during the first 60 real minutes it releases setup reservations or queues active-player cleanup. After the deadline the API rejects leave regardless of browser time.

## Lifecycle operations

Operators may create servers, open or close joins, start, pause, resume, and request a safe restart. Only owners may stop a server. Every request requires an authenticated HttpOnly admin session, same-origin JSON request, idempotency key, expected version, reason, feature gates, current PostgreSQL schema, and a fresh worker.

`open-joins` is accepted only after provisioning with a snapshot and live worker. `close-joins` blocks new reservations without disconnecting current players. `pause` saves a snapshot and stops ticking. `resume` reacquires the lease before ticking. `restart` saves and restores the same snapshot, server ID, world seed, map, players, tick, and command results. `stop` saves state, closes joins, releases the lease, and retains all durable data.

Lifecycle completion and failure first lock the current `processing` action request. The worker ID, action-request version, and claim expiry must still match; successful completion additionally requires the same worker to own a non-expired runtime lease. Reclaimed or delayed actions return without mutating newer server state.

Running instances use `tickInstanceDurably`. Each tick reloads the latest snapshot inside the same PostgreSQL server-row transaction used by commands, advances the root version, saves before publishing runtime state/events, and leaves in-memory state unchanged if persistence fails. Snapshot repositories accept exact idempotent rewrites but reject stale or divergent equal-version payloads.

Reset, hard delete, grants, player edits, district ownership edits, and conflict result edits are intentionally absent.

## Outages and rollback

During worker outage, durable servers must remain visible as `WORKER STALE` or `NO WORKER`; writes must remain unavailable and no server may be reported running solely because an HTTP request succeeded. Cold API hydration from hosted metadata plus the latest snapshot is implemented and regression-tested, but recovery after a fully cold API and worker restart still requires live verification against the target deployment.

During database outage, login, monitoring, create, and lifecycle requests fail closed. Do not enable an in-memory production fallback.

Verify local recovery without removing the volume:

```powershell
docker compose -f docker-compose.hosted-dev.yml stop postgres
docker compose -f docker-compose.hosted-dev.yml start postgres
docker compose -f docker-compose.hosted-dev.yml ps
```

The API must report `ADMIN_DATABASE_UNAVAILABLE`, the worker health endpoint must return `503`, and both must recover after PostgreSQL becomes healthy. To verify process recovery, stop and restart `dev:hosted-api` and `dev:hosted-worker`; the admin account, hosted server, snapshots, registrations, and world seed must remain unchanged.

For application rollback, stop or drain the new worker, deploy the previous request/function build, and retain every applied migration from `001` through `011` plus all durable data. Database migrations are additive; do not drop hosted or membership tables during an application rollback.

## Production readiness gate

Before a public rollout, all of these must be live-verified against the target PostgreSQL and hosting environment: migration status, active owner account, durable session and audit repositories, create idempotency under concurrency, provisioning retry, snapshot restore, worker heartbeat, lease failover, no double tick, public registry filtering, and the complete lifecycle E2E. Code-level or in-memory test success is not a deployment.

Implemented locally and still requiring deployment acceptance:

- cold Function hydration from hosted metadata and the latest snapshot without client snapshot authority;
- worker tick and HTTP command serialization through one database-backed boundary, including rollback-safe publishing and snapshot CAS;
- provisioning/lifecycle claim fencing, per-process runtime-lease incarnation fencing, and rolling-worker heartbeat fencing under retries and delayed workers;
- exact production migration-contract rejection for missing, changed, extra, or unavailable history;
- visibility-aware gameplay polling enabled at five seconds with bounded failure backoff.

The remaining launch gate requires:

- the real-player registration and account/gameplay-session entry boundary, intentionally deferred and disabled for now;
- the actual Netlify Functions environment, target PostgreSQL migration contract, deployed routes, and live worker heartbeat to pass strict verification;
- polling verified between at least two independent deployed clients;
- account and gameplay logout revocation verified together;
- `/api/account/*`, `/api/lobby/*`, `/api/gameplay-slice/*`, `/api/admin/*`, and `/api/servers` returning the expected JSON contracts on the deployed domain;
- a closed Free test with multiple real clients before any public link is shared.

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

It also requires a valid `EMPIRE_ALLOWED_ORIGINS` allowlist and two distinct secrets of at least 32 characters. Strict preflight does not by itself prove the deployed cold path, real database race behavior, browser synchronization, or the deferred player registration/session boundary; those remain separate mandatory release tests.
