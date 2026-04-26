import type { GameModeId, ServerInstanceId } from "@empire/shared-types";

/**
 * Responsibility: Persistent lifecycle metadata for one instance independent of runtime-only data.
 * Belongs here: mode, status, timestamps, crash counters, and config identity.
 * Does not belong here: live scheduler state, event queues, or transport connections.
 */
export interface InstanceMetadataRecord {
  instanceId: ServerInstanceId;
  mode: GameModeId;
  configKey: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  stoppedAt: string | null;
  crashCount: number;
  lastCrashAt: string | null;
  version: number;
}

