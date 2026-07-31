import type {
  AdminInstanceSummaryView,
  AdminWorkerStatus
} from "@empire/shared-types";
import type { InstanceSnapshotDto } from "../../runtime/persistence/dto";
import type { PostgresQueryable } from "../../runtime/persistence/postgres";
import {
  isLifecycleSnapshotStale,
  requiresActiveInstanceRuntime,
  resolveAdminSnapshotFreshnessThresholdMs,
  type AdminRuntimeObservation
} from "./admin-instance-runtime-health";
import { parsePersistedHostedStartingPlayerState } from "../hosted/hosted-starting-player-state-policy";

const HEARTBEAT_LIVE_MS = 30_000;
const HEARTBEAT_STALE_MS = 120_000;

export interface AdminMonitoringInstanceRow extends Record<string, unknown> {
  server_instance_id: string;
  mode: string;
  status: string;
  payload?: unknown;
  snapshot_payload?: unknown | null;
  instance_display_name?: unknown;
  instance_region?: unknown;
  instance_capacity?: unknown;
  instance_join_policy?: unknown;
  snapshot_tick?: unknown;
  snapshot_state_version?: unknown;
  snapshot_player_count?: unknown;
  snapshot_last_crash_at?: unknown;
  snapshot_lobby_display_name?: unknown;
  snapshot_lobby_region?: unknown;
  snapshot_lobby_capacity?: unknown;
  snapshot_lobby_join_policy?: unknown;
  snapshot_created_at: Date | string | null;
  heartbeat_at: Date | string | null;
  lock_owner: string | null;
  lease_incarnation_id: string | null;
  locked_until: Date | string | null;
  heartbeat_worker_id: string | null;
  heartbeat_worker_incarnation_id: string | null;
  last_error_at: Date | string | null;
  hosted_display_name: string | null;
  hosted_region: string | null;
  hosted_capacity: number | null;
  hosted_join_policy: string | null;
  hosted_status: string | null;
  hosted_starting_player_state: unknown;
  canonical_tick_rate_ms: number | null;
}

export const adminMonitoringInstanceQuery = (where: string): string => `
  SELECT si.server_instance_id, si.mode, si.status, si.payload,
    hsi.display_name AS hosted_display_name, hsi.region AS hosted_region,
    hsi.capacity AS hosted_capacity, hsi.join_policy AS hosted_join_policy, hsi.status AS hosted_status,
    hsi.canonical_tick_rate_ms, hsi.starting_player_state AS hosted_starting_player_state,
    sl.payload AS snapshot_payload, sl.created_at AS snapshot_created_at,
    COALESCE(ih.last_heartbeat_at, hsi.last_worker_heartbeat_at) AS heartbeat_at,
    hsi.runtime_lease_owner_id AS lock_owner,
    hsi.runtime_lease_incarnation_id AS lease_incarnation_id,
    hsi.runtime_lease_expires_at AS locked_until,
    ih.worker_id AS heartbeat_worker_id,
    worker.worker_incarnation_id AS heartbeat_worker_incarnation_id,
    (SELECT max(dl.created_at) FROM empire_diagnostic_log dl
      WHERE dl.server_instance_id = si.server_instance_id AND dl.level = 'error') AS last_error_at
  FROM empire_server_instances si
  LEFT JOIN empire_snapshot_latest sl ON sl.server_instance_id = si.server_instance_id
  LEFT JOIN empire_hosted_server_instances hsi ON hsi.server_instance_id = si.server_instance_id
  LEFT JOIN empire_hosted_instance_heartbeats ih ON ih.server_instance_id = si.server_instance_id
  LEFT JOIN empire_hosted_worker_heartbeats worker ON worker.worker_id = ih.worker_id
  ${where}
  ORDER BY si.created_at ASC, si.server_instance_id ASC`;

export const mapAdminMonitoringInstanceRow = (
  row: AdminMonitoringInstanceRow,
  generatedAt: string
): AdminInstanceSummaryView => {
  const payload = record(row.payload);
  const snapshot = snapshotFromAdminMonitoringRow(row);
  const lobby = snapshot?.lobby;
  const startingPlayerStateValid = parsePersistedHostedStartingPlayerState(
    row.hosted_starting_player_state
  ).accepted;
  const status = startingPlayerStateValid ? row.hosted_status || row.status : "failed";
  const heartbeatAt = row.heartbeat_at ? iso(row.heartbeat_at) : null;
  const snapshotAt = snapshot?.createdAt ?? (row.snapshot_created_at ? iso(row.snapshot_created_at) : null);
  const workerStatus = workerState(generatedAt, heartbeatAt);
  const freshnessThresholdMs = resolveAdminSnapshotFreshnessThresholdMs(row.mode, row.canonical_tick_rate_ms);
  const snapshotStale = isLifecycleSnapshotStale({ status, snapshotAt, generatedAt, freshnessThresholdMs });
  const leaseIdentityMatches = Boolean(row.lock_owner)
    && row.lock_owner === row.heartbeat_worker_id
    && Boolean(row.lease_incarnation_id)
    && row.lease_incarnation_id === row.heartbeat_worker_incarnation_id;
  const staleReason = runtimeStaleReason({
    status,
    snapshotStale,
    workerStatus,
    leaseOwner: row.lock_owner,
    leaseIdentityMatches,
    leaseExpiresAt: row.locked_until ? iso(row.locked_until) : null,
    generatedAt
  });
  const source = snapshot || snapshotAt ? "durable-snapshot" as const : "durable-control-plane" as const;
  return {
    serverInstanceId: row.server_instance_id,
    displayName: row.hosted_display_name
      || text(row.instance_display_name)
      || text(payload.displayName)
      || lobby?.displayName
      || text(row.snapshot_lobby_display_name)
      || row.server_instance_id,
    mode: row.mode,
    region: row.hosted_region
      || text(row.instance_region)
      || text(payload.region)
      || lobby?.region
      || text(row.snapshot_lobby_region)
      || "unknown",
    capacity: row.hosted_capacity
      ?? integer(row.instance_capacity ?? payload.capacity ?? lobby?.capacity ?? row.snapshot_lobby_capacity),
    joinPolicy: startingPlayerStateValid
      ? row.hosted_join_policy
        || text(row.instance_join_policy)
        || text(payload.joinPolicy)
        || lobby?.joinPolicy
        || text(row.snapshot_lobby_join_policy)
        || "unknown"
      : "closed",
    status,
    currentTick: snapshot?.tick ?? nullableNumber(row.snapshot_tick),
    stateVersion: snapshot?.integrity.rootVersion ?? nullableNumber(row.snapshot_state_version),
    playerCount: snapshot?.state.root.playerIds.length ?? integer(row.snapshot_player_count),
    workerStatus,
    lastHeartbeatAt: heartbeatAt,
    leaseOwner: row.lock_owner,
    leaseExpiresAt: row.locked_until ? iso(row.locked_until) : null,
    lastSnapshotAt: snapshotAt,
    snapshotStale,
    lastErrorAt: row.last_error_at
      ? iso(row.last_error_at)
      : snapshot?.metadata.lastCrashAt
        ?? optionalUnknownIso(row.snapshot_last_crash_at),
    freshness: {
      serverInstanceId: row.server_instance_id,
      generatedAt,
      source,
      dataAsOf: snapshotAt ?? heartbeatAt,
      lastSnapshotAt: snapshotAt,
      lastHeartbeatAt: heartbeatAt,
      stale: staleReason !== null,
      staleReason
    }
  };
};

export const snapshotFromAdminMonitoringRow = (
  row: AdminMonitoringInstanceRow
): InstanceSnapshotDto | null => (
  row.snapshot_payload ? coerce<InstanceSnapshotDto>(row.snapshot_payload) : null
);

export const loadAdminRuntimeObservation = async (
  database: PostgresQueryable,
  id: string
): Promise<AdminRuntimeObservation> => {
  const result = await database.query<{
    canonical_tick_rate_ms: number | null;
    last_started_at: Date | string | null;
    last_tick: number | null;
    last_snapshot_at: Date | string | null;
    last_error_code: string | null;
    last_applied_command_at: Date | string | null;
    instance_worker_id: string | null;
    instance_worker_incarnation_id: string | null;
    runtime_lease_incarnation_id: string | null;
  }>(
    `SELECT hsi.canonical_tick_rate_ms, hsi.last_started_at, hsi.runtime_lease_incarnation_id,
       ih.worker_id AS instance_worker_id,
       worker.worker_incarnation_id AS instance_worker_incarnation_id,
       ih.last_tick, ih.last_snapshot_at, ih.last_error_code,
       (SELECT max(result.applied_at) FROM empire_command_results result
         WHERE result.server_instance_id = hsi.server_instance_id
           AND result.status = 'applied') AS last_applied_command_at
     FROM empire_hosted_server_instances hsi
     LEFT JOIN empire_hosted_instance_heartbeats ih
       ON ih.server_instance_id = hsi.server_instance_id
     LEFT JOIN empire_hosted_worker_heartbeats worker
       ON worker.worker_id = ih.worker_id
     WHERE hsi.server_instance_id = $1`,
    [id]
  );
  const row = result.rows[0];
  return {
    canonicalTickRateMs: nullableNumber(row?.canonical_tick_rate_ms),
    instanceLastTick: nullableNumber(row?.last_tick),
    instanceLastSnapshotAt: optionalIso(row?.last_snapshot_at),
    instanceLastErrorCode: row?.last_error_code ?? null,
    lastAppliedCommandAt: optionalIso(row?.last_applied_command_at),
    lastStartedAt: optionalIso(row?.last_started_at),
    instanceWorkerId: row?.instance_worker_id ?? null,
    instanceWorkerIncarnationId: row?.instance_worker_incarnation_id ?? null,
    runtimeLeaseIncarnationId: row?.runtime_lease_incarnation_id ?? null
  };
};

export const loadAdminSnapshot = async (
  database: PostgresQueryable,
  id: string
): Promise<InstanceSnapshotDto | null> => {
  const result = await database.query<{ payload: unknown }>(
    "SELECT payload FROM empire_snapshot_latest WHERE server_instance_id = $1",
    [id]
  );
  return result.rows[0] ? coerce<InstanceSnapshotDto>(result.rows[0].payload) : null;
};

const workerState = (nowIso: string, heartbeat: string | null): AdminWorkerStatus => {
  if (!heartbeat) return "no-worker";
  const ageMs = Math.max(0, Date.parse(nowIso) - Date.parse(heartbeat));
  return ageMs <= HEARTBEAT_LIVE_MS ? "live" : ageMs <= HEARTBEAT_STALE_MS ? "stale" : "offline";
};

const runtimeStaleReason = (input: {
  status: string;
  snapshotStale: boolean;
  workerStatus: AdminWorkerStatus;
  leaseOwner: string | null;
  leaseIdentityMatches: boolean;
  leaseExpiresAt: string | null;
  generatedAt: string;
}): string | null => {
  if (!requiresActiveInstanceRuntime(input.status)) return null;
  if (input.snapshotStale) return "snapshot-stale";
  if (input.workerStatus !== "live") return `instance-worker-${input.workerStatus}`;
  if (!input.leaseOwner) return "runtime-lease-missing";
  if (!input.leaseIdentityMatches) return "runtime-lease-heartbeat-owner-mismatch";
  if (!input.leaseExpiresAt || Date.parse(input.leaseExpiresAt) <= Date.parse(input.generatedAt)) {
    return "runtime-lease-expired";
  }
  return null;
};

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
const optionalIso = (value: Date | string | null | undefined): string | null => value ? iso(value) : null;
const optionalUnknownIso = (value: unknown): string | null =>
  value == null || value === "" ? null : iso(value as Date | string);
const nullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const coerce = <T>(value: unknown): T => typeof value === "string" ? JSON.parse(value) as T : value as T;
const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
const text = (value: unknown): string => String(value ?? "").trim();
const integer = (value: unknown): number =>
  Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
