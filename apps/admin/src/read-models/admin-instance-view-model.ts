import type { InstanceDiagnosticsSummary, InstanceHealthSummary, InstanceSummary } from "@empire/shared-types";

export interface AdminInstanceActivitySummary {
  commandCount: number;
  eventCount: number;
  diagnosticWarningCount: number;
}

/**
 * Responsibility: UI-ready admin view model for instance overview cards and tables.
 * Belongs here: presentational aggregation over admin read-model contracts.
 * Does not belong here: source-of-truth state or gameplay logic.
 */
export interface AdminInstanceViewModel {
  instanceId: string;
  mode: string;
  status: string;
  tick: number;
  playerCount: number;
  allianceCount: number;
  healthStatus: string;
  lastSnapshotAt: string | null;
  commandCount: number;
  eventCount: number;
  diagnosticErrorCount: number;
  diagnosticWarningCount: number;
  lastErrorAt: string | null;
}

export const createAdminInstanceViewModel = (
  summary: InstanceSummary,
  health: InstanceHealthSummary,
  diagnostics: InstanceDiagnosticsSummary,
  activity: AdminInstanceActivitySummary = {
    commandCount: 0,
    eventCount: 0,
    diagnosticWarningCount: 0
  }
): AdminInstanceViewModel => ({
  instanceId: summary.instanceId,
  mode: summary.mode,
  status: summary.status,
  tick: summary.tick,
  playerCount: summary.playerCount,
  allianceCount: summary.allianceCount,
  healthStatus: health.status,
  lastSnapshotAt: diagnostics.lastSnapshotAt,
  commandCount: activity.commandCount,
  eventCount: activity.eventCount,
  diagnosticErrorCount: diagnostics.diagnosticErrorCount,
  diagnosticWarningCount: activity.diagnosticWarningCount,
  lastErrorAt: health.lastErrorAt ?? diagnostics.lastCrashAt
});
