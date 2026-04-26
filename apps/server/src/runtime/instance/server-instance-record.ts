import type { ServerInstanceId } from "@empire/shared-types";
import type { GameModeId } from "@empire/shared-types";
import type { InstanceStatus } from "./instance-status";

/**
 * Responsibility: Persistent-friendly metadata record for one game instance.
 * Belongs here: identity, mode, lifecycle timestamps, and crash counters.
 * Does not belong here: in-memory queues, timers, or entity maps.
 */
export interface ServerInstanceRecord {
  id: ServerInstanceId;
  mode: GameModeId;
  configKey: string;
  status: InstanceStatus;
  createdAt: string;
  startedAt: string | null;
  stoppedAt: string | null;
  crashCount: number;
  version: number;
}

