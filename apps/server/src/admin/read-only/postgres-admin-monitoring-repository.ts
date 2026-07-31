import type { AdminInstanceSummaryView } from "@empire/shared-types";
import type { PostgresQueryable } from "../../runtime/persistence/postgres";
import type { AdminInstanceMonitoringRepository } from "./admin-repositories";
import {
  createAdminInstanceRuntimeHealth,
  resolveAdminTickObservationWindowMs
} from "./admin-instance-runtime-health";
import { createAdminInstanceTickObservationCache } from "./admin-instance-tick-observation";
import { createAdminDetailFromSnapshot } from "./admin-snapshot-projection";
import {
  loadAdminSnapshotStorageMetadata,
  resolveAdminSnapshotStorageHealth
} from "./admin-snapshot-storage-metadata";
import {
  adminMonitoringInstanceQuery,
  loadAdminRuntimeObservation,
  loadAdminSnapshot,
  mapAdminMonitoringInstanceRow,
  type AdminMonitoringInstanceRow
} from "./postgres-admin-monitoring-data";
import {
  listCommandSummaries,
  listDiagnosticSummaries,
  listEventSummaries
} from "./postgres-admin-monitoring-log-data";

export const createPostgresAdminMonitoringRepository = (
  database: PostgresQueryable,
  now: () => Date = () => new Date()
): AdminInstanceMonitoringRepository => {
  const tickObservations = createAdminInstanceTickObservationCache();
  const listKnownInstances = async (): Promise<AdminInstanceSummaryView[]> => {
    const result = await database.query<AdminMonitoringInstanceRow>(adminMonitoringInstanceQuery(""));
    const generatedAt = now().toISOString();
    return result.rows.map((row) => mapAdminMonitoringInstanceRow(row, generatedAt));
  };
  const getInstanceSummary = async (id: string): Promise<AdminInstanceSummaryView | null> => {
    const result = await database.query<AdminMonitoringInstanceRow>(
      adminMonitoringInstanceQuery("WHERE si.server_instance_id = $1"),
      [id]
    );
    return result.rows[0] ? mapAdminMonitoringInstanceRow(result.rows[0], now().toISOString()) : null;
  };
  const listCommands = (id: string, limit: number) => listCommandSummaries(database, id, limit);
  const listEvents = (id: string, limit: number) => listEventSummaries(database, id, limit);
  const listDiagnostics = (id: string, limit: number) => listDiagnosticSummaries(database, id, limit);

  return {
    durable: true,
    listKnownInstances,
    getInstanceSummary,
    getInstanceRuntimeProjection: async (id) => {
      const [summary, snapshot, snapshotStorage, observation, commands, events, diagnostics] = await Promise.all([
        getInstanceSummary(id),
        loadAdminSnapshot(database, id),
        loadAdminSnapshotStorageMetadata(database, id),
        loadAdminRuntimeObservation(database, id),
        listCommands(id, 50),
        listEvents(id, 50),
        listDiagnostics(id, 50)
      ]);
      if (!summary) {
        tickObservations.clear(id);
        return null;
      }
      const generatedAt = now().toISOString();
      const tickProgress = tickObservations.observe({
        serverInstanceId: id,
        lifecycleStatus: summary.status,
        observedAt: generatedAt,
        currentTick: nullableNumber(snapshot?.tick),
        rootTick: nullableNumber(snapshot?.state.root.tick),
        stateVersion: nullableNumber(snapshot?.integrity.rootVersion),
        lastStartedAt: observation.lastStartedAt,
        observationWindowMs: resolveAdminTickObservationWindowMs(
          summary.mode,
          observation.canonicalTickRateMs
        )
      });
      const runtimeHealth = createAdminInstanceRuntimeHealth({
        summary,
        generatedAt,
        observation: {
          ...observation,
          instanceLastTick: observation.instanceLastTick ?? summary.currentTick,
          instanceLastSnapshotAt: observation.instanceLastSnapshotAt ?? summary.lastSnapshotAt
        },
        snapshotStorage,
        tickProgress
      });
      return createAdminDetailFromSnapshot({
        summary,
        snapshot,
        snapshotStorage,
        runtimeHealth,
        commands,
        events,
        diagnostics,
        generatedAt
      });
    },
    getInstanceHealth: async (id) => (await getInstanceSummary(id))?.freshness ?? null,
    listInstanceCommandSummaries: listCommands,
    listInstanceEventSummaries: listEvents,
    listInstanceDiagnosticSummaries: listDiagnostics,
    getWorkerHeartbeat: async (id) => {
      const result = await database.query<{
        lock_owner: string | null;
        locked_until: Date | string | null;
        updated_at: Date | string;
      }>(`SELECT runtime_lease_owner_id AS lock_owner, runtime_lease_expires_at AS locked_until,
        last_worker_heartbeat_at AS updated_at FROM empire_hosted_server_instances
        WHERE server_instance_id = $1 AND last_worker_heartbeat_at IS NOT NULL`, [id]);
      const row = result.rows[0];
      return row ? {
        serverInstanceId: id,
        ownerId: row.lock_owner,
        lastHeartbeatAt: iso(row.updated_at),
        leaseExpiresAt: row.locked_until ? iso(row.locked_until) : null
      } : null;
    },
    getSnapshotMetadata: async (id) => {
      const [summary, snapshot, snapshotStorage] = await Promise.all([
        getInstanceSummary(id),
        loadAdminSnapshot(database, id),
        loadAdminSnapshotStorageMetadata(database, id)
      ]);
      if (!snapshot) return null;
      const generatedAt = now();
      const stale = summary?.snapshotStale ?? false;
      return {
        serverInstanceId: id,
        snapshotId: snapshot.snapshotId,
        createdAt: snapshot.createdAt,
        tick: snapshot.tick,
        stateVersion: snapshot.integrity.rootVersion,
        schemaVersion: snapshot.version.schemaVersion,
        stale,
        ...snapshotStorage,
        storageHealth: resolveAdminSnapshotStorageHealth({
          hasRecoveryHead: true,
          recoveryHeadStale: stale,
          metadata: snapshotStorage,
          now: generatedAt
        })
      };
    }
  };
};
const iso = (value: Date | string): string => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const nullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
