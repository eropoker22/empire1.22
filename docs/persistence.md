# Runtime Persistence

The server runtime supports three persistence drivers:

- `memory` (default): in-process repositories for tests and local iteration.
- `file`: local durable repositories for command log, event log, diagnostic log, and snapshots.
- `postgres`: production shared persistence for real multiplayer server instances. The first implementation step validates configuration and provides the adapter skeleton; repository methods still need the DB client-backed implementation before production use.

Enable file persistence with environment variables:

```powershell
$env:EMPIRE_PERSISTENCE_DRIVER = "file"
$env:EMPIRE_PERSISTENCE_DIR = ".empire-persistence"
npm run dev:runtime
```

`GAMEPLAY_PERSISTENCE_DRIVER` and `GAMEPLAY_PERSISTENCE_DIR` are accepted as compatibility aliases.

Enable the Postgres/Supabase adapter with:

```powershell
$env:EMPIRE_PERSISTENCE_DRIVER = "postgres"
$env:EMPIRE_DATABASE_URL = "postgres://user:password@localhost:5432/empire"
npm run dev:runtime
```

`GAMEPLAY_PERSISTENCE_DRIVER=postgres` and `GAMEPLAY_DATABASE_URL` are accepted as compatibility aliases. If the selected driver is `postgres` and no database URL is configured, startup fails with a clear configuration error.

## File Format

File persistence writes readable, versioned records:

- `instances/<instance-id>/commands.ndjson`
- `instances/<instance-id>/events.ndjson`
- `instances/<instance-id>/diagnostics.ndjson`
- `instances/<instance-id>/snapshots/latest.json`
- `instances/<instance-id>/snapshots/<snapshot-id>.json`

Log files use newline-delimited JSON envelopes:

```json
{ "schemaVersion": 1, "record": { "...": "..." } }
```

Snapshots use the same envelope shape and include the versioned snapshot DTO.

## Dev Guidance

Use `memory` for unit tests and short-lived local runs. Use `file` when validating process restarts, snapshot restore, or local multiplayer flows where requests may land in separate function invocations. Use `postgres` for any public multiplayer deployment where more than one process, host, or serverless invocation can touch the same battle royale instance.

Without the `postgres` driver, public multiplayer is not production-safe: players may not share one authoritative state across hosts, and concurrent serverless invocations can race ticks, commands, snapshots, and player registrations.

## Postgres Schema

The initial migration lives at:

- `apps/server/src/runtime/persistence/postgres/migrations/001_initial_runtime_persistence.sql`

The proposed production tables are:

- `empire_server_instances`: one row per authoritative server instance, with mode/status metadata and optional lock bookkeeping.
- `empire_command_log`: append-only command audit log keyed by stable command id for idempotence.
- `empire_event_log`: append-only domain/runtime event log.
- `empire_diagnostic_log`: append-only operational diagnostics.
- `empire_snapshots`: immutable versioned snapshot history keyed by snapshot id and `root_version`.
- `empire_snapshot_latest`: one atomically updated latest snapshot pointer/payload per instance.
- `empire_player_registrations`: player/account/session registration records for shared lobby and reconnect flows.
- `empire_tick_locks`: per-instance lock row for distributed ticking.

Every table has a primary key `id`, `server_instance_id`, `schema_version`, `created_at`, a JSONB `payload`, and `updated_at` where updates are expected. The migration adds indexes for instance lookups, append ordering, player lookup, command idempotence, and snapshot version checks.

## Postgres Adapter Contract

`createPostgresRuntimePersistenceRepositories()` must return the same `ServerRuntimePersistenceRepositories` shape as the memory and file adapters:

- `commandLogRepository`
- `eventLogRepository`
- `diagnosticLogRepository`
- `snapshotRepository`

The current vertical slice intentionally exposes only the skeleton and configuration validation. Until the DB client-backed methods are implemented, selecting `postgres` with a valid URL returns repositories that throw an explicit "not implemented" error when used. This prevents accidentally running a production server with fake persistence.

## Tick Lock Design

Before ticking a server instance, the production runtime should acquire a per-instance Postgres lock. Two acceptable approaches are:

- Preferred for the first DB-backed implementation: row lock in a transaction against `empire_tick_locks`.
- Alternative: `pg_try_advisory_xact_lock(hashtext(server_instance_id))` inside the tick transaction.

The row-lock flow should be:

```sql
BEGIN;

SELECT *
FROM empire_tick_locks
WHERE server_instance_id = $1
FOR UPDATE;

-- If the row is absent, insert it for this instance.
-- If locked_until is in the past, update lock_owner and locked_until.
-- If locked_until is still in the future for another owner, skip this tick.

COMMIT;
```

The lock should be acquired by the orchestration boundary before `ServerInstanceManager.tickInstance()` calls `InstanceLifecycleService.tick()`. Gameplay rules remain unaware of the lock.

## Snapshot Compare-And-Swap

Snapshot writes must preserve `integrity.rootVersion`. The latest snapshot update must be atomic and must never let a stale snapshot overwrite newer state.

The Postgres flow should run in one transaction:

```sql
BEGIN;

INSERT INTO empire_snapshots (id, server_instance_id, snapshot_id, root_version, tick, payload)
VALUES ($id, $instanceId, $snapshotId, $rootVersion, $tick, $payload)
ON CONFLICT (server_instance_id, snapshot_id) DO NOTHING;

INSERT INTO empire_snapshot_latest (id, server_instance_id, snapshot_id, root_version, payload)
VALUES ($latestId, $instanceId, $snapshotId, $rootVersion, $payload)
ON CONFLICT (server_instance_id) DO UPDATE
SET snapshot_id = EXCLUDED.snapshot_id,
    root_version = EXCLUDED.root_version,
    payload = EXCLUDED.payload,
    updated_at = now()
WHERE empire_snapshot_latest.root_version <= EXCLUDED.root_version;

-- If the latest row was not inserted or updated, treat the write as stale and fail.

COMMIT;
```

The repository should throw a stale snapshot error if the latest pointer was not advanced or preserved by an equal root version idempotent write.

## Command Idempotence

Every persisted command must have a stable command id or request id. The existing `GameCommand.id` is the minimum viable idempotence key; `clientRequestId` can remain correlation metadata. Postgres enforces:

```sql
UNIQUE (server_instance_id, command_id)
```

The command execution flow should append or reserve the command id transactionally before mutating state. A retried request with the same command id must return the existing command result or be treated as already accepted; it must not apply attack, craft, elimination, or any other gameplay mutation twice. If shared types later need a stronger transport-level id, add a required `requestId`/`commandId` without changing gameplay semantics.

## Production Gaps

The file driver is a local durability bridge, not a production cluster store. It has an optimistic snapshot guard based on `integrity.rootVersion` to prevent stale snapshot overwrites, but it does not provide distributed locks, transactional command/event writes, cross-host replication, or indexed queries.

The remaining work for the Postgres adapter is to add a DB client, implement the four repository interfaces, wrap command/event/snapshot writes in transactions, add distributed tick locking at the orchestration boundary, and add mock-client tests plus optional live database smoke tests outside the default suite.
