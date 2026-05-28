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

Example:

```powershell
psql $env:EMPIRE_DATABASE_URL -f apps/server/src/runtime/persistence/postgres/migrations/001_initial_runtime_persistence.sql
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

Tables use `payload jsonb`, `created_at timestamptz`, `updated_at` where rows can change, instance-scoped indexes, append ordering indexes, `UNIQUE(server_instance_id, command_id)` for command idempotence, `UNIQUE(server_instance_id, snapshot_id)` for snapshot history, and `UNIQUE(server_instance_id)` for latest snapshots and tick locks.

## Postgres Adapter

`createPostgresRuntimePersistenceRepositories()` returns the same repository shape as memory/file plus a runtime tick lock:

- `commandLogRepository`
- `eventLogRepository`
- `diagnosticLogRepository`
- `snapshotRepository`
- `tickLock`
- `close()`

The adapter uses the standard `pg` package with lazy pool creation. Memory and file drivers do not load or connect to Postgres.

### Command Log

`commandLogRepository.append(record)` writes to `empire_command_log`.

- `record.command.id` is required and becomes `command_id`.
- `UNIQUE(server_instance_id, command_id)` makes append idempotent.
- Duplicate command ids are a safe no-op and do not overwrite payload.
- `listByInstance()` returns records ordered by `sequence`, then `created_at`, then `id`.

The current in-process command dispatch gate still prevents duplicate command ids before core dispatch when the runtime has the command in `processedCommandIds`. For fully cross-invocation exactly-once command execution, the next infrastructure step is to make command dispatch async and reserve the command id transactionally before `applyCommand()`.

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
- Snapshot latest compare-and-swap by `rootVersion`.
- Distributed tick lock helper and tick-orchestrator integration.
- Optional live Postgres smoke test.

Known follow-up:

- `empire_player_registrations` exists in the schema, but player registration/session reservation is not yet represented by a dedicated persistence repository. Current membership state is restored through snapshots/snapshot tokens.
- Cross-invocation exactly-once command execution needs an async command pipeline that reserves command ids before gameplay mutation. The repository-level idempotence is in place, but synchronous dispatch still uses runtime `processedCommandIds` as the pre-dispatch gate. See `docs/command-reservation-design.md` for the minimum public-alpha design.
