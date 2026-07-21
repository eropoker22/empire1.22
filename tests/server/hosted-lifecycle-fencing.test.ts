import { describe, expect, it, vi } from "vitest";
import type { AdminAuditEntryView } from "@empire/shared-types";
import {
  createInMemoryHostedControlPlaneRepository,
  createPostgresHostedControlPlaneRepository,
  type HostedActionRequestRecord,
  type HostedServerRecord
} from "../../apps/server/src/admin/hosted";
import type {
  PostgresDatabase,
  PostgresQueryable
} from "../../apps/server/src/runtime/persistence/postgres";

const T0 = "2026-07-19T10:00:00.000Z";
const T1 = "2026-07-19T10:01:00.000Z";
const T2 = "2026-07-19T10:02:00.000Z";
const T3 = "2026-07-19T10:03:00.000Z";
const T4 = "2026-07-19T10:04:00.000Z";

describe("hosted lifecycle claim fencing", () => {
  it("rejects a late completion after another worker reclaimed the action", async () => {
    const repository = createInMemoryHostedControlPlaneRepository({ servers: [server()],
      readyMembershipsByServerId: readyMembershipSeed });
    await enqueue(repository, action());
    await registerWorker(repository, "worker:old", "worker-incarnation:old", T0);
    const stale = await repository.claimAction("worker:old", "worker-incarnation:old", T0, T1);
    await registerWorker(repository, "worker:new", "worker-incarnation:new", T2);
    const current = await repository.claimAction("worker:new", "worker-incarnation:new", T2, T4);
    expect(stale).not.toBeNull();
    expect(current).not.toBeNull();
    if (!stale || !current) return;
    expect(await repository.acquireRuntimeLease({ serverInstanceId: "instance:fence", workerId: "worker:new",
      workerIncarnationId: "worker-incarnation:new", now: T2, expiresAt: T4 })).toBe(true);

    expect(await repository.completeAction({ request: stale, workerIncarnationId: "worker-incarnation:old",
      nextStatus: "running", nextJoinPolicy: "closed",
      at: T3, audit: audit("stale-complete") })).toBe(false);
    expect(await repository.getServer("instance:fence")).toMatchObject({ status: "lobby", version: 1 });
    await registerWorker(repository, "worker:new", "worker-incarnation:new", T2, T3);
    expect(await repository.completeAction({ request: current, workerIncarnationId: "worker-incarnation:new",
      nextStatus: "running", nextJoinPolicy: "closed",
      at: T3, audit: audit("current-complete") })).toBe(true);
    expect(await repository.getServer("instance:fence")).toMatchObject({ status: "running", version: 2 });
  });

  it("rejects a late failure after another worker reclaimed the action", async () => {
    const repository = createInMemoryHostedControlPlaneRepository({ servers: [server({ status: "restarting" })] });
    await enqueue(repository, action({ action: "restart" }));
    await registerWorker(repository, "worker:old", "worker-incarnation:old", T0);
    const stale = await repository.claimAction("worker:old", "worker-incarnation:old", T0, T1);
    await registerWorker(repository, "worker:new", "worker-incarnation:new", T2);
    const current = await repository.claimAction("worker:new", "worker-incarnation:new", T2, T4);
    if (!stale || !current) throw new Error("Expected both lifecycle claims.");

    expect(await repository.failAction({ request: stale, workerIncarnationId: "worker-incarnation:old",
      errorCode: "STALE_FAILURE", at: T3,
      audit: audit("stale-failure") })).toBe(false);
    expect(await repository.getServer("instance:fence")).toMatchObject({ status: "restarting", version: 1 });
    await registerWorker(repository, "worker:new", "worker-incarnation:new", T2, T3);
    expect(await repository.failAction({ request: current, workerIncarnationId: "worker-incarnation:new",
      errorCode: "CURRENT_FAILURE", at: T3,
      audit: audit("current-failure") })).toBe(true);
    expect(await repository.getServer("instance:fence")).toMatchObject({ status: "failed", version: 2,
      lastErrorCode: "CURRENT_FAILURE" });
  });

  it("keeps a restart retryable when its runtime lease was handed to another worker", async () => {
    const repository = createInMemoryHostedControlPlaneRepository({ servers: [server({ status: "restarting" })] });
    await enqueue(repository, action({ action: "restart" }));
    await registerWorker(repository, "worker:shared", "worker-incarnation:old", T0);
    const stale = await repository.claimAction("worker:shared", "worker-incarnation:old", T0, T2);
    if (!stale) throw new Error("Expected the original restart claim.");
    await registerWorker(repository, "worker:shared", "worker-incarnation:new", T1);
    expect(await repository.acquireRuntimeLease({ serverInstanceId: "instance:fence", workerId: "worker:shared",
      workerIncarnationId: "worker-incarnation:new", now: T0, expiresAt: T4 })).toBe(true);

    expect(await repository.failAction({ request: stale, workerIncarnationId: "worker-incarnation:old",
      errorCode: "LATE_RESTART_FAILURE", at: T1,
      audit: audit("late-restart-failure") })).toBe(false);
    expect(await repository.getServer("instance:fence")).toMatchObject({
      status: "restarting", version: 1, runtimeLeaseOwnerId: "worker:shared", runtimeLeaseExpiresAt: T4,
      lastErrorCode: null
    });

    await registerWorker(repository, "worker:shared", "worker-incarnation:new", T1, T3);
    const reclaimed = await repository.claimAction("worker:shared", "worker-incarnation:new", T3, T4);
    expect(reclaimed).toMatchObject({ status: "processing", claimedByWorkerId: "worker:shared" });
  });

  it("requires the completing worker to own a non-expired runtime lease", async () => {
    const repository = createInMemoryHostedControlPlaneRepository({ servers: [server()],
      readyMembershipsByServerId: readyMembershipSeed });
    await enqueue(repository, action());
    await registerWorker(repository, "worker:owner", "worker-incarnation:owner", T0);
    const request = await repository.claimAction("worker:owner", "worker-incarnation:owner", T0, T4);
    if (!request) throw new Error("Expected a lifecycle claim.");

    expect(await repository.completeAction({ request, workerIncarnationId: "worker-incarnation:owner",
      nextStatus: "running", nextJoinPolicy: "closed",
      at: T1, audit: audit("missing-lease") })).toBe(false);
    expect(await repository.acquireRuntimeLease({ serverInstanceId: "instance:fence", workerId: "worker:owner",
      workerIncarnationId: "worker-incarnation:owner", now: T0, expiresAt: T1 })).toBe(true);
    expect(await repository.completeAction({ request, workerIncarnationId: "worker-incarnation:owner",
      nextStatus: "running", nextJoinPolicy: "closed",
      at: T1, audit: audit("expired-lease") })).toBe(false);
    await registerWorker(repository, "worker:owner", "worker-incarnation:owner", T0, T1);
    expect(await repository.acquireRuntimeLease({ serverInstanceId: "instance:fence", workerId: "worker:owner",
      workerIncarnationId: "worker-incarnation:owner", now: T1, expiresAt: T4 })).toBe(true);
    await registerWorker(repository, "worker:owner", "worker-incarnation:owner", T0, T2);
    expect(await repository.completeAction({ request, workerIncarnationId: "worker-incarnation:owner",
      nextStatus: "running", nextJoinPolicy: "closed",
      at: T2, audit: audit("live-lease") })).toBe(true);
  });

  it("locks the PostgreSQL claim row and fences completion by lease owner and expiry", async () => {
    const hosted = server({ runtimeLeaseOwnerId: "worker:owner", runtimeLeaseExpiresAt: T4,
      lastWorkerHeartbeatAt: T2 });
    const queryMock = vi.fn(async (sql: string, _params?: readonly unknown[]) => {
      if (sql.includes("clock_timestamp() AS authoritative_now")) return pgRows([{ ...postgresServerRow(hosted),
        authoritative_now: T2, runtime_lease_incarnation_id: "worker-incarnation:owner" }]);
      if (sql.includes("JOIN empire_accounts") && sql.includes("FOR UPDATE OF membership")) return pgRows([
        { membership_id: "membership:one", player_id: "player:one", reserved_spawn_district_id: "district:1" },
        { membership_id: "membership:two", player_id: "player:two", reserved_spawn_district_id: "district:2" }
      ]);
      return pgResult(1);
    });
    const query = queryMock as unknown as PostgresQueryable["query"];
    const database = {
      query,
      transaction: async (callback: (client: PostgresQueryable) => Promise<unknown>) => callback({ query }),
      close: async () => undefined
    } as PostgresDatabase;
    const repository = createPostgresHostedControlPlaneRepository(database);
    const request = action({ status: "processing", claimedByWorkerId: "worker:owner", claimedUntil: T4, version: 2 });

    expect(await repository.completeAction({ request, workerIncarnationId: "worker-incarnation:owner",
      nextStatus: "running", nextJoinPolicy: "closed",
      at: T2, audit: audit("postgres-complete") })).toBe(true);
    const statements = queryMock.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, " "));
    const claimIndex = statements.findIndex((sql) => sql.includes("status='processing' AND claimed_by_worker_id=$3"));
    const updateIndex = statements.findIndex((sql) => sql.includes("SET status=$2,join_policy=$3,registration_schedule_version=$4"));
    expect(statements[claimIndex]).toContain("version=$4 AND claimed_until > $5::timestamptz");
    expect(statements[claimIndex]).toContain("worker.worker_incarnation_id=$6");
    expect(statements[claimIndex]).toContain("FOR UPDATE");
    expect(statements[updateIndex]).toContain("runtime_lease_owner_id=$17");
    expect(statements[updateIndex]).toContain("runtime_lease_incarnation_id=$18");
    expect(statements[updateIndex]).toContain("runtime_lease_expires_at > clock_timestamp()");
    expect(queryMock.mock.calls[claimIndex]?.[1]).toEqual([request.actionRequestId, request.serverInstanceId,
      "worker:owner", request.version, T2, "worker-incarnation:owner", 30_000]);
  });

  it("does not fail a PostgreSQL restart after the runtime lease changed owners", async () => {
    const queryMock = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT status,version,runtime_lease_owner_id")) return {
        ...pgResult(1), rows: [{ status: "restarting", version: 1, runtime_lease_owner_id: "worker:old",
          runtime_lease_incarnation_id: "worker-incarnation:new" }]
      };
      return pgResult(1);
    });
    const query = queryMock as unknown as PostgresQueryable["query"];
    const database = {
      query,
      transaction: async (callback: (client: PostgresQueryable) => Promise<unknown>) => callback({ query }),
      close: async () => undefined
    } as PostgresDatabase;
    const repository = createPostgresHostedControlPlaneRepository(database);
    const request = action({ action: "restart", status: "processing", claimedByWorkerId: "worker:old",
      claimedUntil: T4, version: 2 });

    expect(await repository.failAction({ request, workerIncarnationId: "worker-incarnation:old",
      errorCode: "LATE_RESTART_FAILURE", at: T2,
      audit: audit("postgres-late-restart-failure") })).toBe(false);
    const statements = queryMock.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, " "));
    expect(statements).toHaveLength(2);
    expect(statements[1]).toContain("SELECT status,version,runtime_lease_owner_id");
    expect(statements[1]).toContain("FOR UPDATE");
    expect(statements.some((sql) => sql.includes("SET status='failed'"))).toBe(false);
  });
});

type Repository = ReturnType<typeof createInMemoryHostedControlPlaneRepository>;

const enqueue = async (repository: Repository, request: HostedActionRequestRecord): Promise<void> => {
  const result = await repository.enqueueActionTransaction({ request, idempotencyKey: `idempotency:${request.action}`,
    requestHash: `hash:${request.action}`, audit: audit("request") });
  expect(result.kind).toBe("created");
};

const registerWorker = (
  repository: Repository,
  workerId: string,
  workerIncarnationId: string,
  startedAt: string,
  lastHeartbeatAt = startedAt
) => repository.writeWorkerHeartbeat({ workerId, workerIncarnationId, region: "eu-central", buildSha: "test",
  startedAt, lastHeartbeatAt, status: "online" }, true);

const server = (overrides: Partial<HostedServerRecord> = {}): HostedServerRecord => Object.assign({
  serverInstanceId: "instance:fence", mode: "free", displayName: "Fence", region: "eu-central", capacity: 20,
  serverTemplate: "full",
  status: "lobby", joinPolicy: "closed", provisioningState: "ready", worldSeed: "fence-seed", configVersion: 1,
  minimumReadyPlayersToStart: 2, registrationWindowMinutes: 60, registrationScheduleVersion: 1,
  registrationOpensAt: new Date(Date.parse(T0) - 30 * 60_000).toISOString(),
  registrationClosesAt: new Date(Date.parse(T0) + 30 * 60_000).toISOString(), registrationClosedAt: null,
  registrationBaselinePlayers: null, canonicalFinalLockdownTrigger: 8, canonicalFirstEliminationTick: 5_760,
  canonicalTickRateMs: 5_000, effectiveFinalLockdownTrigger: null, effectiveFirstEliminationTick: null,
  mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 },
  initialSnapshotId: "snapshot:initial", currentSnapshotId: "snapshot:initial", runtimeLeaseOwnerId: null,
  runtimeLeaseExpiresAt: null, lastWorkerHeartbeatAt: null, lastStartedAt: null, lastPausedAt: null,
  lastStoppedAt: null, lastErrorCode: null, createdByAdminUserId: "admin:owner", createdAt: T0, updatedAt: T0,
  version: 1
} satisfies HostedServerRecord, overrides);

const action = (overrides: Partial<HostedActionRequestRecord> = {}): HostedActionRequestRecord => ({
  actionRequestId: "action:fence", serverInstanceId: "instance:fence", adminUserId: "admin:owner", action: "start",
  actionPayload: {},
  reason: "Fence lifecycle mutation.", expectedVersion: 1, status: "requested", claimedByWorkerId: null,
  claimedUntil: null, lastErrorCode: null, createdAt: T0, updatedAt: T0, version: 1, ...overrides
});

const audit = (actionName: string): AdminAuditEntryView => ({
  id: `audit:${actionName}`, adminSessionId: null, actorId: "worker:test", role: null, action: "lifecycle-success",
  targetInstanceId: "instance:fence", result: "success", correlationId: actionName, createdAt: T2
});

const pgResult = (rowCount: number) => ({ rows: rowCount > 0 ? [{}] : [], rowCount, command: "", oid: 0, fields: [] });

const readyMembershipSeed = { "instance:fence": [
  { membershipId: "membership:one", playerId: "player:one", reservedSpawnDistrictId: "district:1" },
  { membershipId: "membership:two", playerId: "player:two", reservedSpawnDistrictId: "district:2" }
] };

const postgresServerRow = (hosted: HostedServerRecord): Record<string, unknown> => ({
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
  last_paused_at: hosted.lastPausedAt, last_stopped_at: hosted.lastStoppedAt, last_error_code: hosted.lastErrorCode,
  created_by_admin_user_id: hosted.createdByAdminUserId, created_at: hosted.createdAt,
  updated_at: hosted.updatedAt, version: hosted.version
});

const pgRows = (rows: Record<string, unknown>[]) => ({ rows, rowCount: rows.length, command: "", oid: 0, fields: [] });
