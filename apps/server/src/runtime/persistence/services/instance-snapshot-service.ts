import type { ServerInstanceRuntime } from "../../instance";
import { createInstanceSnapshot } from "../mappers";
import type { SnapshotRepository } from "../repositories";

/**
 * Responsibility: Creates and stores validated snapshots for authoritative instances.
 * Belongs here: save workflow over snapshot mapping and repository boundaries.
 * Does not belong here: timer scheduling or transport concerns.
 */
export interface InstanceSnapshotService {
  save(runtime: ServerInstanceRuntime): Promise<void>;
}

export const createInstanceSnapshotService = (
  snapshotRepository: SnapshotRepository
): InstanceSnapshotService => ({
  save: async (runtime) => {
    const snapshot = createInstanceSnapshot(runtime);
    await snapshotRepository.save(snapshot);
  }
});

