/**
 * Responsibility: Persistence retention policy skeleton for snapshots and audit logs.
 * Belongs here: cleanup policy definitions separated from repository implementations.
 * Does not belong here: direct deletion logic against a concrete storage engine.
 */
export interface RetentionPolicy {
  maxSnapshotsPerInstance: number;
  maxCommandRecordsPerInstance: number;
  maxEventRecordsPerInstance: number;
  maxDiagnosticRecordsPerInstance: number;
}

export const defaultRetentionPolicy: RetentionPolicy = {
  maxSnapshotsPerInstance: 10,
  maxCommandRecordsPerInstance: 5000,
  maxEventRecordsPerInstance: 10000,
  maxDiagnosticRecordsPerInstance: 5000
};

