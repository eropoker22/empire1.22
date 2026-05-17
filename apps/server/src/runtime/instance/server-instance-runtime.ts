import type { CoreGameState } from "@empire/game-core";
import type { ResolvedGameModeConfig } from "@empire/game-config";
import type { InstanceEventQueue } from "../events/instance-event-queue";
import type { InstanceEventPublisher } from "../events/instance-event-publisher";
import type { ServerInstanceRecord } from "./server-instance-record";
import type { ServerInstanceLobbyMetadata } from "./server-instance-lobby-metadata";
import type { InstanceRuntimeHealth } from "./instance-runtime-health";
import type { InstanceLogger } from "../logging/instance-logger";
import type { ReplayLogWriter } from "../persistence/services/replay-log-writer";
import type { InstanceScheduler } from "../scheduling/instance-scheduler";
import type { Clock } from "../scheduling/clock";
import type { InstanceSnapshotController } from "../snapshots/instance-snapshot-controller";

/**
 * Responsibility: In-memory runtime container for one isolated game instance.
 * Belongs here: config, authoritative state, scheduler, logs, and snapshot boundary.
 * Does not belong here: cross-instance orchestration or transport routing.
 */
export interface ServerInstanceRuntime {
  record: ServerInstanceRecord;
  lobby: ServerInstanceLobbyMetadata;
  config: ResolvedGameModeConfig;
  state: CoreGameState;
  eventQueue: InstanceEventQueue;
  eventPublisher: InstanceEventPublisher;
  runtimeHealth: InstanceRuntimeHealth;
  logger: InstanceLogger;
  replayLogWriter: ReplayLogWriter;
  scheduler: InstanceScheduler;
  clock: Clock;
  snapshotController: InstanceSnapshotController;
  processedCommandIds: Set<string>;
  commandRateLimitWindow: CommandRateLimitWindow;
}

export interface CommandRateLimitWindow {
  tick: number;
  commandCountsByPlayerId: Record<string, number>;
}
