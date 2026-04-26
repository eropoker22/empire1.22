/**
 * Responsibility: Admin-readable diagnostics summary for one instance.
 * Belongs here: crash info, snapshot freshness, and operational counters.
 * Does not belong here: detailed raw diagnostic logs or mutable runtime state.
 */
export interface InstanceDiagnosticsSummary {
  instanceId: string;
  lastSnapshotAt: string | null;
  snapshotSchemaVersion: number | null;
  lastCrashAt: string | null;
  diagnosticErrorCount: number;
}

