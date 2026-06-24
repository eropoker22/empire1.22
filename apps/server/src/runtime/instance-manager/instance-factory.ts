import { createInitialState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { GameModeId, ServerInstanceId } from "@empire/shared-types";
import { createNullInstanceEventPublisher } from "../events/instance-event-publisher";
import { InstanceEventQueue } from "../events/instance-event-queue";
import { createInstanceLogger } from "../logging/instance-logger";
import { createInstanceMonitorSnapshot } from "../monitoring/instance-metrics";
import type {
  CommandLogRepository,
  CommandReservationRepository,
  CommandResultRepository,
  DiagnosticLogRepository,
  EventLogRepository,
  RuntimeOutboxRepository,
  SnapshotRepository
} from "../persistence/repositories";
import {
  createFileCommandLogRepository,
  createFileCommandReservationRepository,
  createFileDiagnosticLogRepository,
  createFileEventLogRepository,
  createFileSnapshotRepository,
  createInMemoryCommandLogRepository,
  createInMemoryCommandReservationRepository,
  createInMemoryCommandResultRepository,
  createInMemoryDiagnosticLogRepository,
  createInMemoryEventLogRepository,
  createInMemoryRuntimeOutboxRepository,
  createInMemorySnapshotRepository
} from "../persistence/repositories";
import { createReplayLogWriter } from "../persistence/services/replay-log-writer";
import { createPostgresRuntimePersistenceRepositories } from "../persistence/postgres";
import type { RuntimeTickLock } from "../persistence/tick-lock";
import { systemClock, type Clock } from "../scheduling/clock";
import { createInstanceScheduler } from "../scheduling/instance-scheduler";
import { createGameStateRepository } from "../snapshots/game-state-repository";
import { createSnapshotController } from "../snapshots/instance-snapshot-controller";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";

export interface ServerRuntimePersistenceRepositories {
  commandLogRepository: CommandLogRepository;
  eventLogRepository: EventLogRepository;
  diagnosticLogRepository: DiagnosticLogRepository;
  snapshotRepository: SnapshotRepository;
  commandReservationRepository?: CommandReservationRepository;
  commandResultRepository?: CommandResultRepository;
  outboxRepository?: RuntimeOutboxRepository;
  tickLock?: RuntimeTickLock;
  atomicCommandPersistenceMode?: "transactional" | "best-effort" | "unavailable";
  close?(): Promise<void>;
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
  commandReservationRepository: createInMemoryCommandReservationRepository(),
  commandResultRepository: createInMemoryCommandResultRepository(),
  eventLogRepository: createInMemoryEventLogRepository(),
  outboxRepository: createInMemoryRuntimeOutboxRepository(),
  diagnosticLogRepository: createInMemoryDiagnosticLogRepository(),
  snapshotRepository: createInMemorySnapshotRepository(),
  atomicCommandPersistenceMode: "transactional"
});

export interface FileRuntimePersistenceOptions {
  rootDir: string;
}

export const createFileRuntimePersistenceRepositories = (
  options: FileRuntimePersistenceOptions
): ServerRuntimePersistenceRepositories => ({
  commandLogRepository: createFileCommandLogRepository({ rootDir: options.rootDir }),
  commandReservationRepository: createFileCommandReservationRepository({ rootDir: options.rootDir }),
  commandResultRepository: createInMemoryCommandResultRepository(),
  eventLogRepository: createFileEventLogRepository({ rootDir: options.rootDir }),
  outboxRepository: createInMemoryRuntimeOutboxRepository(),
  diagnosticLogRepository: createFileDiagnosticLogRepository({ rootDir: options.rootDir }),
  snapshotRepository: createFileSnapshotRepository({ rootDir: options.rootDir }),
  atomicCommandPersistenceMode: "best-effort"
});

export const createRuntimePersistenceRepositoriesFromEnvironment = (
  environment: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {}
): ServerRuntimePersistenceRepositories => {
  const driver = String(environment.EMPIRE_PERSISTENCE_DRIVER ?? environment.GAMEPLAY_PERSISTENCE_DRIVER ?? "memory")
    .trim()
    .toLowerCase();

  if (driver === "file") {
    const rootDir = String(environment.EMPIRE_PERSISTENCE_DIR ?? environment.GAMEPLAY_PERSISTENCE_DIR ?? ".empire-persistence").trim();
    return createFileRuntimePersistenceRepositories({ rootDir });
  }

  if (driver === "postgres") {
    const databaseUrl = String(environment.EMPIRE_DATABASE_URL ?? environment.GAMEPLAY_DATABASE_URL ?? "").trim();
    return createPostgresRuntimePersistenceRepositories({ databaseUrl });
  }

  if (driver === "memory") {
    return createInMemoryRuntimePersistenceRepositories();
  }

  throw new Error(`Unsupported runtime persistence driver "${driver}". Expected "memory", "file", or "postgres".`);
};

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
  const snapshotController = createSnapshotController(createGameStateRepository(persistence.snapshotRepository));
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
    commandReservationRepository: persistence.commandReservationRepository,
    commandResultRepository: persistence.commandResultRepository,
    outboxRepository: persistence.outboxRepository,
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
