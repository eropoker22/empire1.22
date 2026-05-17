import type { ErrorSummary, QueueSummary, SnapshotSummary } from "@empire/shared-types";

/**
 * Responsibility: UI-ready admin diagnostics panel model.
 * Belongs here: presentational grouping of diagnostics, queue, and snapshot summaries.
 * Does not belong here: raw diagnostic repositories or server runtime mutation.
 */
export interface AdminDiagnosticsViewModel {
  instanceId: string;
  snapshotVersion: number | null;
  queueBacklog: number;
  errorCount: number;
  warningCount: number;
  lastErrorAt: string | null;
}

export const createAdminDiagnosticsViewModel = (
  snapshot: SnapshotSummary | null,
  queue: QueueSummary,
  errors: ErrorSummary,
  warningCount = 0
): AdminDiagnosticsViewModel => ({
  instanceId: queue.instanceId,
  snapshotVersion: snapshot?.schemaVersion ?? null,
  queueBacklog: queue.queuedEvents + queue.queuedCommands,
  errorCount: errors.errorCount,
  warningCount,
  lastErrorAt: errors.lastErrorAt
});
