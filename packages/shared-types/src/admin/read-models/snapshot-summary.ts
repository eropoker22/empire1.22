/**
 * Responsibility: Admin-safe summary of stored snapshot information.
 * Belongs here: timestamp, tick, version, and identity metadata for snapshots.
 * Does not belong here: full authoritative state payloads.
 */
export interface SnapshotSummary {
  snapshotId: string;
  instanceId: string;
  createdAt: string;
  tick: number;
  schemaVersion: number;
}

