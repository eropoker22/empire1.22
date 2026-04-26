import type { ServerInstanceId } from "@empire/shared-types";
import type { GameStateRepository } from "./game-state-repository";
import type { ServerInstanceRuntime } from "../instance";

/**
 * Responsibility: Boundary for saving and restoring authoritative state snapshots.
 * Belongs here: minimal repository-facing snapshot operations per instance.
 * Does not belong here: storage engine implementation or command handling.
 */
export interface InstanceSnapshotController {
  save(runtime: ServerInstanceRuntime): Promise<void>;
  restore(instanceId: ServerInstanceId, runtime: ServerInstanceRuntime): Promise<ServerInstanceRuntime>;
}

export const createSnapshotController = (
  repository: GameStateRepository
): InstanceSnapshotController => ({
  save: async (runtime) => repository.saveLatest(runtime),
  restore: async (instanceId, runtime) => repository.loadLatest(instanceId, runtime)
});
