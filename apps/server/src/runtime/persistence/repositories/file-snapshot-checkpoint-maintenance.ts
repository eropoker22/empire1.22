import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  SNAPSHOT_CHECKPOINT_KINDS,
  type SnapshotCheckpointRecord
} from "../dto";
import type { SnapshotRetentionPolicy } from "../services/retention-policy";
import { isTerminalSnapshot } from "../services/snapshot-retention-classification";
import type { SnapshotPersistenceMetrics } from "./snapshot-repository";
import { readJsonFile } from "./file-persistence-utils";

export const cleanupFileCheckpoints = async (
  rootDir: string,
  policy: SnapshotRetentionPolicy,
  nowIso: string,
  metrics: SnapshotPersistenceMetrics
) => {
  const startedAt = performance.now();
  let deletedRows = 0;
  try {
    const instancesDirectory = join(rootDir, "instances");
    const instanceDirectories = await readDirectory(instancesDirectory);
    for (const encodedInstanceId of instanceDirectories) {
      const directory = join(instancesDirectory, encodedInstanceId, "snapshots", "checkpoints");
      const filenames = await readDirectory(directory);
      const records = (await Promise.all(filenames.filter((filename) => filename.endsWith(".json"))
        .map(async (filename) => ({
          filename,
          checkpoint: await readJsonFile<SnapshotCheckpointRecord>(join(directory, filename))
        })))).filter((entry): entry is { filename: string; checkpoint: SnapshotCheckpointRecord } =>
        Boolean(entry.checkpoint));
      const terminal = records.some(({ checkpoint }) => isTerminalSnapshot(checkpoint.snapshot));
      const rollingLimit = terminal
        ? policy.rollingCheckpointCountTerminal
        : policy.rollingCheckpointCountActive;
      const rolling = records.filter(({ checkpoint }) => isRollingCheckpoint(checkpoint))
        .sort((left, right) => compareNewestCheckpoint(left.checkpoint, right.checkpoint));
      const expiredBefore = Date.parse(nowIso) - policy.terminalRetentionDays * 24 * 60 * 60 * 1000;
      const candidates = records.filter(({ checkpoint }) => {
        if (checkpoint.protected || checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.terminal) return false;
        if (checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.lifecycle) {
          return !policy.retainLifecycleCheckpoints && terminal && Date.parse(checkpoint.createdAt) < expiredBefore;
        }
        const rank = rolling.findIndex((entry) => entry.checkpoint.checkpointId === checkpoint.checkpointId);
        return rank >= rollingLimit || (terminal && Date.parse(checkpoint.createdAt) < expiredBefore);
      }).sort((left, right) => left.checkpoint.createdAt.localeCompare(right.checkpoint.createdAt));
      for (const candidate of candidates) {
        await rm(join(directory, candidate.filename), { force: true });
        deletedRows += 1;
        if (deletedRows >= policy.cleanupBatchSize) break;
      }
      if (deletedRows >= policy.cleanupBatchSize) break;
    }
    const durationMs = Math.max(0, performance.now() - startedAt);
    metrics.cleanupRuns += 1;
    metrics.cleanupDeletedRows += deletedRows;
    metrics.lastCleanupDurationMs = durationMs;
    metrics.lastCleanupAt = nowIso;
    return { acquired: true, deletedRows, durationMs, completedAt: nowIso };
  } catch (error) {
    metrics.cleanupFailures += 1;
    throw error;
  }
};

export const isRollingCheckpoint = (checkpoint: SnapshotCheckpointRecord): boolean =>
  checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.periodic ||
  checkpoint.kind === SNAPSHOT_CHECKPOINT_KINDS.legacy;

export const compareNewestCheckpoint = (
  left: SnapshotCheckpointRecord,
  right: SnapshotCheckpointRecord
): number => right.rootVersion - left.rootVersion ||
  right.tick - left.tick ||
  right.createdAt.localeCompare(left.createdAt) ||
  right.checkpointId.localeCompare(left.checkpointId);

const readDirectory = (directory: string): Promise<string[]> =>
  readdir(directory).catch((error: unknown) => {
    if ((error as { code?: string }).code === "ENOENT") return [];
    throw error;
  });
