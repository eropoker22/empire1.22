import type { ServerInstanceId } from "@empire/shared-types";

/**
 * Responsibility: Admin-facing read model summarizing persistence and diagnostics per instance.
 * Belongs here: snapshot recency, log volume, and crash/error counters for dashboard use.
 * Does not belong here: full raw logs or authoritative game state payloads.
 */
export interface AdminInstanceHistorySummary {
  instanceId: ServerInstanceId;
  lastSnapshotAt: string | null;
  snapshotSchemaVersion: number | null;
  commandVolume: number;
  eventVolume: number;
  diagnosticErrorCount: number;
  lastCrashAt: string | null;
}

