import type { ServerInstanceId } from "@empire/shared-types";
import type { SnapshotRepository } from "../persistence/repositories/snapshot-repository";
import { createNullSnapshotRepository } from "../persistence/repositories/snapshot-repository";
import { createPersistenceRestoreService } from "../persistence/services/instance-restore-service";
import { createInstanceSnapshotService } from "../persistence/services/instance-snapshot-service";
import type { ServerInstanceRuntime } from "../instance";

/**
 * Responsibility: Legacy snapshot compatibility facade over the richer persistence layer.
 * Belongs here: minimal adapter used by existing runtime snapshot boundaries.
 * Does not belong here: direct storage implementation or gameplay logic.
 */
export interface GameStateRepository {
  loadLatest(instanceId: ServerInstanceId, runtime: ServerInstanceRuntime): Promise<ServerInstanceRuntime>;
  saveLatest(runtime: ServerInstanceRuntime): Promise<void>;
}

export const createGameStateRepository = (
  snapshotRepository: SnapshotRepository = createNullSnapshotRepository()
): GameStateRepository => {
  const snapshotService = createInstanceSnapshotService(snapshotRepository);
  const restoreService = createPersistenceRestoreService(snapshotRepository);

  return {
    loadLatest: async (_instanceId, runtime) => restoreService.restore(runtime),
    saveLatest: async (runtime) => snapshotService.save(runtime)
  };
};

export const createNullGameStateRepository = (): GameStateRepository =>
  createGameStateRepository(createNullSnapshotRepository());
