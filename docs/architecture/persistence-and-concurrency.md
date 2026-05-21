# Persistence And Concurrency Plan

This document describes the current multiplayer persistence baseline and the command concurrency guard used by the server-backed gameplay slice.

## Current State

Runtime state is owned by `ServerInstanceManager` and each `ServerInstanceRuntime`. Gameplay mutations still flow through `command-ingress -> instance-command-router -> ServerInstanceManager.dispatchCommand -> InstanceLifecycleService.dispatch -> game-core applyCommand`.

The persistence layer is separated into four repository contracts:

- `CommandLogRepository`: append/list command records for replay/audit.
- `EventLogRepository`: append/list emitted runtime events.
- `DiagnosticLogRepository`: append/list lifecycle, command rejection, and crash diagnostics.
- `SnapshotRepository`: save/load latest instance snapshots.

The runtime composes these through `ServerRuntimePersistenceRepositories`. Replay writes stay outside gameplay rules via `ReplayLogWriter`; replay/admin reads use `ReplayLogReader`.

## In-Memory Mode

Default development and unit tests use in-memory repositories:

```ts
createInMemoryRuntimePersistenceRepositories()
```

This mode is fast and isolated, but it is process-local. It does not survive process restart and does not protect against concurrent workers writing the same instance.

## Local File Mode

Local durable mode is selected by environment:

```bash
EMPIRE_PERSISTENCE_DRIVER=file
EMPIRE_PERSISTENCE_DIR=.empire-persistence
```

or the compatibility names:

```bash
GAMEPLAY_PERSISTENCE_DRIVER=file
GAMEPLAY_PERSISTENCE_DIR=.empire-persistence
```

File mode stores readable, versioned JSON envelopes under `instances/<encoded-instance-id>/`:

- command log: JSONL append stream
- event log: JSONL append stream
- diagnostic log: JSONL append stream
- snapshot: atomic JSON file with schema and root version metadata

The file snapshot repository rejects stale overwrites when the incoming snapshot root version is older than the stored root version. JSONL log append is useful for local durability and replay inspection, but it is not a production distributed-lock mechanism.

## Snapshot Token Mode

Serverless HTTP requests can carry snapshot tokens so a cold function can restore a runtime snapshot when durable process memory is gone. Snapshot tokens are a transport bootstrap aid, not a database replacement:

- they help validate and restore the intended instance state;
- they must be signed with configured secrets;
- they do not serialize concurrent writes across multiple active workers.

Production still needs centralized storage with compare-and-swap semantics.

## Parallel Submit Risk

Without a concurrency guard, two browser tabs or two serverless workers can submit commands based on the same read model. Both commands may be individually valid, but the second one could silently apply against a newer state than the client saw.

The current guard uses `expectedStateVersion`:

1. Every gameplay read model response includes `metadata.stateVersion`.
2. The client dispatcher sends the latest state version on submit.
3. `validateCommandDispatchGate` compares `expectedStateVersion` to `runtime.state.root.version`.
4. If the value is stale, the command is rejected with `server.state_version_conflict`.
5. `gameplay-slice-transport` returns the current read model and metadata when the runtime is available.

Duplicate command id checks run before stale-version checks, so retries with an already processed command id still return `server.duplicate_command`.

## Version Advancement

`InstanceLifecycleService.dispatch` records the previous root version before `applyCommand`. After a successful command, it ensures `root.version` advances by at least one. This covers command handlers that do not already increment the root version. Rejected core commands do not advance the version.

## Recommended Production Storage Model

For production multiplayer, use a database or durable coordination layer with these properties:

- one row/document per server instance snapshot, including `instanceId`, `rootVersion`, `state`, `updatedAt`;
- append-only command, event, and diagnostic streams keyed by `instanceId`;
- transaction or compare-and-swap update: `UPDATE snapshots SET state=?, rootVersion=? WHERE instanceId=? AND rootVersion=?`;
- idempotency table or unique index for `(instanceId, commandId)`;
- worker lease/heartbeat for ticking so one authoritative tick loop owns an instance at a time;
- retention policy for logs and snapshots.

Postgres/Supabase can satisfy this with transactions, row-level locks, and unique indexes. The local file implementation intentionally does not pretend to solve distributed locking.

## Remaining Work

- Add production repository implementations with transactional expected-version writes.
- Move command log append and snapshot update into one atomic unit for production storage.
- Add explicit worker ownership/lease for tick loops.
- Add operational tooling for replay from command/event logs into a fresh runtime.
- Expose concurrency conflict telemetry in admin monitoring.
