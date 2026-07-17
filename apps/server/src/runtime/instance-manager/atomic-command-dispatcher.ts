import { applyCommand, type CoreGameState } from "@empire/game-core";
import type { GameCommand, InstanceRuntimeEvent } from "@empire/shared-types";
import { findSharedCitySpawnCandidate } from "../../bootstrap/gameplay-slice-shared-city-seed";
import { createInstanceSnapshot, restoreInstanceState } from "../persistence";
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
import type { AtomicCommandTransactionRepositories } from "./atomic-command-transaction";

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
    const committed = await runtime.atomicCommandTransaction.run(runtime.record.id, (txRepositories) =>
      dispatchAtomicInstanceCommandInBoundary(runtime, command, options, crash, txRepositories)
    );
    return finalizeCommittedCommand(runtime, command, options, committed, crash);
  }

  const committed = await dispatchAtomicInstanceCommandInBoundary(runtime, command, options, crash, repositories);
  return finalizeCommittedCommand(runtime, command, options, committed, crash);
};

interface BoundaryDispatchResult {
  errors: InstanceCommandDispatchResult["errors"];
  commandResult: InstanceCommandDispatchResult["commandResult"];
  nextState: CoreGameState | null;
  appliedEvent: InstanceRuntimeEvent | null;
  rateLimitCommand: GameCommand | null;
}

const dispatchAtomicInstanceCommandInBoundary = async (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  options: CommandDispatchOptions,
  crash: ((point: AtomicCommandCrashPoint) => void | Promise<void>) | undefined,
  repositories: AtomicCommandTransactionRepositories
): Promise<BoundaryDispatchResult> => {
  const latestSnapshot = await repositories.snapshotRepository.loadLatest(runtime.record.id);
  if (latestSnapshot && latestSnapshot.integrity.rootVersion > runtime.state.root.version) {
    runtime.state = restoreInstanceState(latestSnapshot);
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
    return {
      errors: replay.errors,
      commandResult: replay.commandResult,
      nextState: null,
      appliedEvent: null,
      rateLimitCommand: null
    };
  }

  const gateErrors = validateCommandDispatchGate(runtime, authoritativeCommand, {
    ...options,
    skipProcessedCommandIdGate: true
  });
  if (gateErrors.length > 0) {
    const result = createRejectedCommandResult(runtime, authoritativeCommand, payloadHash, runtime.state.root.version, gateErrors, reservedAt);
    await repositories.commandResultRepository.save(result);
    await repositories.commandReservationRepository.markRejected(runtime.record.id, command.id, gateErrors);
    return {
      errors: gateErrors,
      commandResult: result,
      nextState: null,
      appliedEvent: null,
      rateLimitCommand: null
    };
  }

  await repositories.commandLogRepository.append({
    id: `cmd:${command.id}`,
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
    const commandResult = createRejectedCommandResult(runtime, authoritativeCommand, payloadHash, previousRootVersion, result.errors, reservedAt);
    await repositories.commandResultRepository.save(commandResult);
    await repositories.commandReservationRepository.markRejected(runtime.record.id, command.id, result.errors);
    return {
      errors: result.errors,
      commandResult,
      nextState: null,
      appliedEvent: null,
      rateLimitCommand: null
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
    processedCommandIds: new Set([...runtime.processedCommandIds, authoritativeCommand.id])
  };
  const snapshot = createInstanceSnapshot(stagedRuntime);

  await repositories.snapshotRepository.save(snapshot);
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
    rateLimitCommand: authoritativeCommand
  };
};

const finalizeCommittedCommand = async (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  options: CommandDispatchOptions,
  committed: BoundaryDispatchResult,
  crash: ((point: AtomicCommandCrashPoint) => void | Promise<void>) | undefined
): Promise<InstanceCommandDispatchResult> => {
  if (!committed.nextState || !committed.appliedEvent) {
    if (committed.errors.length > 0) {
      await writeCommandRejectionDiagnostic({
        runtime,
        command,
        errors: committed.errors,
        category: "command_rejected",
        message: "Command rejected.",
        expectedStateVersion: options.expectedStateVersion
      }).catch(() => undefined);
    }
    return { runtime, errors: committed.errors, commandResult: committed.commandResult };
  }
  await writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "command", "Command dispatched.", {
    commandId: command.id,
    commandType: command.type
  }, runtime.clock).catch(() => undefined);
  runtime.processedCommandIds.add(command.id);
  if (committed.rateLimitCommand) {
    recordCommandRateLimitUsage(runtime, committed.rateLimitCommand);
  }
  runtime.state = committed.nextState;
  runtime.eventQueue.enqueue(committed.appliedEvent);
  await crash?.("afterCommitBeforePublish");
  await publishOutbox(runtime, crash);
  return { runtime, errors: committed.errors, commandResult: committed.commandResult };
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
