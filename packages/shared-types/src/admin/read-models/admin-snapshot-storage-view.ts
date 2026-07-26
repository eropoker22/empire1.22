export type AdminSnapshotCleanupStatus =
  "never" | "success" | "failed" | "skipped-lock" | "unavailable";

export type AdminSnapshotStorageHealth =
  "healthy" | "attention" | "unavailable";

export interface AdminSnapshotStorageView {
  lastCheckpointAt?: string | null;
  rollingCheckpointCount?: number;
  lifecycleCheckpointCount?: number;
  terminalCheckpointCount?: number;
  lastCleanupAt?: string | null;
  lastCleanupStatus?: AdminSnapshotCleanupStatus;
  storageHealth?: AdminSnapshotStorageHealth;
}
