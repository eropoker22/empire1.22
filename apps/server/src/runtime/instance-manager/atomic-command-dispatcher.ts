import { applyCommand, type CoreGameState } from "@empire/game-core";
import type { GameCommand, InstanceRuntimeEvent } from "@empire/shared-types";
import { findSharedCitySpawnCandidate } from "../../bootstrap/gameplay-slice-shared-city-seed";
import {
  createDueAuthoritativeCheckpoint,
  createInstanceSnapshot,
  restoreRuntimeFromSnapshot
} from "../persistence";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import type { CommandDispatchOptions, InstanceCommandDispatchResult } from "../orchestration";
import { writeCommandRejectionDiagnostic } from "../logging";
import {
  createCommandReservationPayload,
  createCommandReservationPayloadHash
} from "./command-reservation-payload";
import {
  recordCommandRateLimitUsage,
  validateCommandDispatchGate
} from "./instance-command-gates";
import { withInstanceCommandLock } from "./instance-command-lock";
import {
  createAppliedCommandResult, createCommandLogRecordId,
  createEventRecord,
  createOutboxRecord,
  createRejectedCommandResult,
  createReservationUnavailableError
} from "./atomic-command-records";
import { replayReservedCommand } from "./atomic-command-replay";
import {
  HostedRuntimeStatusFenceRejectedError,
  type AtomicCommandTransactionRepositories
} from "./atomic-command-transaction";
import {
  beginRuntimeCommandPerformance,
  markRuntimeCommandResolved,
  recordRuntimeCommandCompleted,
  type RuntimeCommandPerformanceTracker
} from "../monitoring/runtime-performance-diagnostics";
import {
  finalizeCommittedCommand,
  type AtomicCommandCrashPoint,
  type BoundaryDispatchResult
} from "./atomic-command-finalizer";

export type { AtomicCommandCrashPoint } from "./atomic-command-finalizer";

export interface AtomicCommandDispatcherOptions {
  crashInjector?: (point: AtomicCommandCrashPoint) => void | Promise<void>;
}

export const dispatchAtomicInstanceCommand = async (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  options: CommandDispatchOptions = {},
  dispatcherOptions: AtomicCommandDispatcherOptions = {}
): Promise<InstanceCommandDispatchResult> => {
  const performanceTracker = beginRuntimeCommandPerformance(runtime, command);
  try {
    const result = await withInstanceCommandLock(runtime.record.id, () =>
      dispatchAtomicInstanceCommandUnlocked(runtime, command, options, dispatcherOptions, performanceTracker)
    );
    recordRuntimeCommandCompleted(runtime, performanceTracker, result.errors.length > 0 ? "rejected" : "applied");
    return result;
  } catch (error) {
    recordRuntimeCommandCompleted(runtime, performanceTracker, "error");
    throw error;
  }
};

const dispatchAtomicInstanceCommandUnlocked = async (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  options: CommandDispatchOptions,
  dispatcherOptions: AtomicCommandDispatcherOptions,
  performanceTracker: RuntimeCommandPerformanceTracker | null
): Promise<InstanceCommandDispatchResult> => {
  const reservationRepository = runtime.commandReservationRepository;
  const commandResultRepository = runtime.commandResultRepository;
  const outboxRepository = runtime.outboxRepository;
  const commandLogRepository = runtime.commandLogRepository;
  const eventLogRepository = runtime.eventLogRepository;
  const snapshotRepository = runtime.snapshotRepository;
  const crash = dispatcherOptions.crashInjector ?? runtime.atomicCommandCrashInjector;

  if (
    !commandLogRepository ||
    !reservationRepository ||
    !commandResultRepository ||
    !eventLogRepository ||
    !outboxRepository ||
    !snapshotRepository
  ) {
    markRuntimeCommandResolved(performanceTracker);
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

  const repositories: AtomicCommandTransactionRepositories = {
    commandLogRepository,
    commandReservationRepository: reservationRepository,
    commandResultRepository,
    eventLogRepository,
    outboxRepository,
    snapshotRepository
  };

  if (runtime.atomicCommandTransaction) {
    let committed: BoundaryDispatchResult;
    try {
      committed = await runtime.atomicCommandTransaction.run(
        runtime.record.id,
        (txRepositories) => dispatchAtomicInstanceCommandInBoundary(runtime, command, options, crash, txRepositories, performanceTracker),
        { hostedStatusFence: "running-if-present" }
      );
    } catch (error) {
      if (error instanceof HostedRuntimeStatusFenceRejectedError) {
        markRuntimeCommandResolved(performanceTracker);
        return { runtime, errors: [{ code: "server.instance_not_running",
          message: "Server instance is not accepting gameplay commands." }], commandResult: null };
      }
      throw error;
    }
    return finalizeCommittedCommand(runtime, command, options, committed, crash);
  }

  const committed = await dispatchAtomicInstanceCommandInBoundary(runtime, command, options, crash, repositories, performanceTracker);
  return finalizeCommittedCommand(runtime, command, options, committed, crash);
};

const dispatchAtomicInstanceCommandInBoundary = async (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  options: CommandDispatchOptions,
  crash: ((point: AtomicCommandCrashPoint) => void | Promise<void>) | undefined,
  repositories: AtomicCommandTransactionRepositories,
  performanceTracker: RuntimeCommandPerformanceTracker | null
): Promise<BoundaryDispatchResult> => {
  const latestSnapshot = await repositories.snapshotRepository.loadRecoveryHead(runtime.record.id);
  if (latestSnapshot && latestSnapshot.integrity.rootVersion > runtime.state.root.version) {
    restoreRuntimeFromSnapshot(runtime, latestSnapshot);
  }
  const reservedAt = runtime.clock.nowIso();
  const authoritativeCommand: GameCommand = {
    ...command,
    issuedAt: reservedAt
  };
  const payload = createCommandReservationPayload(authoritativeCommand);
  const payloadHash = createCommandReservationPayloadHash(command);
  const reservation = await repositories.commandReservationRepository.reserve({
    serverInstanceId: runtime.record.id,
    commandId: command.id,
    commandType: authoritativeCommand.type,
    playerId: authoritativeCommand.playerId,
    payloadHash,
    payload,
    reservedAt
  });
  await crash?.("afterReserve");

  if (!reservation.created) {
    const replay = await replayReservedCommand(runtime, command, reservation.record, payloadHash, repositories.commandResultRepository);
    markRuntimeCommandResolved(performanceTracker);
    return {
      errors: replay.errors,
      commandResult: replay.commandResult,
      nextState: null,
      appliedEvent: null,
      commandRateLimitWindow: null
    };
  }

  const gateErrors = validateCommandDispatchGate(runtime, authoritativeCommand, {
    ...options,
    skipProcessedCommandIdGate: true
  });
  if (gateErrors.length > 0) {
    markRuntimeCommandResolved(performanceTracker);
    const result = createRejectedCommandResult(runtime, authoritativeCommand, payloadHash, runtime.state.root.version, gateErrors, reservedAt);
    await repositories.commandResultRepository.save(result);
    await repositories.commandReservationRepository.markRejected(runtime.record.id, command.id, gateErrors);
    return {
      errors: gateErrors,
      commandResult: result,
      nextState: null,
      appliedEvent: null,
      commandRateLimitWindow: null
    };
  }

  await repositories.commandLogRepository.append({
    id: createCommandLogRecordId(runtime.record.id, command.id),
    instanceId: runtime.record.id,
    command: authoritativeCommand,
    receivedAt: reservedAt,
    actorId: authoritativeCommand.playerId,
    correlationId: authoritativeCommand.clientRequestId,
    tickAtReceive: runtime.state.root.tick
  });
  await crash?.("afterCommandLog");

  const previousRootVersion = runtime.state.root.version;
  const result = applyCommand(runtime.state, authoritativeCommand, {
    config: runtime.config,
    clock: runtime.clock,
    mapRules: {
      isEnabledSpawnCandidate: (districtId) =>
        Boolean(findSharedCitySpawnCandidate(districtId)?.enabled)
    }
  });

  if (result.errors.length > 0) {
    markRuntimeCommandResolved(performanceTracker);
    const commandResult = createRejectedCommandResult(runtime, authoritativeCommand, payloadHash, previousRootVersion, result.errors, reservedAt);
    await repositories.commandResultRepository.save(commandResult);
    await repositories.commandReservationRepository.markRejected(runtime.record.id, command.id, result.errors);
    return {
      errors: result.errors,
      commandResult,
      nextState: null,
      appliedEvent: null,
      commandRateLimitWindow: null
    };
  }
  await crash?.("afterApplyBeforeSnapshot");
  const nextState = ensureAdvancedRootVersion(result.nextState, previousRootVersion);
  const appliedAt = runtime.clock.nowIso();
  const appliedEvent: InstanceRuntimeEvent = {
    type: "command-applied",
    payload: { commandId: authoritativeCommand.id, eventCount: result.events.length },
    occurredAt: appliedAt
  };
  const eventRecord = createEventRecord(runtime, authoritativeCommand, appliedEvent, nextState, appliedAt);
  const stagedRuntime = {
    ...runtime,
    state: nextState,
    processedCommandIds: new Set([...runtime.processedCommandIds, authoritativeCommand.id]),
    commandRateLimitWindow: {
      tick: runtime.commandRateLimitWindow.tick,
      commandCountsByPlayerId: { ...runtime.commandRateLimitWindow.commandCountsByPlayerId }
    }
  };
  recordCommandRateLimitUsage(stagedRuntime, authoritativeCommand);
  const snapshot = createInstanceSnapshot(stagedRuntime);
  const checkpoint = createDueAuthoritativeCheckpoint({
    snapshot,
    previousPhase: runtime.state.root.phase,
    snapshotIntervalTicks: runtime.config.technical.snapshotIntervalTicks,
    includePeriodic: false
  });
  markRuntimeCommandResolved(performanceTracker);

  await repositories.snapshotRepository.saveRecoveryHead(snapshot);
  if (checkpoint) await repositories.snapshotRepository.saveCheckpoint(checkpoint);
  await crash?.("afterSnapshotBeforeMarkApplied");
  await repositories.eventLogRepository.append(eventRecord);
  const commandResult = createAppliedCommandResult({
    runtime,
    command: authoritativeCommand,
    payloadHash,
    previousRootVersion,
    nextState,
    eventRecord,
    snapshotId: snapshot.snapshotId,
    createdAt: reservedAt,
    appliedAt
  });
  await repositories.commandResultRepository.save(commandResult);
  await repositories.commandReservationRepository.markApplied(runtime.record.id, authoritativeCommand.id, {
    updatedAt: appliedAt,
    rootVersion: nextState.root.version,
    eventCount: result.events.length,
    eventIds: commandResult.eventIds,
    snapshotId: snapshot.snapshotId
  });
  await repositories.outboxRepository.append(createOutboxRecord(runtime, authoritativeCommand, appliedEvent, appliedAt));
  await crash?.("afterMarkAppliedBeforeCommit");

  return {
    errors: [],
    commandResult,
    nextState,
    appliedEvent,
    commandRateLimitWindow: stagedRuntime.commandRateLimitWindow
  };
};

const ensureAdvancedRootVersion = (state: CoreGameState, previousRootVersion: number): CoreGameState =>
  state.root.version > previousRootVersion
    ? state
    : { ...state, root: { ...state.root, version: previousRootVersion + 1 } };
