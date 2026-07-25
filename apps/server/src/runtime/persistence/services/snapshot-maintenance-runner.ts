import type {
  SnapshotCleanupResult,
  SnapshotRepository
} from "../repositories";
import type { SnapshotRetentionPolicy } from "./retention-policy";

export const SNAPSHOT_MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000;
export const SNAPSHOT_MAINTENANCE_BACKLOG_RETRY_MS = 30 * 1000;

export interface SnapshotMaintenanceHealth {
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastStatus: "never" | "success" | "failed" | "skipped-lock";
  lastDeletedRows: number;
  lastDurationMs: number;
  nextDueAt: string | null;
}

export interface SnapshotMaintenanceRunner {
  runIfDue(nowIso: string): Promise<SnapshotCleanupResult | null>;
  runNow(nowIso: string): Promise<SnapshotCleanupResult>;
  getHealth(): Readonly<SnapshotMaintenanceHealth>;
}

export const createSnapshotMaintenanceRunner = (
  repository: SnapshotRepository,
  policy: SnapshotRetentionPolicy,
  options: {
    intervalMs?: number;
    log?: (message: string) => void;
  } = {}
): SnapshotMaintenanceRunner => {
  const intervalMs = normalizeInterval(options.intervalMs);
  const log = options.log ?? ((message: string) => console.info(message));
  let activeRun: Promise<SnapshotCleanupResult> | null = null;
  let nextDueAtMs = 0;
  const health: SnapshotMaintenanceHealth = {
    lastStartedAt: null,
    lastCompletedAt: null,
    lastStatus: "never",
    lastDeletedRows: 0,
    lastDurationMs: 0,
    nextDueAt: null
  };

  const runNow = (nowIso: string): Promise<SnapshotCleanupResult> => {
    if (activeRun) return activeRun;
    health.lastStartedAt = nowIso;
    const operation = repository.cleanupCheckpoints(policy, nowIso)
      .then((result) => {
        health.lastCompletedAt = result.completedAt;
        health.lastStatus = result.acquired ? "success" : "skipped-lock";
        health.lastDeletedRows = result.deletedRows;
        health.lastDurationMs = result.durationMs;
        nextDueAtMs = Date.parse(nowIso) + (
          result.deletedRows >= policy.cleanupBatchSize
            ? SNAPSHOT_MAINTENANCE_BACKLOG_RETRY_MS
            : intervalMs
        );
        health.nextDueAt = new Date(nextDueAtMs).toISOString();
        log(`[snapshot-maintenance] status=${health.lastStatus} deletedRows=${result.deletedRows} durationMs=${Math.round(result.durationMs)}`);
        return result;
      })
      .catch((error) => {
        health.lastCompletedAt = nowIso;
        health.lastStatus = "failed";
        health.lastDeletedRows = 0;
        health.lastDurationMs = Math.max(0, Date.now() - Date.parse(health.lastStartedAt ?? nowIso));
        nextDueAtMs = Date.parse(nowIso) + intervalMs;
        health.nextDueAt = new Date(nextDueAtMs).toISOString();
        log("[snapshot-maintenance] status=failed");
        throw error;
      });
    let tracked!: Promise<SnapshotCleanupResult>;
    tracked = operation.finally(() => {
      if (activeRun === tracked) activeRun = null;
    });
    activeRun = tracked;
    return tracked;
  };

  return {
    runIfDue: async (nowIso) => {
      const nowMs = Date.parse(nowIso);
      if (!Number.isFinite(nowMs)) throw new Error("Snapshot maintenance requires a valid timestamp.");
      if (nowMs < nextDueAtMs) return null;
      return runNow(nowIso);
    },
    runNow,
    getHealth: () => ({ ...health })
  };
};

const normalizeInterval = (value: number | undefined): number =>
  Number.isFinite(value) && Number(value) > 0
    ? Math.floor(Number(value))
    : SNAPSHOT_MAINTENANCE_INTERVAL_MS;
