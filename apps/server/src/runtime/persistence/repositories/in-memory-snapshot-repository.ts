import type { ServerInstanceId } from "@empire/shared-types";
import type { InstanceSnapshotDto } from "../dto";
import type { SnapshotRepository } from "./snapshot-repository";
import { classifySnapshotWrite } from "./snapshot-write-guard";

/**
 * Responsibility: Development/test snapshot repository kept in process memory.
 * Belongs here: latest snapshot save/load by instance id.
 * Does not belong here: filesystem or database IO.
 */
export const createInMemorySnapshotRepository = (): SnapshotRepository => {
  const snapshotsByInstanceId = new Map<ServerInstanceId, InstanceSnapshotDto>();

  return {
    save: async (snapshot) => {
      const latest = snapshotsByInstanceId.get(snapshot.instanceId) ?? null;
      if (classifySnapshotWrite(latest, snapshot) === "idempotent") return;
      snapshotsByInstanceId.set(snapshot.instanceId, structuredClone(snapshot));
    },
    loadLatest: async (instanceId) => {
      const snapshot = snapshotsByInstanceId.get(instanceId);
      return snapshot ? structuredClone(snapshot) : null;
    }
  };
};
