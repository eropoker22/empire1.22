import type { InstanceDiagnosticsSummary, QueueSummary } from "@empire/shared-types";

export interface AdminDiagnosticLogEntry {
  id: string;
  instanceId: string;
  level: "info" | "warn" | "error";
  category: string;
  message: string;
  occurredAt: string;
}

/**
 * Responsibility: Admin read service for diagnostics and queue health summaries.
 * Belongs here: read-only diagnostics retrieval for admin monitoring.
 * Does not belong here: runtime mutation or gameplay logic.
 */
export interface AdminDiagnosticsReadService {
  getDiagnosticsSummary(instanceId: string): Promise<InstanceDiagnosticsSummary>;
  getQueueSummary(instanceId: string): Promise<QueueSummary>;
  listRecentDiagnosticLogs(instanceId: string, limit?: number): Promise<AdminDiagnosticLogEntry[]>;
}

export interface AdminDiagnosticsReadFacade {
  getDiagnosticsSummary(instanceId: string): Promise<InstanceDiagnosticsSummary>;
  getQueueSummary(instanceId: string): QueueSummary;
  listRecentDiagnosticRecords(instanceId: string, limit?: number): Promise<Array<{
    id: string;
    instanceId: string;
    level: "info" | "warn" | "error";
    category: string;
    message: string;
    occurredAt: string;
  }>>;
}

export const createAdminDiagnosticsReadService = (options: {
  facade?: AdminDiagnosticsReadFacade;
} = {}): AdminDiagnosticsReadService => ({
  getDiagnosticsSummary: async (instanceId) => options.facade?.getDiagnosticsSummary(instanceId) ?? ({
    instanceId,
    lastSnapshotAt: null,
    snapshotSchemaVersion: null,
    lastCrashAt: null,
    diagnosticErrorCount: 0
  }),
  getQueueSummary: async (instanceId) => options.facade?.getQueueSummary(instanceId) ?? ({
    instanceId,
    queuedEvents: 0,
    queuedCommands: 0
  }),
  listRecentDiagnosticLogs: async (instanceId, limit) =>
    (await options.facade?.listRecentDiagnosticRecords(instanceId, limit) ?? []).map((record) => ({
      id: record.id,
      instanceId: record.instanceId,
      level: record.level,
      category: record.category,
      message: record.message,
      occurredAt: record.occurredAt
    }))
});
