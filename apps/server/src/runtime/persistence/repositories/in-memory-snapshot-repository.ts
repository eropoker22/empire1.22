import type { ServerInstanceId } from "@empire/shared-types";
import type { InstanceSnapshotDto } from "../dto";
import type { SnapshotRepository } from "./snapshot-repository";

/**
 * Responsibility: Development/test snapshot repository kept in process memory.
 * Belongs here: latest snapshot save/load by instance id.
 * Does not belong here: filesystem or database IO.
 */
export const createInMemorySnapshotRepository = (): SnapshotRepository => {
  const snapshotsByInstanceId = new Map<ServerInstanceId, InstanceSnapshotDto>();

  return {
    save: async (snapshot) => {
      snapshotsByInstanceId.set(snapshot.instanceId, snapshot);
    },
    loadLatest: async (instanceId) => snapshotsByInstanceId.get(instanceId) ?? null
  };
};
