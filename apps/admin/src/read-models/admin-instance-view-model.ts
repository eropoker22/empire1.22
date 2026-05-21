import type {
  InstanceDiagnosticsSummary,
  InstanceHealthSummary,
  InstanceMonitoringSummary,
  InstanceSummary
} from "@empire/shared-types";

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
  displayName: string;
  region: string;
  tick: number;
  currentTick: number;
  playerCount: number;
  allianceCount: number;
  crashCount: number;
  healthStatus: string;
  warningCount: number;
  lastSnapshotAt: string | null;
  lastTickStartedAt: string | null;
  lastTickCompletedAt: string | null;
  totalCommands: number;
  commandCount: number;
  eventCount: number;
  diagnosticErrorCount: number;
  diagnosticWarningCount: number;
  lastErrorAt: string | null;
  queuedEvents: number;
  queuedEventCount: number;
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
  displayName: summary.instanceId,
  region: "unknown",
  tick: summary.tick,
  currentTick: summary.tick,
  playerCount: summary.playerCount,
  allianceCount: summary.allianceCount,
  crashCount: 0,
  healthStatus: health.status,
  warningCount: health.warnings.length,
  lastSnapshotAt: diagnostics.lastSnapshotAt,
  lastTickStartedAt: null,
  lastTickCompletedAt: null,
  totalCommands: activity.commandCount,
  commandCount: activity.commandCount,
  eventCount: activity.eventCount,
  diagnosticErrorCount: diagnostics.diagnosticErrorCount,
  diagnosticWarningCount: activity.diagnosticWarningCount,
  lastErrorAt: health.lastErrorAt ?? diagnostics.lastCrashAt,
  queuedEvents: 0,
  queuedEventCount: 0
});

export const createAdminInstanceViewModelFromMonitoringSummary = (
  summary: InstanceMonitoringSummary
): AdminInstanceViewModel => ({
  instanceId: summary.instanceId,
  mode: summary.mode,
  status: summary.status,
  displayName: summary.displayName,
  region: summary.region,
  tick: summary.currentTick,
  currentTick: summary.currentTick,
  playerCount: summary.playerCount,
  allianceCount: summary.allianceCount,
  crashCount: summary.crashCount,
  healthStatus: summary.healthStatus,
  warningCount: summary.warningCount,
  lastSnapshotAt: summary.lastSnapshotAt,
  lastTickStartedAt: summary.lastTickStartedAt,
  lastTickCompletedAt: summary.lastTickCompletedAt,
  totalCommands: summary.commandCount,
  commandCount: summary.commandCount,
  eventCount: summary.eventCount,
  diagnosticErrorCount: summary.diagnosticErrorCount,
  diagnosticWarningCount: 0,
  lastErrorAt: summary.lastErrorAt,
  queuedEvents: summary.queuedEventCount,
  queuedEventCount: summary.queuedEventCount
});
