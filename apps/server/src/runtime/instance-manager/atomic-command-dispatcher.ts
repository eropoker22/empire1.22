import { applyCommand, type CoreGameState } from "@empire/game-core";
import type { GameCommand, InstanceRuntimeEvent } from "@empire/shared-types";
import { findSharedCitySpawnCandidate } from "../../bootstrap/gameplay-slice-shared-city-seed";
import { createInstanceSnapshot } from "../persistence";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import type { CommandDispatchOptions, InstanceCommandDispatchResult } from "../orchestration";
import { writeCommandRejectionDiagnostic, writeDiagnosticLog } from "../logging";
import {
  createCommandReservationPayload,
  createCommandReservationPayloadHash
} from "./command-reservation-payload";
import {
  recordCommandRateLimitUsage,
  validateCommandDispatchGate
} from "./instance-command-gates";
import {
  createAppliedCommandResult,
  createEventRecord,
  createOutboxRecord,
  createRejectedCommandResult,
  createReservationUnavailableError
} from "./atomic-command-records";
import { publishOutbox } from "./atomic-command-outbox";
import { replayReservedCommand } from "./atomic-command-replay";

export type AtomicCommandCrashPoint = "afterReserve" | "afterCommandLog" | "afterApplyBeforeSnapshot" |
  "afterSnapshotBeforeMarkApplied" | "afterMarkAppliedBeforeCommit" | "afterCommitBeforePublish" |
  "duringOutboxPublish";

export interface AtomicCommandDispatcherOptions {
  crashInjector?: (point: AtomicCommandCrashPoint) => void | Promise<void>;
}

const instanceLocks = new Map<string, Promise<void>>();

export const dispatchAtomicInstanceCommand = async (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  options: CommandDispatchOptions = {},
  dispatcherOptions: AtomicCommandDispatcherOptions = {}
): Promise<InstanceCommandDispatchResult> =>
  withInstanceCommandLock(runtime.record.id, () =>
    dispatchAtomicInstanceCommandUnlocked(runtime, command, options, dispatcherOptions)
  );

const dispatchAtomicInstanceCommandUnlocked = async (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  options: CommandDispatchOptions,
  dispatcherOptions: AtomicCommandDispatcherOptions
): Promise<InstanceCommandDispatchResult> => {
  const reservationRepository = runtime.commandReservationRepository;
  const commandResultRepository = runtime.commandResultRepository;
  const outboxRepository = runtime.outboxRepository;
  const crash = dispatcherOptions.crashInjector ?? runtime.atomicCommandCrashInjector;

  if (!reservationRepository || !commandResultRepository || !outboxRepository) {
    const errors = [createReservationUnavailableError()];
    await writeCommandRejectionDiagnostic({
      runtime,
      command,
      errors,
      category: "command_rejected",
      message: "Command rejected because atomic command persistence is unavailable.",
      expectedStateVersion: options.expectedStateVersion
    });
    return { runtime, errors, commandResult: null };
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
  await crash?.("afterReserve");

  if (!reservation.created) {
    return replayReservedCommand(runtime, command, reservation.record, payloadHash, commandResultRepository);
  }

  const gateErrors = validateCommandDispatchGate(runtime, command, {
    ...options,
    skipProcessedCommandIdGate: Boolean(reservationRepository)
  });
  if (gateErrors.length > 0) {
    const result = createRejectedCommandResult(runtime, command, payloadHash, runtime.state.root.version, gateErrors, reservedAt);
    await commandResultRepository.save(result);
    await reservationRepository.markRejected(runtime.record.id, command.id, gateErrors);
    await writeCommandRejectionDiagnostic({
      runtime,
      command,
      errors: gateErrors,
      category: "command_rejected",
      message: "Command rejected before core dispatch.",
      expectedStateVersion: options.expectedStateVersion
    });
    return { runtime, errors: gateErrors, commandResult: result };
  }

  await runtime.replayLogWriter.writeCommand({
    id: `cmd:${command.id}`,
    instanceId: runtime.record.id,
    command,
    receivedAt: reservedAt,
    actorId: command.playerId,
    correlationId: command.clientRequestId,
    tickAtReceive: runtime.state.root.tick
  });
  await crash?.("afterCommandLog");

  const previousRootVersion = runtime.state.root.version;
  const result = applyCommand(runtime.state, command, {
    config: runtime.config,
    mapRules: {
      isEnabledSpawnCandidate: (districtId) =>
        Boolean(findSharedCitySpawnCandidate(districtId)?.enabled)
    }
  });

  if (result.errors.length > 0) {
    const commandResult = createRejectedCommandResult(runtime, command, payloadHash, previousRootVersion, result.errors, reservedAt);
    await commandResultRepository.save(commandResult);
    await reservationRepository.markRejected(runtime.record.id, command.id, result.errors);
    await writeCommandRejectionDiagnostic({
      runtime,
      command,
      errors: result.errors,
      category: "command_rejected",
      message: "Command rejected."
    });
    return { runtime, errors: result.errors, commandResult };
  }

  await crash?.("afterApplyBeforeSnapshot");

  const nextState = ensureAdvancedRootVersion(result.nextState, previousRootVersion);
  const appliedAt = runtime.clock.nowIso();
  const appliedEvent: InstanceRuntimeEvent = {
    type: "command-applied",
    payload: { commandId: command.id, eventCount: result.events.length },
    occurredAt: appliedAt
  };
  const eventRecord = createEventRecord(runtime, command, appliedEvent, nextState, appliedAt);
  const stagedRuntime = {
    ...runtime,
    state: nextState,
    processedCommandIds: new Set([...runtime.processedCommandIds, command.id])
  };
  const snapshot = createInstanceSnapshot(stagedRuntime);

  await runtime.snapshotController.save(stagedRuntime);
  await crash?.("afterSnapshotBeforeMarkApplied");
  await runtime.replayLogWriter.writeEvent(eventRecord);
  await writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "command", "Command dispatched.", {
    commandId: command.id,
    commandType: command.type
  }, runtime.clock);

  const commandResult = createAppliedCommandResult({
    runtime,
    command,
    payloadHash,
    previousRootVersion,
    nextState,
    eventRecord,
    snapshotId: snapshot.snapshotId,
    createdAt: reservedAt,
    appliedAt
  });
  await commandResultRepository.save(commandResult);
  await reservationRepository.markApplied(runtime.record.id, command.id, {
    updatedAt: appliedAt,
    rootVersion: nextState.root.version,
    eventCount: result.events.length,
    eventIds: commandResult.eventIds,
    snapshotId: snapshot.snapshotId
  });
  await outboxRepository.append(createOutboxRecord(runtime, command, appliedEvent, appliedAt));
  await crash?.("afterMarkAppliedBeforeCommit");

  runtime.processedCommandIds.add(command.id);
  recordCommandRateLimitUsage(runtime, command);
  runtime.state = nextState;
  runtime.eventQueue.enqueue(appliedEvent);

  await crash?.("afterCommitBeforePublish");
  await publishOutbox(runtime, crash);
  return { runtime, errors: [], commandResult };
};

const ensureAdvancedRootVersion = (state: CoreGameState, previousRootVersion: number): CoreGameState =>
  state.root.version > previousRootVersion
    ? state
    : { ...state, root: { ...state.root, version: previousRootVersion + 1 } };

const withInstanceCommandLock = async <TResult>(
  instanceId: string,
  callback: () => Promise<TResult>
): Promise<TResult> => {
  const previous = instanceLocks.get(instanceId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  instanceLocks.set(instanceId, previous.then(() => current));
  await previous;
  try {
    return await callback();
  } finally {
    release();
    if (instanceLocks.get(instanceId) === current) {
      instanceLocks.delete(instanceId);
    }
  }
};
