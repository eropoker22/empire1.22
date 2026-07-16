# Hosted server control plane

## Ownership boundaries

Netlify serves static browser assets and short request/response functions. It authenticates admin users, reads durable monitoring data, and appends create or lifecycle requests. A Netlify function never owns a game tick loop and never treats its process-local `ServerApp` registry as hosted authority.

PostgreSQL owns admin users and sessions, access audit, hosted instance metadata, idempotency records, provisioning jobs, lifecycle requests, snapshots, command persistence, worker heartbeats, and leases.

The hosted runtime worker is an always-on Node 20 process. It claims jobs with database locking, provisions a canonical runtime, restores snapshots, owns per-instance leases, ticks running instances, persists snapshots, and writes heartbeats. Multiple workers may run, but only the valid lease owner may tick an instance.

## Local PostgreSQL

Start the development database:

```powershell
docker compose -f docker-compose.hosted-dev.yml up -d postgres
$env:EMPIRE_DATABASE_URL='postgresql://empire_dev@127.0.0.1:5432/empire_hosted_dev'
npm run db:migrate
npm run db:migrate:status
```

The compose database uses trust authentication bound only to `127.0.0.1` for isolated local development. Do not expose that port or reuse this configuration outside local development.

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

## Lifecycle operations

Operators may create servers, open or close joins, start, pause, resume, and request a safe restart. Only owners may stop a server. Every request requires an authenticated HttpOnly admin session, same-origin JSON request, idempotency key, expected version, reason, feature gates, current PostgreSQL schema, and a fresh worker.

`open-joins` is accepted only after provisioning with a snapshot and live worker. `close-joins` blocks new reservations without disconnecting current players. `pause` saves a snapshot and stops ticking. `resume` reacquires the lease before ticking. `restart` saves and restores the same snapshot, server ID, world seed, map, players, tick, and command results. `stop` saves state, closes joins, releases the lease, and retains all durable data.

Reset, hard delete, grants, player edits, district ownership edits, and conflict result edits are intentionally absent.

## Outages and rollback

During worker outage, durable servers remain visible as `WORKER STALE` or `NO WORKER`; writes remain unavailable and no server is reported running solely because an HTTP request succeeded. After worker recovery, lease expiry allows another worker to restore the latest snapshot.

During database outage, login, monitoring, create, and lifecycle requests fail closed. Do not enable an in-memory production fallback.

For application rollback, stop or drain the new worker, deploy the previous request/function build, and retain migration `007` and all durable data. Database migrations are additive; do not drop hosted tables during an application rollback.

## Production readiness gate

Before a public rollout, all of these must be live-verified against the target PostgreSQL and hosting environment: migration status, active owner account, durable session and audit repositories, create idempotency under concurrency, provisioning retry, snapshot restore, worker heartbeat, lease failover, no double tick, public registry filtering, and the complete lifecycle E2E. Code-level or in-memory test success is not a deployment.
