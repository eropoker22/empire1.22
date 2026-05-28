# Command Reservation Design

## Implementation Status

Status as of 2026-05-29: Phase A and Phase B implemented.

Phase A added the backend persistence boundary: `CommandReservationRepository`, command reservation record types, and an in-memory implementation with unit coverage.

Phase B added a file-backed repository using the existing instance persistence directory style, plus round-trip tests for `pending`, `applied`, `rejected`, duplicate reserve, terminal-state protection, and instance-scoped command ids.

The reservation boundary is not wired into command dispatch yet.

The current public submit path is still synchronous from transport down to `InstanceLifecycleService.dispatch()`. A real Postgres reservation must be awaited before `applyCommand()`. Adding `void reserve()` or using only command-log idempotence would not guarantee exactly-once execution and would create a false release signal. The safe implementation still requires an explicit async command dispatch path.

Public alpha remains blocked for serverless scale-out command submission until Phase C and Phase D are complete, or command submission is otherwise serialized per server instance.

## Problem

The current runtime prevents duplicate commands inside one warm process with `runtime.processedCommandIds` and Postgres keeps `empire_command_log` idempotent with `UNIQUE (server_instance_id, command_id)`. That is not enough for serverless cross-invocation exactly-once execution, because two cold invocations can both pass the in-memory pre-dispatch gate and call `applyCommand()` before either append becomes visible to the other runtime.

This must be fixed before public alpha if multiple serverless invocations can submit commands for the same server instance concurrently.

## Current Command Flow

Current submit flow:

1. Netlify/HTTP adapter parses the request and routes `/api/gameplay-slice/submit` to `gameplaySliceJsonHandler.handle()`.
2. `validateSubmitGameplayCommandRequest()` validates transport shape and command envelope.
3. `GameplaySliceTransport.submit()` validates player/session identity and rejects server-assigned focus districts before command ingress.
4. `ServerCommandIngress.submit()` delegates to `InstanceCommandRouter.dispatch()`.
5. `InstanceCommandRouter.dispatch()` looks up the runtime by `serverInstanceId` and delegates to `ServerInstanceManager.dispatchCommand()`.
6. `ServerInstanceManager.dispatchCommand()` calls `InstanceLifecycleService.dispatch()`.
7. `validateCommandDispatchGate()` rejects instance mismatch, mode mismatch, in-memory duplicate command id, state version conflict, resolved instance, player cap, session TTL, and per-tick rate limit.
8. Accepted commands are written to `replayLogWriter.writeCommand()` asynchronously but not awaited.
9. The command id is added to `runtime.processedCommandIds`.
10. Rate-limit accounting is incremented.
11. `applyCommand(runtime.state, command, { config })` runs in game-core.
12. Core validation errors are returned without assigning `runtime.state`; the command id remains processed in the warm runtime.
13. Successful commands assign `runtime.state`, enqueue/publish `command-applied`, write a diagnostic log, and asynchronously write an event record.
14. Snapshots are saved by explicit stop/save/restore orchestration, not as part of command dispatch.

The dangerous window is between step 7 and step 11 across separate invocations. In-memory `processedCommandIds` cannot protect a second cold runtime.

## Minimal Interface

Add a dedicated repository boundary owned by server persistence, not by game-core:

```ts
export type CommandReservationStatus =
  | "pending"
  | "applied"
  | "rejected";

export interface CommandReservationRecord {
  serverInstanceId: string;
  commandId: string;
  status: CommandReservationStatus;
  commandType: string;
  playerId: string;
  payloadHash: string;
  reservedAt: string;
  updatedAt: string;
  appliedAt: string | null;
  rejectedAt: string | null;
  appliedMetadata: Record<string, unknown> | null;
  rejectionErrors: DomainError[] | null;
}

export interface CommandReservationRepository {
  reserve(record: {
    serverInstanceId: string;
    commandId: string;
    commandType: string;
    playerId: string;
    payloadHash: string;
    reservedAt: string;
  }): Promise<
    { created: boolean; record: CommandReservationRecord }
  >;

  getByCommandId(
    instanceId: string,
    commandId: string
  ): Promise<CommandReservationRecord | null>;

  markApplied(
    instanceId: string,
    commandId: string;
    metadata: {
    rootVersion: number;
    eventCount: number;
    updatedAt: string;
    }
  ): Promise<CommandReservationRecord>;

  markRejected(
    instanceId: string,
    commandId: string;
    errors: DomainError[]
  ): Promise<CommandReservationRecord>;
}
```

The interface belongs in `apps/server/src/runtime/persistence/repositories`. It must be composed through `ServerRuntimePersistenceRepositories` alongside command/event/diagnostic/snapshot repositories. It must not be imported by `packages/game-core`, client renderers, or transport validation.

## Dispatch Flow

Required target flow:

1. Run cheap transport parsing only.
2. Run pre-dispatch gates that must not mutate state: instance mismatch, mode mismatch, expected state version conflict, resolved instance, player cap/session TTL/rate limit.
3. If any pre-dispatch gate fails, return errors and do not reserve as applied.
4. Call `reserve()` before `applyCommand()`.
5. If reservation returns `duplicate` with `applied`, return the existing result/read model without calling `applyCommand()` again.
6. If reservation returns `duplicate` with `rejected`, return the stored rejection without calling `applyCommand()` again.
7. If reservation returns `pending` from another in-flight invocation, return a retryable `server.command_in_flight` response or wait behind an instance-level lock.
8. Only the invocation that created the reservation calls `applyCommand()`.
9. Mark the reservation as `applied` after the state mutation, event log append, and snapshot/latest state write complete.
10. Mark the reservation as `rejected` when core validation rejects the command after reservation.

`InstanceLifecycleService.dispatch()` must become async, or a new async dispatch method must replace every production submit path. Keeping a synchronous production path after adding reservations would leave an unsafe bypass.

## Postgres Implementation

Use a new migration, not an edit to `001_initial_runtime_persistence.sql`:

- `apps/server/src/runtime/persistence/postgres/migrations/002_command_reservations.sql`

The new table should be separate from `empire_command_log` because command log rows currently represent received command audit records and are appended after the warm-runtime gates. Reservation needs a status lifecycle (`pending`, `applied`, `rejected`) and must happen before core dispatch.

```sql
CREATE TABLE IF NOT EXISTS empire_command_reservations (
  id text PRIMARY KEY,
  server_instance_id text NOT NULL REFERENCES empire_server_instances (server_instance_id) ON DELETE CASCADE,
  command_id text NOT NULL,
  status text NOT NULL,
  payload_hash text NOT NULL,
  actor_id text NOT NULL,
  payload jsonb NOT NULL,
  result jsonb,
  rejection_reason jsonb,
  reserved_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_instance_id, command_id)
);
```

`reserve()` should use `INSERT ... ON CONFLICT DO NOTHING` inside a transaction, then read the existing row when the insert loses. A duplicate with a different `payloadHash` must return `payload_conflict`, because the same command id cannot safely represent two different commands.

The safest production path is to combine command reservation, state restore/update, command log append, event log append, and latest snapshot CAS in one Postgres transaction or behind an instance-scoped lock. Repository-level idempotence alone is not sufficient if state mutation happens outside that transaction.

Minimum acceptable public-alpha implementation:

1. `reserve()` is awaited before `applyCommand()`.
2. A duplicate `pending` command returns `server.command_in_flight` and does not call `applyCommand()`.
3. A duplicate `applied` command returns a deterministic duplicate response and does not call `applyCommand()`.
4. A duplicate `rejected` command returns the stored errors and does not call `applyCommand()`.
5. A payload hash mismatch returns `server.command_payload_conflict` and does not call `applyCommand()`.
6. Snapshot/latest state write remains guarded by existing root-version CAS. If command dispatch does not save snapshots, the release notes must say that exactly-once command id execution is implemented, but cross-command serialization is still not.

## Memory and File Implementations

Memory and file repositories can implement the same interface for local/dev parity:

- memory: `Map<serverInstanceId, Map<commandId, CommandReservationRecord>>` (Phase A complete)
- file: append or upsert one JSON record per command id under the instance persistence directory

They do not provide distributed exactly-once guarantees, but they keep the lifecycle service code path identical across environments.

The Phase A in-memory implementation is intentionally local-only:

- new reserve creates a `pending` record
- duplicate reserve for the same `(serverInstanceId, commandId)` returns `{ created: false, record }`
- `markApplied()` can move `pending` to `applied`
- `markRejected()` can move `pending` to `rejected`
- terminal states cannot be rewritten across `applied` and `rejected`
- command ids are scoped per server instance

## Crash Recovery

A crash after `reserve()` and before `markApplied()` leaves a `pending` row. The recovery policy must be explicit:

- If no state mutation occurred, a retry can either reuse the reservation or replace it after a stale timeout.
- If state mutation may have occurred but `markApplied()` did not complete, the system must reconcile using event log/snapshot root version before retrying.
- Public alpha should prefer an instance-level transactional boundary or lock so this ambiguous state is rare and recoverable.

## Test Requirements

- duplicate command id does not call `applyCommand()` twice
- duplicate command id does not advance `root.version` twice
- duplicate command id with different payload returns payload conflict
- invalid command rejected after reservation is stored as rejected and does not mutate state
- expectedStateVersion conflict does not reserve as applied
- rate limit does not reserve as applied
- resolved instance does not reserve as applied
- Postgres reservation insert is unique per `(server_instance_id, command_id)`
- in-flight/pending duplicate returns deterministic retryable output

## Safe Implementation Plan

Use staged backend-only phases:

### Phase A - Boundary and Memory Repository

Status: complete.

1. Add `CommandReservationRepository` interface and DTOs under `apps/server/src/runtime/persistence/repositories`.
2. Add in-memory implementation with tests.
3. Add optional `commandReservationRepository?` to `ServerRuntimePersistenceRepositories`.
4. Do not wire dispatch to reservation yet.

### Phase B - File Repository

Status: complete.

1. Add file-backed command reservation repository using the existing instance persistence directory style.
2. Keep the same terminal-state rules as memory.
3. Add file persistence tests for duplicate reserve and pending/applied/rejected round trip.
4. Compose it into file runtime persistence as optional `commandReservationRepository`.

### Phase C - Postgres Transactional Reservation

Required before public alpha:

1. Add `002_command_reservations.sql`.
2. Add Postgres repository with fake-DB unit tests matching the existing `postgres-persistence.test.ts` pattern.
3. Use a unique constraint on `(server_instance_id, command_id)`.
4. Handle payload hash conflicts deterministically.

### Phase D - Async Dispatch Pipeline Integration

Required before public alpha:

1. Convert production command dispatch path to async:
   - `InstanceLifecycleService.dispatch`
   - `ServerInstanceManager.dispatchCommand`
   - `InstanceCommandRouter.dispatch`
   - `ServerCommandIngress.submit`
   - `GameplaySliceTransport.submit`
   - `GameplaySliceJsonHandler.handle`
   - Netlify gameplay slice function route handling
2. Keep a compatibility wrapper only if it cannot be used by production submit. It should throw or be test-only when no reservation repository is available.
3. Move `processedCommandIds.add(command.id)` after successful reservation creation and keep it as a warm-runtime fast path only after repository confirmation.
4. Mark reservations:
   - pre-dispatch gate rejection: no reservation
   - duplicate/payload conflict/in-flight: no mutation
   - core rejection after reservation: `markRejected`
   - core success after state/event persistence: `markApplied`
5. Update tests to `await` submit/dispatch where needed.
6. Add targeted tests for duplicate, invalid, conflict, in-flight, applied, rejected, memory/file/postgres idempotence.
7. Run the release gate under Node 20, including E2E smoke.

This is intentionally larger than a local lifecycle-service patch because the safety property depends on awaiting a shared persistence write before gameplay mutation.

## Player Registration Follow-Up

`empire_player_registrations` already exists with uniqueness on `(server_instance_id, player_id)` and `(server_instance_id, session_id)`, but there is no dedicated repository/service boundary yet. The matching minimal interface should reserve player/session membership before mutating runtime membership:

```ts
export interface PlayerRegistrationRepository {
  reservePlayerSlot(input: {
    serverInstanceId: string;
    playerId: string;
    sessionId: string;
    accountId?: string | null;
    payload: unknown;
  }): Promise<"reserved" | "duplicate" | "capacity_full" | "server_closed">;

  listByInstance(serverInstanceId: string): Promise<unknown[]>;
}
```

Current closed-alpha behavior can rely on snapshot-restored membership plus `ensureGameplaySliceMembershipInState()`. Public alpha should add the repository before relying on serverless scale-out joins.
