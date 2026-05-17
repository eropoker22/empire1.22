import { createInitialState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { GameModeId, ServerInstanceId } from "@empire/shared-types";
import { createNullInstanceEventPublisher } from "../events/instance-event-publisher";
import { InstanceEventQueue } from "../events/instance-event-queue";
import { createInstanceLogger } from "../logging/instance-logger";
import { createInstanceMonitorSnapshot } from "../monitoring/instance-metrics";
import type {
  CommandLogRepository,
  DiagnosticLogRepository,
  EventLogRepository
} from "../persistence/repositories";
import {
  createInMemoryCommandLogRepository,
  createInMemoryDiagnosticLogRepository,
  createInMemoryEventLogRepository
} from "../persistence/repositories";
import { createReplayLogWriter } from "../persistence/services/replay-log-writer";
import { systemClock, type Clock } from "../scheduling/clock";
import { createInstanceScheduler } from "../scheduling/instance-scheduler";
import { createNullGameStateRepository } from "../snapshots/game-state-repository";
import { createSnapshotController } from "../snapshots/instance-snapshot-controller";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";

export interface ServerRuntimePersistenceRepositories {
  commandLogRepository: CommandLogRepository;
  eventLogRepository: EventLogRepository;
  diagnosticLogRepository: DiagnosticLogRepository;
}

export interface ServerInstanceRuntimeOptions {
  clock?: Clock;
  persistence?: ServerRuntimePersistenceRepositories;
  displayName?: string;
  region?: string;
  capacity?: number;
}

export const createInMemoryRuntimePersistenceRepositories = (): ServerRuntimePersistenceRepositories => ({
  commandLogRepository: createInMemoryCommandLogRepository(),
  eventLogRepository: createInMemoryEventLogRepository(),
  diagnosticLogRepository: createInMemoryDiagnosticLogRepository()
});

/**
 * Responsibility: Creates isolated runtime containers for new server instances.
 * Belongs here: one-time composition of config, state, logger, queue, and scheduler.
 * Does not belong here: cross-instance registry concerns or transport adapters.
 */
export const createServerInstanceRuntime = (
  instanceId: ServerInstanceId,
  mode: GameModeId,
  options: ServerInstanceRuntimeOptions = {}
): ServerInstanceRuntime => {
  const clock = options.clock ?? systemClock;
  const persistence = options.persistence ?? createInMemoryRuntimePersistenceRepositories();
  const config = resolveModeConfig(mode);
  const maxPlayers = normalizeCapacity(options.capacity, config.balance.maxPlayersPerServer);
  const state = createInitialState(instanceId, mode);
  const eventQueue = new InstanceEventQueue();
  const eventPublisher = createNullInstanceEventPublisher();
  const runtimeHealth = {
    lastErrorAt: null,
    lastTickStartedAt: null,
    lastTickCompletedAt: null
  };
  const logger = createInstanceLogger(instanceId, undefined, clock);
  const replayLogWriter = createReplayLogWriter(
    persistence.commandLogRepository,
    persistence.eventLogRepository,
    persistence.diagnosticLogRepository
  );
  const scheduler = createInstanceScheduler(config.tickRateMs);
  const snapshotController = createSnapshotController(createNullGameStateRepository());
  const processedCommandIds = new Set<string>();
  const commandRateLimitWindow = {
    tick: state.root.tick,
    commandCountsByPlayerId: {}
  };

  const runtime: ServerInstanceRuntime = {
    record: {
      id: instanceId,
      mode,
      configKey: mode,
      status: "created",
      createdAt: clock.nowIso(),
      startedAt: null,
      stoppedAt: null,
      crashCount: 0,
      version: 1
    },
    lobby: {
      displayName: options.displayName?.trim() || createDefaultDisplayName(mode, instanceId),
      region: options.region?.trim() || "local-dev",
      maxPlayers,
      joinPolicy: "open"
    },
    config,
    state,
    eventQueue,
    eventPublisher,
    runtimeHealth,
    logger,
    replayLogWriter,
    scheduler,
    clock,
    snapshotController,
    processedCommandIds,
    commandRateLimitWindow
  };

  createInstanceMonitorSnapshot(runtime.record, runtime.state, runtime.eventQueue, runtime.runtimeHealth);

  return runtime;
};

const normalizeCapacity = (
  requestedCapacity: number | undefined,
  configuredMaxPlayers: number
): number => {
  if (typeof requestedCapacity !== "number" || !Number.isFinite(requestedCapacity)) {
    return configuredMaxPlayers;
  }

  return Math.max(1, Math.min(Math.floor(requestedCapacity), configuredMaxPlayers));
};

const createDefaultDisplayName = (
  mode: GameModeId,
  instanceId: ServerInstanceId
): string => `${mode.toUpperCase()} ${String(instanceId).split(":").at(-1) ?? "server"}`;
