export interface SnapshotRetentionPolicy {
  rollingCheckpointCountActive: number;
  rollingCheckpointCountTerminal: number;
  retainLifecycleCheckpoints: boolean;
  terminalRetentionDays: number;
  cleanupBatchSize: number;
}

export interface RetentionPolicy {
  snapshots: SnapshotRetentionPolicy;
  maxCommandRecordsPerInstance: number;
  maxEventRecordsPerInstance: number;
  maxDiagnosticRecordsPerInstance: number;
}

export const defaultRetentionPolicy: RetentionPolicy = {
  snapshots: {
    rollingCheckpointCountActive: 24,
    rollingCheckpointCountTerminal: 5,
    retainLifecycleCheckpoints: true,
    terminalRetentionDays: 30,
    cleanupBatchSize: 250
  },
  maxCommandRecordsPerInstance: 5000,
  maxEventRecordsPerInstance: 10000,
  maxDiagnosticRecordsPerInstance: 5000
};

export const resolveSnapshotRetentionPolicy = (
  overrides: Partial<SnapshotRetentionPolicy> = {}
): SnapshotRetentionPolicy => ({
  rollingCheckpointCountActive: positiveInteger(
    overrides.rollingCheckpointCountActive,
    defaultRetentionPolicy.snapshots.rollingCheckpointCountActive
  ),
  rollingCheckpointCountTerminal: positiveInteger(
    overrides.rollingCheckpointCountTerminal,
    defaultRetentionPolicy.snapshots.rollingCheckpointCountTerminal
  ),
  retainLifecycleCheckpoints: overrides.retainLifecycleCheckpoints ??
    defaultRetentionPolicy.snapshots.retainLifecycleCheckpoints,
  terminalRetentionDays: positiveInteger(
    overrides.terminalRetentionDays,
    defaultRetentionPolicy.snapshots.terminalRetentionDays
  ),
  cleanupBatchSize: positiveInteger(
    overrides.cleanupBatchSize,
    defaultRetentionPolicy.snapshots.cleanupBatchSize
  )
});

const positiveInteger = (value: number | undefined, fallback: number): number =>
  Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
