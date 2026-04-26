import type { ServerInstanceId } from "@empire/shared-types";

/**
 * Responsibility: Runtime-only metadata for one live server instance process.
 * Belongs here: scheduler markers, dirty sets, and queue metadata.
 * Does not belong here: persistent authoritative game truth.
 */
export interface ServerInstanceRuntimeState {
  serverInstanceId: ServerInstanceId;
  schedulerStatus: "idle" | "running" | "paused";
  dirtyEntityKeys: string[];
  pendingCommandIds: string[];
  activeConnectionCount: number;
}

