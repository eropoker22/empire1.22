import type { CoreGameState } from "@empire/game-core";
import type { ServerInstanceRecord } from "../instance/server-instance-record";
import type { InstanceMonitorSnapshot } from "./instance-monitor-snapshot";
import type { InstanceEventQueue } from "../events/instance-event-queue";
import type { InstanceRuntimeHealth } from "../instance/instance-runtime-health";

/**
 * Responsibility: Builds lightweight monitoring data for admin and diagnostics.
 * Belongs here: projections from instance record, state, and queue sizes.
 * Does not belong here: alert transport or raw log persistence.
 */
export const createInstanceMonitorSnapshot = (
  record: ServerInstanceRecord,
  state: CoreGameState,
  eventQueue: InstanceEventQueue,
  runtimeHealth: InstanceRuntimeHealth
): InstanceMonitorSnapshot => ({
  instanceId: record.id,
  mode: record.mode,
  status: record.status,
  tick: state.root.tick,
  queuedEventCount: eventQueue.size(),
  playerCount: state.root.playerIds.length,
  crashCount: record.crashCount,
  lastErrorAt: runtimeHealth.lastErrorAt,
  lastTickStartedAt: runtimeHealth.lastTickStartedAt,
  lastTickCompletedAt: runtimeHealth.lastTickCompletedAt
});
