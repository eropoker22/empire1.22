import { applyCommand } from "@empire/game-core";
import type { CoreGameState } from "@empire/game-core";
import type { DomainError, GameCommand, InstanceRuntimeEvent } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { writeCommandRejectionDiagnostic, writeDiagnosticLog } from "../logging";
import type { CommandDispatchOptions } from "../orchestration/command-dispatch-options";
import type { InstanceCommandDispatchResult } from "../orchestration/instance-command-dispatch-result";
import {
  recordCommandRateLimitUsage,
  validateCommandDispatchGate
} from "./instance-command-gates";
import {
  createCommandReservationPayload,
  createCommandReservationPayloadHash
} from "./command-reservation-payload";

export const dispatchInstanceCommand = async (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  options: CommandDispatchOptions = {}
): Promise<InstanceCommandDispatchResult> => {
  const reservationRepository = runtime.commandReservationRepository;
  const gateErrors = validateCommandDispatchGate(runtime, command, {
    ...options,
    skipProcessedCommandIdGate: Boolean(reservationRepository)
  });

  if (gateErrors.length > 0) {
    await writeCommandRejectionDiagnostic({
      runtime,
      command,
      errors: gateErrors,
      category: "command_rejected",
      message: "Command rejected before core dispatch.",
      expectedStateVersion: options.expectedStateVersion
    });
    return { runtime, errors: gateErrors };
  }

  if (!reservationRepository) {
    const errors = [createReservationUnavailableError()];
    await writeCommandRejectionDiagnostic({
      runtime,
      command,
      errors,
      category: "command_rejected",
      message: "Command rejected because command reservation is unavailable.",
      expectedStateVersion: options.expectedStateVersion
    });
    return { runtime, errors };
  }

  const reservedAt = runtime.clock.nowIso();
  const payload = createCommandReservationPayload(command);
  const payloadHash = createCommandReservationPayloadHash(command);
  const reservation = await reservationRepository.reserve({
    serverInstanceId: runtime.record.id,
    commandId: command.id,
    commandType: command.type,
    playerId: command.playerId,
    payloadHash,
    payload,
    reservedAt
  });

  if (!reservation.created) {
    const errors = createDuplicateReservationErrors(reservation.record, payloadHash);
    await writeCommandRejectionDiagnostic({
      runtime,
      command,
      errors,
      category: "command_rejected",
      message: "Command rejected by command reservation.",
      expectedStateVersion: options.expectedStateVersion
    });
    return { runtime, errors };
  }

  if (runtime.processedCommandIds.has(command.id)) {
    const errors = [createWarmRuntimeDuplicateError(command.id)];
    await reservationRepository.markRejected(runtime.record.id, command.id, errors);
    await writeCommandRejectionDiagnostic({
      runtime,
      command,
      errors,
      category: "command_rejected",
      message: "Command rejected by restored runtime duplicate guard.",
      expectedStateVersion: options.expectedStateVersion
    });
    return { runtime, errors };
  }

  runtime.processedCommandIds.add(command.id);
  recordCommandRateLimitUsage(runtime, command);

  try {
    await runtime.replayLogWriter.writeCommand({
      id: `cmd:${command.id}`,
      instanceId: runtime.record.id,
      command,
      receivedAt: reservedAt,
      actorId: command.playerId,
      correlationId: command.clientRequestId,
      tickAtReceive: runtime.state.root.tick
    });
  } catch (error) {
    const errors = [createCommandPersistenceError(error)];
    await reservationRepository.markRejected(runtime.record.id, command.id, errors);
    return { runtime, errors };
  }

  const previousRootVersion = runtime.state.root.version;
  const result = applyCommand(runtime.state, command, { config: runtime.config });

  if (result.errors.length > 0) {
    await reservationRepository.markRejected(runtime.record.id, command.id, result.errors);
    await writeCommandRejectionDiagnostic({
      runtime,
      command,
      errors: result.errors,
      category: "command_rejected",
      message: "Command rejected."
    });
    return { runtime, errors: result.errors };
  }

  const nextState = ensureAdvancedRootVersion(result.nextState, previousRootVersion);
  const appliedAt = runtime.clock.nowIso();
  const appliedEvent: InstanceRuntimeEvent = {
    type: "command-applied",
    payload: { commandId: command.id, eventCount: result.events.length },
    occurredAt: appliedAt
  };

  try {
    await runtime.replayLogWriter.writeEvent({
      id: `evt:${command.id}:${nextState.root.tick}`,
      instanceId: runtime.record.id,
      event: appliedEvent,
      causedByCommandId: command.id,
      recordedAt: appliedAt,
      tickAtEmit: nextState.root.tick
    });
    await writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "command", "Command dispatched.", {
      commandId: command.id,
      commandType: command.type
    }, runtime.clock);
  } catch (error) {
    const errors = [createCommandPersistenceError(error)];
    await reservationRepository.markRejected(runtime.record.id, command.id, errors);
    return { runtime, errors };
  }

  runtime.state = nextState;
  runtime.eventQueue.enqueue(appliedEvent);
  runtime.eventPublisher.publish(appliedEvent);
  await reservationRepository.markApplied(runtime.record.id, command.id, {
    updatedAt: appliedAt,
    rootVersion: runtime.state.root.version,
    eventCount: result.events.length
  });

  return { runtime, errors: [] };
};

const ensureAdvancedRootVersion = (state: CoreGameState, previousRootVersion: number): CoreGameState =>
  state.root.version > previousRootVersion
    ? state
    : { ...state, root: { ...state.root, version: previousRootVersion + 1 } };

const createDuplicateReservationErrors = (
  record: {
    status: "pending" | "applied" | "rejected";
    commandId: string;
    payloadHash: string;
    reservedAt: string;
    appliedAt: string | null;
    rejectedAt: string | null;
    appliedMetadata: Record<string, unknown> | null;
    rejectionErrors: DomainError[] | null;
  },
  incomingPayloadHash: string
): DomainError[] => {
  if (record.payloadHash !== incomingPayloadHash) {
    return [{ code: "server.command_payload_conflict", message: "Command id was already reserved with a different payload.", details: { commandId: record.commandId } }];
  }
  if (record.status === "pending") {
    return [{ code: "server.command_in_flight", message: "Command id is already reserved by an in-flight submit.", details: { commandId: record.commandId, reservedAt: record.reservedAt } }];
  }
  if (record.status === "applied") {
    return [{
      code: "server.command_already_applied",
      message: "Command id was already applied by this server instance.",
      details: {
        commandId: record.commandId,
        appliedAt: record.appliedAt,
        rootVersion: record.appliedMetadata?.rootVersion ?? null,
        eventCount: record.appliedMetadata?.eventCount ?? null
      }
    }];
  }
  return record.rejectionErrors && record.rejectionErrors.length > 0
    ? record.rejectionErrors
    : [{ code: "server.duplicate_command", message: "Command id was already rejected by this server instance.", details: { commandId: record.commandId, rejectedAt: record.rejectedAt } }];
};

const createReservationUnavailableError = (): DomainError => ({
  code: "server.command_reservation_unavailable",
  message: "Command reservation repository is unavailable for this server instance."
});

const createWarmRuntimeDuplicateError = (commandId: string): DomainError => ({
  code: "server.duplicate_command",
  message: "Command id was already processed by this server instance.",
  details: { commandId }
});

const createCommandPersistenceError = (error: unknown): DomainError => ({
  code: "server.command_persistence_failed",
  message: "Command could not be persisted safely before gameplay dispatch.",
  details: { reason: error instanceof Error ? error.name : "unknown" }
});
