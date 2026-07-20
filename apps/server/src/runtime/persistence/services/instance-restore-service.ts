import type { ServerInstanceRuntime } from "../../instance";
import type { InstanceSnapshotDto } from "../dto";
import { restoreInstanceState } from "../mappers";
import type { SnapshotRepository } from "../repositories";

/**
 * Responsibility: Restores one instance state from the latest valid snapshot.
 * Belongs here: restore workflow and snapshot fallback policy.
 * Does not belong here: registry orchestration or scheduler control.
 */
export interface PersistenceRestoreService {
  restore(runtime: ServerInstanceRuntime): Promise<ServerInstanceRuntime>;
}

export const createPersistenceRestoreService = (
  snapshotRepository: SnapshotRepository
): PersistenceRestoreService => ({
  restore: async (runtime) => {
    const snapshot = await snapshotRepository.loadLatest(runtime.record.id);
    if (!snapshot) {
      return runtime;
    }
    return restoreRuntimeFromSnapshot(runtime, snapshot);
  }
});

export const restoreRuntimeFromSnapshot = (
  runtime: ServerInstanceRuntime,
  snapshot: InstanceSnapshotDto
): ServerInstanceRuntime => {
  runtime.state = restoreInstanceState(snapshot);
  runtime.processedCommandIds = new Set(snapshot.runtime?.processedCommandIds ?? []);
  runtime.commandRateLimitWindow = snapshot.runtime?.commandRateLimitWindow
    ? {
        tick: snapshot.runtime.commandRateLimitWindow.tick,
        commandCountsByPlayerId: {
          ...snapshot.runtime.commandRateLimitWindow.commandCountsByPlayerId
        }
      }
    : {
        tick: runtime.state.root.tick,
        commandCountsByPlayerId: {}
      };
  return runtime;
};
