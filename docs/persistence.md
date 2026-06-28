# Runtime Persistence

The server runtime supports three persistence drivers:

- `memory` (default): in-process repositories for tests and short local runs.
- `file`: local durable bridge for command log, event log, diagnostic log, and snapshots.
- `postgres`: production shared persistence for public multiplayer server instances using standard Postgres or Supabase-hosted Postgres.

Without the `postgres` driver, public multiplayer is not production-safe: players may not share one authoritative state across hosts, and concurrent serverless invocations can race ticks, commands, snapshots, and player joins.

## Configuration

Enable file persistence with:

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

Compatibility aliases:

```powershell
$env:GAMEPLAY_PERSISTENCE_DRIVER = "postgres"
$env:GAMEPLAY_DATABASE_URL = "postgres://user:password@localhost:5432/empire"
```

If the selected driver is `postgres` and no database URL is configured, startup fails with a clear configuration error. The adapter validates `postgres://` and `postgresql://` URLs and never logs the database URL.

## Migration

Apply the migration manually before enabling the Postgres driver:

- `apps/server/src/runtime/persistence/postgres/migrations/001_initial_runtime_persistence.sql`
- `apps/server/src/runtime/persistence/postgres/migrations/002_command_reservations.sql`
- `apps/server/src/runtime/persistence/postgres/migrations/003_gameplay_identity_sessions.sql`
- `apps/server/src/runtime/persistence/postgres/migrations/004_atomic_command_execution.sql`

Example:

```powershell
psql $env:EMPIRE_DATABASE_URL -f apps/server/src/runtime/persistence/postgres/migrations/001_initial_runtime_persistence.sql
psql $env:EMPIRE_DATABASE_URL -f apps/server/src/runtime/persistence/postgres/migrations/002_command_reservations.sql
psql $env:EMPIRE_DATABASE_URL -f apps/server/src/runtime/persistence/postgres/migrations/003_gameplay_identity_sessions.sql
psql $env:EMPIRE_DATABASE_URL -f apps/server/src/runtime/persistence/postgres/migrations/004_atomic_command_execution.sql
```

The migration creates:

- `empire_server_instances`
- `empire_command_log`
- `empire_event_log`
- `empire_diagnostic_log`
- `empire_snapshots`
- `empire_snapshot_latest`
- `empire_player_registrations`
- `empire_tick_locks`

The second migration creates:

- `empire_command_reservations`

The atomic command migration creates:

- `empire_command_results`
- `empire_runtime_outbox`

Tables use `payload jsonb`, `created_at timestamptz`, `updated_at` where rows can change, instance-scoped indexes, append ordering indexes, `UNIQUE(server_instance_id, command_id)` for command idempotence, `UNIQUE(server_instance_id, snapshot_id)` for snapshot history, and `UNIQUE(server_instance_id)` for latest snapshots and tick locks.

## Postgres Adapter

`createPostgresRuntimePersistenceRepositories()` returns the same repository shape as memory/file plus a runtime tick lock:

- `commandLogRepository`
- `commandReservationRepository`
- `commandResultRepository`
- `eventLogRepository`
- `outboxRepository`
- `diagnosticLogRepository`
- `snapshotRepository`
- `atomicCommandTransaction`
- `tickLock`
- `close()`

The adapter uses the standard `pg` package with lazy pool creation. Memory and file drivers do not load or connect to Postgres.

### Command Log

`commandLogRepository.append(record)` writes to `empire_command_log`.

- `record.command.id` is required and becomes `command_id`.
- `UNIQUE(server_instance_id, command_id)` makes append idempotent.
- Duplicate command ids are a safe no-op and do not overwrite payload.
- `listByInstance()` returns records ordered by `sequence`, then `created_at`, then `id`.

The command log remains an audit stream. Exactly-once command execution is owned by the command reservation repository, which is awaited before `applyCommand()`.

### Command Reservation

`commandReservationRepository.reserve(record)` writes to `empire_command_reservations` before gameplay dispatch.

- `UNIQUE(server_instance_id, command_id)` makes reservation idempotent per server instance.
- `reserve()` uses `INSERT ... ON CONFLICT DO NOTHING` and reads the existing row on duplicate.
- Duplicate `pending` commands return `server.command_in_flight`.
- Duplicate `applied` commands return `server.command_already_applied`.
- Duplicate `rejected` commands return the stored rejection errors.
- Same command id with a different deterministic command-envelope hash returns `server.command_payload_conflict`.
- `markApplied()` allows `pending -> applied` and is idempotent for already applied records.
- `markRejected()` allows `pending -> rejected` and is idempotent for already rejected records.
- Terminal states cannot be rewritten across applied/rejected.

Memory and file repositories implement the same lifecycle for local/dev parity, but only Postgres provides cross-invocation shared reservation state.

If a runtime does not have a `commandReservationRepository`, command submit fails closed with `server.command_reservation_unavailable`. The runtime does not write command audit, does not call `applyCommand()`, and does not mutate state. This is intentional: command reservation is correctness-critical and cannot be fire-and-forgotten.

### Event Log

`eventLogRepository.append(record)` writes to `empire_event_log`.

- Events are append-only.
- `caused_by_command_id` and `tick_at_emit` are stored as indexed columns where available.
- The full `EventRecord` DTO is stored in JSONB payload.
- `listByInstance()` uses stable sequence ordering.

### Diagnostic Log

`diagnosticLogRepository.append(record)` writes to `empire_diagnostic_log`.

- `level` and `category` are stored as queryable columns.
- The full `DiagnosticRecord` DTO is stored in JSONB payload.
- `listByInstance()` uses stable sequence ordering.

### Snapshots

`snapshotRepository.save(snapshot)` writes snapshot history and latest pointer in one transaction:

1. Ensures a server instance row exists.
2. Inserts immutable history into `empire_snapshots` with `ON CONFLICT DO NOTHING`.
3. Upserts `empire_snapshot_latest`.
4. Updates latest only when `existing.root_version <= incoming.root_version`.
5. Throws a stale snapshot error when a lower `rootVersion` attempts to overwrite newer latest state.

`snapshotRepository.loadLatest(instanceId)` reads the JSONB payload from `empire_snapshot_latest` and returns the existing `InstanceSnapshotDto`.

Restore currently uses latest snapshot persistence where the runtime calls `ServerInstanceManager.restoreInstance()` or `runtime.snapshotController.restore()`. The gameplay slice serverless transport still supports snapshot-token restore for cold HTTP flow; database-backed session/player registration orchestration is a separate follow-up.

### Atomic Command Transaction

The Postgres adapter is the production command-submit persistence path. It reports `atomicCommandPersistenceMode: "transactional"` and exposes `atomicCommandTransaction`.

For each submitted command, the dispatcher enters one `PostgresDatabase.transaction()` and locks the server instance row:

```sql
SELECT id
FROM empire_server_instances
WHERE server_instance_id = $1
FOR UPDATE
```

The transaction-scoped repository set is built from the transaction client, so reservation, duplicate/replay reads, command audit log, event log, latest snapshot save, command result, `markApplied()` or `markRejected()`, and outbox append commit or roll back together.

`runtime.state` is not assigned until the transaction commits. Runtime publication reads the durable outbox only after commit. If publish fails after commit, the command stays applied and the outbox row stays unpublished for later delivery.

Duplicate handling is also durable:

- same `commandId` and same payload hash returns the stored applied result without calling `applyCommand()` again
- same `commandId` and different payload hash returns `server.command_payload_conflict`
- rejected command replay returns the stored rejection errors

Memory and file drivers keep development parity but are not public production safe. Memory relies on one-process locks. File persistence writes multiple local files and cannot provide one shared DB transaction across serverless hosts. In production app composition, non-transactional command persistence has command-submit repositories removed so command submit fails closed instead of silently using a dev-only path.

## Tick Lock

The Postgres driver exposes a distributed tick lock and the tick orchestrator uses it when present.

Flow:

1. Begin transaction.
2. Ensure a server instance row exists.
3. `SELECT ... FROM empire_tick_locks WHERE server_instance_id = $1 FOR UPDATE`.
4. Insert lock if missing.
5. Take over when `locked_until <= now()`.
6. Skip tick when another owner holds an unexpired lock.
7. Release by setting `locked_until` to the release timestamp.

Gameplay core does not know about the database lock. The lock is contained in the runtime orchestration boundary before `ServerInstanceManager.tickInstance()`.

## Tests

Default tests do not require a live database.

Run local/mock persistence tests:

```powershell
npm run test:persistence
```

Run the optional live Postgres smoke test after applying the migration:

```powershell
$env:EMPIRE_TEST_DATABASE_URL = "postgres://user:password@localhost:5432/empire_test"
npm run test:persistence:postgres
```

The live smoke test appends a command, event, diagnostic, saves and loads a snapshot, and acquires a tick lock. It is skipped when `EMPIRE_TEST_DATABASE_URL` is not set.

## Production Notes

Implemented:

- DB-backed command/event/diagnostic/snapshot repositories.
- Command append idempotence by `(server_instance_id, command_id)`.
- Command reservation by `(server_instance_id, command_id)` before `applyCommand()` in the async submit path.
- Transactional Postgres command submit covering reservation, command result, event log, latest snapshot, outbox, and reservation terminal state.
- Row-level server instance lock for production command submit.
- Snapshot latest compare-and-swap by `rootVersion`.
- Distributed tick lock helper and tick-orchestrator integration.
- Identity/session schema for player registrations, join tickets and gameplay sessions in `003_gameplay_identity_sessions.sql`.
- Optional live Postgres smoke test.

Known follow-up:

- The identity/session schema exists, but player registration, join ticket and gameplay session repository wiring is not yet production-ready. Until then, production gameplay session traffic fails closed unless a production-ready session service is injected.
- Memory and file persistence remain development-only for public command submit. They can exercise the command lifecycle locally, but only Postgres provides cross-host transaction atomicity.
- Diagnostic logs may remain best-effort in some lifecycle paths because they are audit-only. Command correctness writes are inside the Postgres transaction boundary.
