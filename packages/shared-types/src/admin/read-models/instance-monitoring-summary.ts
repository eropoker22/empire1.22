/**
 * Responsibility: Admin-safe monitoring row for one server instance.
 * Belongs here: operational runtime counters and log summary fields for read-only dashboards.
 * Does not belong here: authoritative game state, hidden gameplay payloads, or admin mutations.
 */
export interface InstanceMonitoringSummary {
  instanceId: string;
  mode: string;
  status: string;
  displayName: string;
  region: string;
  currentTick: number;
  playerCount: number;
  allianceCount: number;
  crashCount: number;
  healthStatus: string;
  warningCount: number;
  lastTickStartedAt: string | null;
  lastTickCompletedAt: string | null;
  lastErrorAt: string | null;
  queuedEventCount: number;
  commandCount: number;
  eventCount: number;
  diagnosticErrorCount: number;
  lastSnapshotAt: string | null;
}
