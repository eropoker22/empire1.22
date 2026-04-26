import type { InstanceDiagnosticsSummary, QueueSummary } from "@empire/shared-types";

/**
 * Responsibility: Admin read service for diagnostics and queue health summaries.
 * Belongs here: read-only diagnostics retrieval for admin monitoring.
 * Does not belong here: runtime mutation or gameplay logic.
 */
export interface AdminDiagnosticsReadService {
  getDiagnosticsSummary(instanceId: string): Promise<InstanceDiagnosticsSummary>;
  getQueueSummary(instanceId: string): Promise<QueueSummary>;
}

export const createAdminDiagnosticsReadService = (): AdminDiagnosticsReadService => ({
  getDiagnosticsSummary: async (instanceId) => ({
    instanceId,
    lastSnapshotAt: null,
    snapshotSchemaVersion: null,
    lastCrashAt: null,
    diagnosticErrorCount: 0
  }),
  getQueueSummary: async (instanceId) => ({
    instanceId,
    queuedEvents: 0,
    queuedCommands: 0
  })
});

