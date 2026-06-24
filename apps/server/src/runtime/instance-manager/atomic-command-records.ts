import type { CoreGameState } from "@empire/game-core";
import type { DomainError, GameCommand, InstanceRuntimeEvent } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import type { CommandResultRecord, EventRecord, RuntimeOutboxRecord } from "../persistence";
import type { CommandReservationRecord } from "../persistence/repositories";

export const createAppliedCommandResult = (input: {
  runtime: ServerInstanceRuntime;
  command: GameCommand;
  payloadHash: string;
  previousRootVersion: number;
  nextState: CoreGameState;
  eventRecord: EventRecord;
  snapshotId: string;
  createdAt: string;
  appliedAt: string;
}): CommandResultRecord => ({
  serverInstanceId: input.runtime.record.id,
  commandId: input.command.id,
  commandType: input.command.type,
  playerId: input.command.playerId,
  status: "applied",
  payloadHash: input.payloadHash,
  command: input.command,
  rootVersionBefore: input.previousRootVersion,
  rootVersionAfter: input.nextState.root.version,
  eventCount: 1,
  eventIds: [input.eventRecord.id],
  snapshotId: input.snapshotId,
  snapshotVersion: input.nextState.root.version,
  responseErrors: [],
  createdAt: input.createdAt,
  appliedAt: input.appliedAt,
  rejectedAt: null
});

export const createRejectedCommandResult = (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  payloadHash: string,
  rootVersionBefore: number,
  errors: DomainError[],
  createdAt: string
): CommandResultRecord => ({
  serverInstanceId: runtime.record.id,
  commandId: command.id,
  commandType: command.type,
  playerId: command.playerId,
  status: "rejected",
  payloadHash,
  command,
  rootVersionBefore,
  rootVersionAfter: null,
  eventCount: 0,
  eventIds: [],
  snapshotId: null,
  snapshotVersion: null,
  responseErrors: errors,
  createdAt,
  appliedAt: null,
  rejectedAt: runtime.clock.nowIso()
});

export const createRecoveredRejectedCommandResult = (
  runtime: ServerInstanceRuntime,
  reservation: CommandReservationRecord,
  errors: DomainError[]
): CommandResultRecord => ({
  serverInstanceId: runtime.record.id,
  commandId: reservation.commandId,
  commandType: reservation.commandType,
  playerId: reservation.playerId,
  status: "rejected",
  payloadHash: reservation.payloadHash,
  command: reservation.payload as GameCommand,
  rootVersionBefore: runtime.state.root.version,
  rootVersionAfter: null,
  eventCount: 0,
  eventIds: [],
  snapshotId: null,
  snapshotVersion: null,
  responseErrors: errors,
  createdAt: reservation.reservedAt,
  appliedAt: null,
  rejectedAt: runtime.clock.nowIso()
});

export const createEventRecord = (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  event: InstanceRuntimeEvent,
  nextState: CoreGameState,
  recordedAt: string
): EventRecord => ({
  id: `evt:${command.id}:${nextState.root.version}`,
  instanceId: runtime.record.id,
  event,
  causedByCommandId: command.id,
  recordedAt,
  tickAtEmit: nextState.root.tick
});

export const createOutboxRecord = (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  event: InstanceRuntimeEvent,
  createdAt: string
): RuntimeOutboxRecord => ({
  outboxId: `outbox:${runtime.record.id}:${command.id}:command-applied`,
  serverInstanceId: runtime.record.id,
  commandId: command.id,
  eventType: event.type,
  payload: event,
  createdAt,
  publishedAt: null,
  attempts: 0,
  lastError: null
});

export const createReservationUnavailableError = (): DomainError => ({
  code: "server.command_reservation_unavailable",
  message: "Atomic command persistence is unavailable for this server instance."
});

export const createPayloadConflictError = (commandId: string): DomainError => ({
  code: "server.command_payload_conflict",
  message: "Command id was already reserved with a different payload.",
  details: { commandId }
});

export const createPendingCommandError = (record: CommandReservationRecord): DomainError => ({
  code: "server.command_in_flight",
  message: "Command id is already reserved by an in-flight submit.",
  details: { commandId: record.commandId, reservedAt: record.reservedAt }
});

export const createRecoveredMissingResultError = (commandId: string): DomainError => ({
  code: "server.command_recovery_pending",
  message: "Command reservation reached a terminal state without a stored command result.",
  details: { commandId }
});

