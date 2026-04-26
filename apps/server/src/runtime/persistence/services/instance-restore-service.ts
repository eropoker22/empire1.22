import { createInitialState } from "@empire/game-core";
import type { ServerInstanceRuntime } from "../../instance";
import { restoreInstanceState } from "../mappers";
import type { SnapshotRepository } from "../repositories";

/**
 * Responsibility: Restores one instance state from the latest valid snapshot or initializes a fresh one.
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
    runtime.state = snapshot
      ? restoreInstanceState(snapshot)
      : createInitialState(runtime.record.id, runtime.record.mode);
    return runtime;
  }
});

