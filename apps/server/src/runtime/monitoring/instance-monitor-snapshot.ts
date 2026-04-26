import type { ServerInstanceId } from "@empire/shared-types";
import type { GameModeId } from "@empire/shared-types";
import type { InstanceStatus } from "../instance/instance-status";

/**
 * Responsibility: Admin-safe monitoring snapshot for one runtime instance.
 * Belongs here: health, queue, tick, and lifecycle telemetry.
 * Does not belong here: full authoritative game state or hidden gameplay payloads.
 */
export interface InstanceMonitorSnapshot {
  instanceId: ServerInstanceId;
  mode: GameModeId;
  status: InstanceStatus;
  tick: number;
  queuedEventCount: number;
  playerCount: number;
  crashCount: number;
  lastErrorAt: string | null;
  lastTickCompletedAt: string | null;
}
