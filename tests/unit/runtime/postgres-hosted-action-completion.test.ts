import { describe, expect, it, vi } from "vitest";
import type { AdminAuditEntryView } from "@empire/shared-types";
import type { PostgresDatabase, PostgresQueryable } from
  "../../../apps/server/src/runtime/persistence/postgres";
import type { HostedActionRequestRecord, HostedServerRecord } from
  "../../../apps/server/src/admin/hosted/hosted-control-plane-repository";
import { completePostgresHostedAction } from
  "../../../apps/server/src/admin/hosted/postgres-hosted-action-completion";

const DATABASE_NOW = "2026-07-20T16:00:00.000Z";
const WORKER_INPUT_TIME = "2026-07-20T15:00:00.000Z";

describe("PostgreSQL hosted lifecycle action completion", () => {
  it("uses database time and computes open-now closesAt on the server", async () => {
    const queryMock = postgresQuery(server({ registrationOpensAt: null, registrationClosesAt: null,
      registrationScheduleVersion: 0 }), 0);
    expect(await completePostgresHostedAction(databaseFor(queryMock), completion("open-registration-now"))).toBe(true);

    const calls = normalizedCalls(queryMock);
    const claim = calls.find((entry) => entry.sql.includes("status='processing' AND claimed_by_worker_id=$3"));
    expect(claim?.params?.[4]).toBe(DATABASE_NOW);
    const update = calls.find((entry) => entry.sql.includes("SET status=$2,join_policy=$3,registration_schedule_version=$4"));
    expect(update?.params?.[4]).toBe(DATABASE_NOW);
    expect(update?.params?.[5]).toBe("2026-07-20T17:00:00.000Z");
    expect(update?.params?.[2]).toBe("open");
  });

  it("locks durable ready memberships and rejects start below the per-server minimum", async () => {
    const queryMock = postgresQuery(server(), 1);
    expect(await completePostgresHostedAction(databaseFor(queryMock), completion("start"))).toBe(false);
    const calls = normalizedCalls(queryMock);
    expect(calls.some((entry) => entry.sql.includes("FOR UPDATE OF membership"))).toBe(true);
    expect(calls.some((entry) => entry.params?.includes("SERVER_START_MINIMUM_PLAYERS_NOT_MET"))).toBe(true);
    expect(calls.some((entry) => entry.sql.includes("SET status=$2,join_policy=$3,registration_schedule_version=$4"))).toBe(false);
  });

  it("accepts exactly two ready memberships and preserves the open registration window", async () => {
    const queryMock = postgresQuery(server(), 2);
    expect(await completePostgresHostedAction(databaseFor(queryMock), completion("start"))).toBe(true);
    const update = normalizedCalls(queryMock)
      .find((entry) => entry.sql.includes("SET status=$2,join_policy=$3,registration_schedule_version=$4"));
    expect(update?.params?.[1]).toBe("running");
    expect(update?.params?.[2]).toBe("open");
    expect(update?.params?.[10]).toBe(DATABASE_NOW);
  });
});

const postgresQuery = (hosted: HostedServerRecord, readyPlayers: number) => vi.fn(async (
  sql: string,
  _params?: readonly unknown[]
) => {
  if (sql.includes("clock_timestamp() AS authoritative_now") && sql.includes("FOR UPDATE")) {
    return pgResult([{ ...serverRow(hosted), authoritative_now: DATABASE_NOW,
      runtime_lease_incarnation_id: "worker-incarnation:test" }]);
  }
  if (sql.includes("FROM empire_hosted_server_action_requests") && sql.includes("FOR UPDATE")) {
    return pgResult([{ action_request_id: "action:test" }]);
  }
  if (sql.includes("JOIN empire_accounts") && sql.includes("FOR UPDATE OF membership")) {
    return pgResult(Array.from({ length: readyPlayers }, (_, index) => ({
      membership_id: `membership:${index + 1}`,
      player_id: `player:${index + 1}`,
      reserved_spawn_district_id: `district:${index + 1}`
    })));
  }
  return pgResult([{}]);
});

const databaseFor = (queryMock: ReturnType<typeof postgresQuery>): PostgresDatabase => {
  const query = queryMock as unknown as PostgresQueryable["query"];
  return {
    query,
    transaction: async (callback) => callback({ query }),
    close: async () => undefined
  };
};

const completion = (actionName: HostedActionRequestRecord["action"]) => ({
  request: action(actionName),
  workerIncarnationId: "worker-incarnation:test",
  nextStatus: actionName === "start" ? "running" as const : "lobby" as const,
  nextJoinPolicy: "closed" as const,
  at: WORKER_INPUT_TIME,
  audit: audit()
});

const action = (actionName: HostedActionRequestRecord["action"]): HostedActionRequestRecord => ({
  actionRequestId: "action:test", serverInstanceId: "instance:test", adminUserId: "admin:owner",
  action: actionName, actionPayload: {}, reason: "Test lifecycle action.", expectedVersion: 1,
  status: "processing", claimedByWorkerId: "worker:test", claimedUntil: "2026-07-20T18:00:00.000Z",
  lastErrorCode: null, createdAt: DATABASE_NOW, updatedAt: DATABASE_NOW, version: 2
});

const audit = (): AdminAuditEntryView => ({
  id: "audit:test", adminSessionId: null, actorId: "worker:test", role: null,
  action: "lifecycle-success", targetInstanceId: "instance:test", result: "success",
  correlationId: "correlation:test", createdAt: WORKER_INPUT_TIME
});

const server = (overrides: Partial<HostedServerRecord> = {}): HostedServerRecord => ({
  serverInstanceId: "instance:test", mode: "free", serverTemplate: "full", displayName: "Test",
  region: "eu-central", capacity: 20, status: "lobby", joinPolicy: "open", provisioningState: "ready",
  minimumReadyPlayersToStart: 2, registrationWindowMinutes: 60, registrationScheduleVersion: 1,
  registrationOpensAt: DATABASE_NOW, registrationClosesAt: "2026-07-20T17:00:00.000Z",
  registrationClosedAt: null, registrationBaselinePlayers: null, canonicalFinalLockdownTrigger: 8,
  canonicalFirstEliminationTick: 5_760, canonicalTickRateMs: 5_000, effectiveFinalLockdownTrigger: null,
  effectiveFirstEliminationTick: null, worldSeed: "seed", configVersion: 1,
  mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 },
  initialSnapshotId: "snapshot:initial", currentSnapshotId: "snapshot:initial", runtimeLeaseOwnerId: "worker:test",
  runtimeLeaseExpiresAt: "2026-07-20T18:00:00.000Z", lastWorkerHeartbeatAt: DATABASE_NOW,
  lastStartedAt: null, lastPausedAt: null, lastStoppedAt: null, lastErrorCode: null,
  createdByAdminUserId: "admin:owner", createdAt: DATABASE_NOW, updatedAt: DATABASE_NOW, version: 1,
  ...overrides
});

const serverRow = (hosted: HostedServerRecord): Record<string, unknown> => ({
  server_instance_id: hosted.serverInstanceId, mode: hosted.mode, server_template: hosted.serverTemplate,
  display_name: hosted.displayName, region: hosted.region, capacity: hosted.capacity, status: hosted.status,
  join_policy: hosted.joinPolicy, provisioning_state: hosted.provisioningState,
  minimum_ready_players_to_start: hosted.minimumReadyPlayersToStart,
  registration_window_minutes: hosted.registrationWindowMinutes,
  registration_schedule_version: hosted.registrationScheduleVersion,
  registration_opens_at: hosted.registrationOpensAt, registration_closes_at: hosted.registrationClosesAt,
  registration_closed_at: hosted.registrationClosedAt, registration_baseline_players: hosted.registrationBaselinePlayers,
  canonical_final_lockdown_trigger: hosted.canonicalFinalLockdownTrigger,
  canonical_first_elimination_tick: hosted.canonicalFirstEliminationTick,
  canonical_tick_rate_ms: hosted.canonicalTickRateMs,
  effective_final_lockdown_trigger: hosted.effectiveFinalLockdownTrigger,
  effective_first_elimination_tick: hosted.effectiveFirstEliminationTick,
  world_seed: hosted.worldSeed, config_version: hosted.configVersion, map_composition: hosted.mapComposition,
  initial_snapshot_id: hosted.initialSnapshotId, current_snapshot_id: hosted.currentSnapshotId,
  runtime_lease_owner_id: hosted.runtimeLeaseOwnerId, runtime_lease_expires_at: hosted.runtimeLeaseExpiresAt,
  last_worker_heartbeat_at: hosted.lastWorkerHeartbeatAt, last_started_at: hosted.lastStartedAt,
  last_paused_at: hosted.lastPausedAt, last_stopped_at: hosted.lastStoppedAt,
  last_error_code: hosted.lastErrorCode, created_by_admin_user_id: hosted.createdByAdminUserId,
  created_at: hosted.createdAt, updated_at: hosted.updatedAt, version: hosted.version
});

const normalizedCalls = (queryMock: ReturnType<typeof postgresQuery>) => queryMock.mock.calls.map(([sql, params]) => ({
  sql: String(sql).replace(/\s+/gu, " "),
  params: params as readonly unknown[] | undefined
}));

const pgResult = (rows: Record<string, unknown>[]) => ({ rows, rowCount: rows.length, command: "", oid: 0, fields: [] });
