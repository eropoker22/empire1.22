# Command Reservation Design

## Problem

The current runtime prevents duplicate commands inside one warm process with `runtime.processedCommandIds` and Postgres keeps `empire_command_log` idempotent with `UNIQUE (server_instance_id, command_id)`. That is not enough for serverless cross-invocation exactly-once execution, because two cold invocations can both pass the in-memory pre-dispatch gate and call `applyCommand()` before either append becomes visible to the other runtime.

This must be fixed before public alpha if multiple serverless invocations can submit commands for the same server instance concurrently.

## Minimal Interface

Add a dedicated repository boundary owned by server persistence, not by game-core:

```ts
export type CommandReservationStatus =
  | "reserved"
  | "applied"
  | "rejected";

export interface CommandReservationRecord {
  serverInstanceId: string;
  commandId: string;
  status: CommandReservationStatus;
  payloadHash: string;
  actorId: string;
  reservedAt: string;
  updatedAt: string;
  result?: unknown;
  rejectionReason?: unknown;
}

export interface CommandReservationRepository {
  reserveCommand(input: {
    serverInstanceId: string;
    commandId: string;
    actorId: string;
    payloadHash: string;
    payload: unknown;
    reservedAt: string;
  }): Promise<
    | { status: "reserved"; record: CommandReservationRecord }
    | { status: "duplicate"; record: CommandReservationRecord }
    | { status: "payload_conflict"; record: CommandReservationRecord }
  >;

  markCommandApplied(input: {
    serverInstanceId: string;
    commandId: string;
    rootVersion: number;
    eventCount: number;
    updatedAt: string;
  }): Promise<void>;

  markCommandRejected(input: {
    serverInstanceId: string;
    commandId: string;
    reason: unknown;
    updatedAt: string;
  }): Promise<void>;
}
```

## Dispatch Flow

1. Run cheap transport parsing only.
2. Run pre-dispatch gates that must not mutate state: instance mismatch, mode mismatch, expected state version conflict, resolved instance, player cap/session TTL/rate limit.
3. If any pre-dispatch gate fails, return errors and do not reserve as applied.
4. Call `reserveCommand()` before `applyCommand()`.
5. If reservation returns `duplicate` with `applied`, return the existing result/read model without calling `applyCommand()` again.
6. If reservation returns `duplicate` with `rejected`, return the stored rejection without calling `applyCommand()` again.
7. If reservation returns `reserved` from another in-flight invocation, return a retryable `server.command_in_flight` response or wait behind an instance-level lock.
8. Only the invocation that created the reservation calls `applyCommand()`.
9. Mark the reservation as `applied` after the state mutation, event log append, and snapshot/latest state write complete.
10. Mark the reservation as `rejected` when core validation rejects the command after reservation.

## Postgres Implementation

Use a table such as `empire_command_reservations`:

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

`reserveCommand()` should use `INSERT ... ON CONFLICT DO NOTHING` inside a transaction, then read the existing row when the insert loses. A duplicate with a different `payloadHash` must return `payload_conflict`, because the same command id cannot safely represent two different commands.

The safest production path is to combine command reservation, state restore/update, command log append, event log append, and latest snapshot CAS in one Postgres transaction or behind an instance-scoped lock. Repository-level idempotence alone is not sufficient if state mutation happens outside that transaction.

## Memory and File Implementations

Memory and file repositories can implement the same interface for local/dev parity:

- memory: `Map<serverInstanceId, Map<commandId, CommandReservationRecord>>`
- file: append or upsert one JSON record per command id under the instance persistence directory

They do not provide distributed exactly-once guarantees, but they keep the lifecycle service code path identical across environments.

## Crash Recovery

A crash after `reserveCommand()` and before `markCommandApplied()` leaves a `reserved` row. The recovery policy must be explicit:

- If no state mutation occurred, a retry can either reuse the reservation or replace it after a stale timeout.
- If state mutation may have occurred but `markCommandApplied()` did not complete, the system must reconcile using event log/snapshot root version before retrying.
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
- in-flight/reserved duplicate returns deterministic retryable output

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
