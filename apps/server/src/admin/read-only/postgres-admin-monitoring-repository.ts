import type {
  AdminCommandSummaryView,
  AdminDiagnosticSummaryView,
  AdminEventSummaryView,
  AdminInstanceSummaryView,
  AdminWorkerStatus
} from "@empire/shared-types";
import type { InstanceSnapshotDto } from "../../runtime/persistence/dto";
import type { PostgresQueryable } from "../../runtime/persistence/postgres";
import type { AdminInstanceMonitoringRepository } from "./admin-repositories";
import { createAdminDetailFromSnapshot } from "./admin-snapshot-projection";

const HEARTBEAT_LIVE_MS = 30_000;
const HEARTBEAT_STALE_MS = 120_000;
const SNAPSHOT_STALE_MS = 120_000;

interface InstanceRow extends Record<string, unknown> {
  server_instance_id: string;
  mode: string;
  status: string;
  payload: unknown;
  snapshot_payload: unknown | null;
  snapshot_created_at: Date | string | null;
  heartbeat_at: Date | string | null;
  lock_owner: string | null;
  locked_until: Date | string | null;
  last_error_at: Date | string | null;
  hosted_display_name: string | null;
  hosted_region: string | null;
  hosted_capacity: number | null;
  hosted_join_policy: string | null;
  hosted_status: string | null;
}

export const createPostgresAdminMonitoringRepository = (
  database: PostgresQueryable,
  now: () => Date = () => new Date()
): AdminInstanceMonitoringRepository => {
  const listKnownInstances = async (): Promise<AdminInstanceSummaryView[]> => {
    const result = await database.query<InstanceRow>(instanceQuery(""));
    const generatedAt = now().toISOString();
    return result.rows.map((row) => mapInstanceRow(row, generatedAt));
  };
  const getInstanceSummary = async (id: string): Promise<AdminInstanceSummaryView | null> => {
    const result = await database.query<InstanceRow>(instanceQuery("WHERE si.server_instance_id = $1"), [id]);
    return result.rows[0] ? mapInstanceRow(result.rows[0], now().toISOString()) : null;
  };
  const listCommands = (id: string, limit: number) => listCommandSummaries(database, id, limit);
  const listEvents = (id: string, limit: number) => listEventSummaries(database, id, limit);
  const listDiagnostics = (id: string, limit: number) => listDiagnosticSummaries(database, id, limit);

  return {
    durable: true,
    listKnownInstances,
    getInstanceSummary,
    getInstanceRuntimeProjection: async (id) => {
      const [summary, snapshot, commands, events, diagnostics] = await Promise.all([
        getInstanceSummary(id),
        loadSnapshot(database, id),
        listCommands(id, 50),
        listEvents(id, 50),
        listDiagnostics(id, 50)
      ]);
      if (!summary) return null;
      return createAdminDetailFromSnapshot({ summary, snapshot, commands, events, diagnostics, generatedAt: now().toISOString() });
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
      const snapshot = await loadSnapshot(database, id);
      if (!snapshot) return null;
      return {
        serverInstanceId: id,
        snapshotId: snapshot.snapshotId,
        createdAt: snapshot.createdAt,
        tick: snapshot.tick,
        stateVersion: snapshot.integrity.rootVersion,
        schemaVersion: snapshot.version.schemaVersion,
        stale: age(now(), snapshot.createdAt) > SNAPSHOT_STALE_MS
      };
    }
  };
};

const instanceQuery = (where: string): string => `
  SELECT si.server_instance_id, si.mode, si.status, si.payload,
    hsi.display_name AS hosted_display_name, hsi.region AS hosted_region,
    hsi.capacity AS hosted_capacity, hsi.join_policy AS hosted_join_policy, hsi.status AS hosted_status,
    sl.payload AS snapshot_payload, sl.created_at AS snapshot_created_at,
    COALESCE(ih.last_heartbeat_at, hsi.last_worker_heartbeat_at) AS heartbeat_at,
    hsi.runtime_lease_owner_id AS lock_owner, hsi.runtime_lease_expires_at AS locked_until,
    (SELECT max(dl.created_at) FROM empire_diagnostic_log dl
      WHERE dl.server_instance_id = si.server_instance_id AND dl.level = 'error') AS last_error_at
  FROM empire_server_instances si
  LEFT JOIN empire_snapshot_latest sl ON sl.server_instance_id = si.server_instance_id
  LEFT JOIN empire_hosted_server_instances hsi ON hsi.server_instance_id = si.server_instance_id
  LEFT JOIN empire_hosted_instance_heartbeats ih ON ih.server_instance_id = si.server_instance_id
  ${where}
  ORDER BY si.created_at ASC, si.server_instance_id ASC`;

const mapInstanceRow = (row: InstanceRow, generatedAt: string): AdminInstanceSummaryView => {
  const payload = record(row.payload);
  const snapshot = row.snapshot_payload ? coerce<InstanceSnapshotDto>(row.snapshot_payload) : null;
  const lobby = snapshot?.lobby;
  const heartbeatAt = row.heartbeat_at ? iso(row.heartbeat_at) : null;
  const snapshotAt = snapshot?.createdAt ?? (row.snapshot_created_at ? iso(row.snapshot_created_at) : null);
  const workerStatus = workerState(generatedAt, heartbeatAt);
  const snapshotStale = !snapshotAt || age(new Date(generatedAt), snapshotAt) > SNAPSHOT_STALE_MS;
  const source = snapshot ? "durable-snapshot" as const : "durable-control-plane" as const;
  return {
    serverInstanceId: row.server_instance_id,
    displayName: row.hosted_display_name || text(payload.displayName) || lobby?.displayName || row.server_instance_id,
    mode: row.mode,
    region: row.hosted_region || text(payload.region) || lobby?.region || "unknown",
    capacity: row.hosted_capacity ?? integer(payload.capacity ?? lobby?.capacity),
    joinPolicy: row.hosted_join_policy || text(payload.joinPolicy) || lobby?.joinPolicy || "unknown",
    status: row.hosted_status || row.status,
    currentTick: snapshot?.tick ?? null,
    stateVersion: snapshot?.integrity.rootVersion ?? null,
    playerCount: snapshot?.state.root.playerIds.length ?? 0,
    workerStatus,
    lastHeartbeatAt: heartbeatAt,
    leaseOwner: row.lock_owner,
    leaseExpiresAt: row.locked_until ? iso(row.locked_until) : null,
    lastSnapshotAt: snapshotAt,
    snapshotStale,
    lastErrorAt: row.last_error_at ? iso(row.last_error_at) : snapshot?.metadata.lastCrashAt ?? null,
    freshness: {
      serverInstanceId: row.server_instance_id,
      generatedAt,
      source,
      dataAsOf: snapshotAt ?? heartbeatAt,
      lastSnapshotAt: snapshotAt,
      lastHeartbeatAt: heartbeatAt,
      stale: snapshotStale || workerStatus !== "live",
      staleReason: snapshotStale ? "snapshot-stale" : workerStatus !== "live" ? `worker-${workerStatus}` : null
    }
  };
};

const listCommandSummaries = async (db: PostgresQueryable, id: string, limit: number): Promise<AdminCommandSummaryView[]> => {
  const result = await db.query<{ command_id: string; command_type: string; actor_id: string; created_at: Date | string; tick_at_receive: number }>(
    `SELECT command_id, payload #>> '{command,type}' AS command_type, actor_id, created_at, tick_at_receive
     FROM empire_command_log WHERE server_instance_id = $1 ORDER BY sequence DESC LIMIT $2`, [id, cap(limit)]);
  return result.rows.reverse().map((row) => ({ serverInstanceId: id, commandId: row.command_id, commandType: row.command_type || "unknown", actorId: row.actor_id, status: "recorded", receivedAt: iso(row.created_at), tickAtReceive: Number(row.tick_at_receive) }));
};

const listEventSummaries = async (db: PostgresQueryable, id: string, limit: number): Promise<AdminEventSummaryView[]> => {
  const result = await db.query<{ id: string; event_type: string; caused_by_command_id: string | null; created_at: Date | string; tick_at_emit: number }>(
    `SELECT id, payload #>> '{event,type}' AS event_type, caused_by_command_id, created_at, tick_at_emit
     FROM empire_event_log WHERE server_instance_id = $1 ORDER BY sequence DESC LIMIT $2`, [id, cap(limit)]);
  return result.rows.reverse().map((row) => ({ serverInstanceId: id, eventId: row.id, eventType: row.event_type || "unknown", causedByCommandId: row.caused_by_command_id, occurredAt: iso(row.created_at), tick: Number(row.tick_at_emit) }));
};

const listDiagnosticSummaries = async (db: PostgresQueryable, id: string, limit: number): Promise<AdminDiagnosticSummaryView[]> => {
  const result = await db.query<{ id: string; level: "info" | "warn" | "error"; category: string; created_at: Date | string; command_id: string | null }>(
    `SELECT id, level, category, created_at, payload #>> '{context,commandId}' AS command_id
     FROM empire_diagnostic_log WHERE server_instance_id = $1 ORDER BY sequence DESC LIMIT $2`, [id, cap(limit)]);
  return result.rows.reverse().map((row) => ({ serverInstanceId: id, diagnosticId: row.id, level: row.level, category: row.category, messageCode: `diagnostic.${safeCode(row.category)}`, occurredAt: iso(row.created_at), commandId: row.command_id }));
};

const loadSnapshot = async (db: PostgresQueryable, id: string): Promise<InstanceSnapshotDto | null> => {
  const result = await db.query<{ payload: unknown }>(`SELECT payload FROM empire_snapshot_latest WHERE server_instance_id = $1`, [id]);
  return result.rows[0] ? coerce<InstanceSnapshotDto>(result.rows[0].payload) : null;
};

const workerState = (nowIso: string, heartbeat: string | null): AdminWorkerStatus => {
  if (!heartbeat) return "no-worker";
  const ms = age(new Date(nowIso), heartbeat);
  return ms <= HEARTBEAT_LIVE_MS ? "live" : ms <= HEARTBEAT_STALE_MS ? "stale" : "offline";
};
const age = (now: Date, value: string): number => Math.max(0, now.getTime() - Date.parse(value));
const iso = (value: Date | string): string => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const coerce = <T>(value: unknown): T => typeof value === "string" ? JSON.parse(value) as T : value as T;
const record = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => String(value ?? "").trim();
const integer = (value: unknown): number => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const cap = (value: number): number => Math.max(1, Math.min(200, Math.floor(value)));
const safeCode = (value: string): string => value.toLowerCase().replace(/[^a-z0-9._-]+/gu, "-").slice(0, 80) || "unknown";
