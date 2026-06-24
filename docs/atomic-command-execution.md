# Atomic Command Execution

Empire Streets gameplay command submit now runs through `dispatchAtomicInstanceCommand()` in `apps/server/src/runtime/instance-manager/atomic-command-dispatcher.ts`.

The boundary owns command reservation, command result replay, latest snapshot save, event log append, durable outbox append, and post-commit publication. `applyCommand()` remains pure game-core logic and is only called inside this server runtime boundary.

## Command Lifecycle

1. Reserve `(serverInstanceId, commandId)` with a stable payload hash.
2. If the reservation already exists, replay the stored command result when available.
3. If the same command ID has a different payload hash, return `server.command_payload_conflict`.
4. For a new command, validate state version and runtime gates.
5. Append the command audit record.
6. Call `applyCommand()` against the current committed runtime state.
7. Store rejected command results and mark the reservation rejected without mutating state.
8. For applied commands, create the next state in memory but do not assign it to `runtime.state`.
9. Save the latest snapshot, event log, command result, reservation applied metadata, and outbox record.
10. Only after durable writes succeed, update `runtime.state`, update warm duplicate/rate state, enqueue the runtime event, and publish through the outbox.

## Idempotency

`commandId` is idempotent per server instance. A duplicate applied command with the same payload returns the original stored result without calling `applyCommand()` again. A duplicate rejected command returns the original stored errors. A duplicate with a changed payload returns `server.command_payload_conflict`.

Idempotency is checked before `expectedStateVersion`, so a retry of an already applied command is accepted as a replay even if the current root version has moved forward.

## Outbox

Runtime publish is not the source of truth. Command transactions append `empire_runtime_outbox` / `RuntimeOutboxRepository` records first. Post-commit publication reads unpublished outbox rows, calls `eventPublisher.publish()`, then marks rows published. Publish failure leaves the row unpublished for later retry.

## Driver Notes

Memory persistence implements the behavioral contract for tests and local development. File persistence remains a best-effort dev bridge and is not production-safe for public multiplayer. Postgres adds command result and outbox schema in `004_atomic_command_execution.sql`; public production should use the Postgres driver.

