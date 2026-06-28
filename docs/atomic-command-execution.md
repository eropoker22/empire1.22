# Atomic Command Execution

Empire Streets gameplay command submit now runs through `dispatchAtomicInstanceCommand()` in `apps/server/src/runtime/instance-manager/atomic-command-dispatcher.ts`.

The boundary owns command reservation, command result replay, latest snapshot save, event log append, durable outbox append, and post-write publication. `applyCommand()` remains pure game-core logic and is only called inside this server runtime boundary.

Production command submit is DB-transactional when the Postgres persistence driver is active. The Postgres adapter exposes `atomicCommandPersistenceMode: "transactional"` plus an `atomicCommandTransaction` boundary. The dispatcher uses that boundary to commit reservation, command result, latest snapshot, event log, outbox, and reservation terminal state together. Memory and file persistence keep the same behavioral API for development, but they are marked `best-effort` and production app composition removes command-submit repositories for those drivers.

## Command Lifecycle

1. Reserve `(serverInstanceId, commandId)` with a stable payload hash.
2. If the reservation already exists, replay the stored command result when available.
3. If the same command ID has a different payload hash, return `server.command_payload_conflict`.
4. For a new command, validate state version and runtime gates.
5. Append the command audit record.
6. Call `applyCommand()` against the current committed runtime state.
7. Store rejected command results and mark the reservation rejected without mutating state.
8. For applied commands, create the next state in memory but do not assign it to `runtime.state`.
9. Save the latest snapshot, event log, command result, reservation applied metadata, and outbox record inside the active command boundary.
10. Only after the boundary commits, update `runtime.state`, update warm duplicate/rate state, enqueue the runtime event, and publish through the outbox.

## Postgres Transaction Boundary

For Postgres, `createPostgresAtomicCommandTransaction()` wraps command execution in `PostgresDatabase.transaction()`. At the start of the transaction it ensures the server instance row exists and locks it with:

```sql
SELECT id
FROM empire_server_instances
WHERE server_instance_id = $1
FOR UPDATE
```

The transaction callback receives repositories built from the transaction client. The following writes share one commit boundary:

- command reservation and duplicate/replay reads
- command audit log
- event log
- latest snapshot history and pointer
- command result
- `markApplied()` or `markRejected()`
- runtime outbox append

`markApplied()` is written only after the latest snapshot save succeeds. If the database throws before commit, the transaction rolls back, `runtime.state` remains unchanged, no runtime event is enqueued, and nothing is published. A retry can safely reserve or replay the command again from durable state.

`runtime.state` is assigned only after the transaction callback returns successfully. Publication also happens only after commit. If the process crashes or publish fails after commit but before publication completes, the command remains durably applied and the outbox row remains unpublished for a later publisher/retry; `applyCommand()` is not called again for the same command id and payload.

## Idempotency

`commandId` is idempotent per server instance. A duplicate applied command with the same payload returns the original stored result without calling `applyCommand()` again. A duplicate rejected command returns the original stored errors. A duplicate with a changed payload returns `server.command_payload_conflict`.

Idempotency is checked before `expectedStateVersion`, so a retry of an already applied command is accepted as a replay even if the current root version has moved forward.

## Outbox

Runtime publish is not the source of truth. Command execution appends `empire_runtime_outbox` / `RuntimeOutboxRepository` records before publication. Publication reads unpublished outbox rows, calls `eventPublisher.publish()`, then marks rows published. Publish failure leaves the row unpublished for later retry.

## Driver Notes

Postgres is the production-safe command persistence path. It uses a row-level instance lock and one database transaction for the command correctness writes.

Memory persistence implements the behavioral contract for tests and local development only. Its in-process lock does not protect concurrent serverless hosts. File persistence remains a best-effort dev bridge and is not production-safe for public multiplayer because its multi-file writes cannot provide one shared atomic commit.

Diagnostic log writes are audit-only and may remain best-effort in some paths. Command correctness depends on reservation, command result, event log, snapshot, terminal reservation state, and outbox writes.
