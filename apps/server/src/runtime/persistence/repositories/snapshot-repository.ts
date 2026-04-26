import type { ServerInstanceId } from "@empire/shared-types";
import type { InstanceSnapshotDto } from "../dto";

/**
 * Responsibility: Storage boundary for versioned instance snapshots.
 * Belongs here: load/save contract for full instance snapshots.
 * Does not belong here: snapshot creation logic or runtime scheduling.
 */
export interface SnapshotRepository {
  save(snapshot: InstanceSnapshotDto): Promise<void>;
  loadLatest(instanceId: ServerInstanceId): Promise<InstanceSnapshotDto | null>;
}

export const createNullSnapshotRepository = (): SnapshotRepository => ({
  save: async (_snapshot) => {
    return;
  },
  loadLatest: async (_instanceId) => null
});

