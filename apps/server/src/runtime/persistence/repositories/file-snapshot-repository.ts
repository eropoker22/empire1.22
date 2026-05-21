import type { ServerInstanceId } from "@empire/shared-types";
import type { InstanceSnapshotDto } from "../dto";
import type { SnapshotRepository } from "./snapshot-repository";
import {
  createInstancePersistenceDir,
  encodePathSegment,
  readJsonFile,
  type FilePersistenceOptions,
  writeJsonFileAtomic
} from "./file-persistence-utils";
import { join } from "node:path";

/**
 * Responsibility: Local durable snapshot storage using versioned, readable JSON.
 * Belongs here: latest snapshot load/save and an optimistic rootVersion guard.
 * Does not belong here: snapshot creation or runtime restore orchestration.
 */
export const createFileSnapshotRepository = (
  options: FilePersistenceOptions
): SnapshotRepository => ({
  save: async (snapshot) => {
    const latest = await loadLatestSnapshot(options.rootDir, snapshot.instanceId);
    if (latest && latest.integrity.rootVersion > snapshot.integrity.rootVersion) {
      throw new Error(
        `Refusing to overwrite snapshot ${latest.snapshotId} rootVersion ${latest.integrity.rootVersion} with stale rootVersion ${snapshot.integrity.rootVersion}.`
      );
    }

    await writeJsonFileAtomic(createSnapshotPath(options.rootDir, snapshot), snapshot);
    await writeJsonFileAtomic(createLatestSnapshotPath(options.rootDir, snapshot.instanceId), snapshot);
  },
  loadLatest: async (instanceId: ServerInstanceId) =>
    loadLatestSnapshot(options.rootDir, instanceId)
});

const loadLatestSnapshot = (
  rootDir: string,
  instanceId: ServerInstanceId
): Promise<InstanceSnapshotDto | null> =>
  readJsonFile<InstanceSnapshotDto>(createLatestSnapshotPath(rootDir, instanceId));

const createSnapshotPath = (
  rootDir: string,
  snapshot: InstanceSnapshotDto
): string => join(
  createSnapshotDir(rootDir, snapshot.instanceId),
  `${encodePathSegment(snapshot.snapshotId)}.json`
);

const createLatestSnapshotPath = (
  rootDir: string,
  instanceId: ServerInstanceId
): string => join(createSnapshotDir(rootDir, instanceId), "latest.json");

const createSnapshotDir = (rootDir: string, instanceId: ServerInstanceId): string =>
  join(createInstancePersistenceDir(rootDir, instanceId), "snapshots");
