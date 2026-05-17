import type {
  CommandVolumeSummary,
  InstanceDiagnosticsSummary,
  InstanceHealthSummary,
  InstanceSummary,
  QueueSummary,
  SnapshotSummary
} from "@empire/shared-types";
import type { ServerInstanceManager } from "../runtime";
import { systemClock } from "../runtime";

/**
 * Responsibility: Server-side boundary exposing admin-safe read projections.
 * Belongs here: assembly of admin read-models from runtime monitoring and persistence summaries.
 * Does not belong here: gameplay logic or raw UI rendering.
 */
export const createServerAdminReadService = (instanceManager: ServerInstanceManager) => ({
  listInstanceSummaries: (): InstanceSummary[] =>
    instanceManager.listInstances().map((runtime) => ({
      instanceId: runtime.record.id,
      mode: runtime.record.mode,
      status: runtime.record.status,
      tick: runtime.state.root.tick,
      playerCount: runtime.state.root.playerIds.length,
      allianceCount: runtime.state.root.allianceIds.length
    })),
  getInstanceHealthSummary: (instanceId: string): InstanceHealthSummary | null => {
    const health = instanceManager.getInstanceHealth(instanceId);
    return health
      ? {
          instanceId,
          status: health.status,
          warnings: health.warnings,
          lastErrorAt: health.lastErrorAt
        }
      : null;
  },
  getInstanceDiagnosticsSummary: async (instanceId: string): Promise<InstanceDiagnosticsSummary> => {
    const snapshot = instanceManager.getInstanceMonitorSnapshot(instanceId);
    const diagnostics = await instanceManager.listDiagnosticRecords(instanceId);
    const lastCrash = diagnostics
      .filter((record) => record.category === "crash")
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

    return {
      instanceId,
      lastSnapshotAt: null,
      snapshotSchemaVersion: null,
      lastCrashAt: lastCrash?.occurredAt ?? snapshot?.lastErrorAt ?? null,
      diagnosticErrorCount: diagnostics.filter((record) => record.level === "error").length
    };
  },
  getSnapshotSummary: async (instanceId: string): Promise<SnapshotSummary | null> => ({
    snapshotId: `snapshot:${instanceId}:latest`,
    instanceId,
    createdAt: systemClock.nowIso(),
    tick: 0,
    schemaVersion: 1
  }),
  getCommandVolumeSummary: async (instanceId: string): Promise<CommandVolumeSummary> => ({
    instanceId,
    totalCommands: (await instanceManager.listCommandRecords(instanceId)).length
  }),
  getQueueSummary: (instanceId: string): QueueSummary | null => {
    const snapshot = instanceManager.getInstanceMonitorSnapshot(instanceId);
    return snapshot
      ? {
          instanceId,
          queuedEvents: snapshot.queuedEventCount,
          queuedCommands: 0
        }
      : null;
  }
});
