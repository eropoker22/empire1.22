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
import { classifySnapshotWrite } from "./snapshot-write-guard";

/**
 * Responsibility: Local durable snapshot storage using versioned, readable JSON.
 * Belongs here: latest snapshot load/save and an optimistic rootVersion guard.
 * Does not belong here: snapshot creation or runtime restore orchestration.
 */
export const createFileSnapshotRepository = (
  options: FilePersistenceOptions
): SnapshotRepository => {
  let saveQueue = Promise.resolve();

  return {
    save: (snapshot) => {
      const operation = saveQueue.then(() => saveSnapshot(options.rootDir, snapshot));
      saveQueue = operation.catch(() => undefined);
      return operation;
    },
    loadLatest: async (instanceId: ServerInstanceId) =>
      loadLatestSnapshot(options.rootDir, instanceId)
  };
};

const saveSnapshot = async (rootDir: string, snapshot: InstanceSnapshotDto): Promise<void> => {
  const latest = await loadLatestSnapshot(rootDir, snapshot.instanceId);
  if (classifySnapshotWrite(latest, snapshot) === "idempotent") return;
  await writeJsonFileAtomic(createSnapshotPath(rootDir, snapshot), snapshot);
  await writeJsonFileAtomic(createLatestSnapshotPath(rootDir, snapshot.instanceId), snapshot);
};

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
