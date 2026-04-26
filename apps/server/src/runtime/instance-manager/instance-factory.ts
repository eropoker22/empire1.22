import { createInitialState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { GameModeId, ServerInstanceId } from "@empire/shared-types";
import { createNullInstanceEventPublisher } from "../events/instance-event-publisher";
import { InstanceEventQueue } from "../events/instance-event-queue";
import { createInstanceLogger } from "../logging/instance-logger";
import { createInstanceMonitorSnapshot } from "../monitoring/instance-metrics";
import { createNullCommandLogRepository } from "../persistence/repositories/command-log-repository";
import { createNullDiagnosticLogRepository } from "../persistence/repositories/diagnostic-log-repository";
import { createNullEventLogRepository } from "../persistence/repositories/event-log-repository";
import { createReplayLogWriter } from "../persistence/services/replay-log-writer";
import { createInstanceScheduler } from "../scheduling/instance-scheduler";
import { createNullGameStateRepository } from "../snapshots/game-state-repository";
import { createSnapshotController } from "../snapshots/instance-snapshot-controller";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";

/**
 * Responsibility: Creates isolated runtime containers for new server instances.
 * Belongs here: one-time composition of config, state, logger, queue, and scheduler.
 * Does not belong here: cross-instance registry concerns or transport adapters.
 */
export const createServerInstanceRuntime = (
  instanceId: ServerInstanceId,
  mode: GameModeId
): ServerInstanceRuntime => {
  const config = resolveModeConfig(mode);
  const state = createInitialState(instanceId, mode);
  const eventQueue = new InstanceEventQueue();
  const eventPublisher = createNullInstanceEventPublisher();
  const runtimeHealth = {
    lastErrorAt: null,
    lastTickStartedAt: null,
    lastTickCompletedAt: null
  };
  const logger = createInstanceLogger(instanceId);
  const replayLogWriter = createReplayLogWriter(
    createNullCommandLogRepository(),
    createNullEventLogRepository(),
    createNullDiagnosticLogRepository()
  );
  const scheduler = createInstanceScheduler(config.tickRateMs);
  const snapshotController = createSnapshotController(createNullGameStateRepository());

  const runtime: ServerInstanceRuntime = {
    record: {
      id: instanceId,
      mode,
      configKey: mode,
      status: "created",
      createdAt: new Date(0).toISOString(),
      startedAt: null,
      stoppedAt: null,
      crashCount: 0,
      version: 1
    },
    config,
    state,
    eventQueue,
    eventPublisher,
    runtimeHealth,
    logger,
    replayLogWriter,
    scheduler,
    snapshotController
  };

  createInstanceMonitorSnapshot(runtime.record, runtime.state, runtime.eventQueue, runtime.runtimeHealth);

  return runtime;
};
