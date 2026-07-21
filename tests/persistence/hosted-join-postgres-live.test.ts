import * as crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  HostedJoinJobRecord,
  HostedJoinReservationRecord,
  HostedServerRecord
} from "../../apps/server/src/admin/hosted";
import { createPostgresAdminDurableRepositories } from "../../apps/server/src/admin/read-only";
import { createPostgresDatabase } from "../../apps/server/src/runtime/persistence/postgres";

const databaseUrl = process.env.EMPIRE_TEST_DATABASE_URL?.trim();
const describeWhenDatabaseConfigured = databaseUrl ? describe : describe.skip;

describeWhenDatabaseConfigured("hosted join reservation postgres live", () => {
  it("reserves the last slot atomically and releases an expired reservation", async () => {
    const database = createPostgresDatabase(databaseUrl!);
    await database.query(
      `UPDATE empire_hosted_server_action_requests SET status='failed',claimed_until=NULL,
         last_error_code='TEST_FIXTURE_SUPERSEDED',updated_at=clock_timestamp(),version=version+1
       WHERE server_instance_id LIKE 'instance:local-join-live:%' AND status IN ('requested','processing')`
    );
    const repositories = createPostgresAdminDurableRepositories(database);
    const suffix = crypto.randomUUID();
    const serverInstanceId = `instance:local-join-live:${suffix}`;
    const createdAt = new Date().toISOString();
    const adminUser = await repositories.users.getByNormalizedUsername("erik22");
    expect(adminUser).toMatchObject({ role: "owner", status: "active" });
    if (!adminUser) throw new Error("Live owner admin Erik22 is required.");
    const adminUserId = adminUser.adminUserId;
    const server: HostedServerRecord = {
      serverInstanceId,
      mode: "free",
      serverTemplate: "full",
      displayName: `Local Join Race ${suffix.slice(0, 8)}`,
      region: "eu-central",
      capacity: 1,
      status: "lobby",
      joinPolicy: "open",
      provisioningState: "ready",
      minimumReadyPlayersToStart: 2,
      registrationWindowMinutes: 60,
      registrationScheduleVersion: 1,
      registrationOpensAt: new Date(Date.parse(createdAt) - 30 * 60_000).toISOString(),
      registrationClosesAt: new Date(Date.parse(createdAt) + 30 * 60_000).toISOString(),
      registrationClosedAt: null,
      registrationBaselinePlayers: null,
      canonicalFinalLockdownTrigger: 8,
      canonicalFirstEliminationTick: 5_760,
      canonicalTickRateMs: 5_000,
      effectiveFinalLockdownTrigger: null,
      effectiveFirstEliminationTick: null,
      worldSeed: crypto.randomBytes(32).toString("base64url"),
      configVersion: 1,
      mapComposition: { downtown: 8, commercial: 36, residential: 64, industrial: 37, park: 16 },
      initialSnapshotId: `snapshot:initial:${suffix}`,
      currentSnapshotId: `snapshot:initial:${suffix}`,
      runtimeLeaseOwnerId: null,
      runtimeLeaseExpiresAt: null,
      lastWorkerHeartbeatAt: null,
      lastStartedAt: null,
      lastPausedAt: null,
      lastStoppedAt: null,
      lastErrorCode: null,
      createdByAdminUserId: adminUserId,
      createdAt,
      updatedAt: createdAt,
      version: 1
    };

    try {
      const created = await repositories.hosted.createServerTransaction({
        server,
        job: {
          jobId: `provisioning:local-join-live:${suffix}`,
          serverInstanceId,
          attempt: 1,
          status: "completed",
          availableAt: createdAt,
          claimedByWorkerId: null,
          claimedUntil: null,
          lastErrorCode: null,
          createdAt,
          updatedAt: createdAt,
          version: 1
        },
        adminUserId,
        idempotencyKey: `create:${suffix}`,
        requestHash: suffix,
        audit: audit("create-server-request", serverInstanceId, adminUserId, createdAt, suffix)
      });
      expect(created.kind).toBe("created");
      const workerId = `worker:join-live:${suffix}`;
      const workerIncarnationId = `worker-incarnation:${suffix}`;
      const initialLeaseExpiresAt = new Date(Date.parse(createdAt) + 5 * 60_000).toISOString();
      await repositories.hosted.writeWorkerHeartbeat({ workerId, workerIncarnationId, region: "local",
        buildSha: "test", startedAt: createdAt, lastHeartbeatAt: createdAt, status: "online" }, true);
      expect(await repositories.hosted.acquireRuntimeLease({ serverInstanceId, workerId, workerIncarnationId,
        now: createdAt, expiresAt: initialLeaseExpiresAt })).toBe(true);

      const first = joinInput(server, `player-a:${suffix}`, `join-a:${suffix}`, `hash-a:${suffix}`, createdAt);
      const second = joinInput(server, `player-b:${suffix}`, `join-b:${suffix}`, `hash-b:${suffix}`, createdAt);
      const raced = await Promise.all([
        repositories.hosted.reserveJoinTransaction(first),
        repositories.hosted.reserveJoinTransaction(second)
      ]);
      expect(raced.map((result) => result.kind).sort()).toEqual(["created", "server-full"]);

      const winnerInput = raced[0]?.kind === "created" ? first : second;
      const winner = raced.find((result) => result.kind === "created");
      expect(winner?.kind).toBe("created");
      if (winner?.kind !== "created") throw new Error("Atomic join race did not produce a winner.");
      expect(await repositories.hosted.reserveJoinTransaction(winnerInput)).toMatchObject({
        kind: "replayed",
        reservation: { reservationId: winner.reservation.reservationId }
      });
      expect(await repositories.hosted.reserveJoinTransaction({
        ...winnerInput,
        reservation: { ...winnerInput.reservation, requestHash: `conflict:${suffix}` }
      })).toMatchObject({ kind: "conflict" });
      expect(await repositories.hosted.getJoinCapacity(serverInstanceId, createdAt)).toEqual({
        committedPlayers: 0,
        reservedSlots: 1
      });

      const afterExpiry = new Date(Date.parse(winner.reservation.expiresAt) + 1).toISOString();
      expect(await repositories.hosted.expireJoinReservations(afterExpiry)).toBeGreaterThanOrEqual(1);
      expect(await repositories.hosted.getJoinCapacity(serverInstanceId, afterExpiry)).toEqual({
        committedPlayers: 0,
        reservedSlots: 0
      });

      const pendingAfterClose = joinInput(server, `player-c:${suffix}`, `join-c:${suffix}`, `hash-c:${suffix}`, afterExpiry);
      expect(await repositories.hosted.reserveJoinTransaction(pendingAfterClose)).toMatchObject({ kind: "created" });
      const action = {
        actionRequestId: `action:stop:${suffix}`,
        serverInstanceId,
        adminUserId,
        action: "stop" as const,
        actionPayload: {},
        reason: "Close local live-test fixture safely.",
        expectedVersion: 1,
        status: "requested" as const,
        claimedByWorkerId: null,
        claimedUntil: null,
        lastErrorCode: null,
        createdAt: afterExpiry,
        updatedAt: afterExpiry,
        version: 1
      };
      expect(await repositories.hosted.enqueueActionTransaction({
        request: action,
        idempotencyKey: `stop:${suffix}`,
        requestHash: `stop-hash:${suffix}`,
        audit: audit("lifecycle-request", serverInstanceId, adminUserId, afterExpiry, suffix)
      })).toMatchObject({ kind: "created" });
      const lifecycleLeaseExpiresAt = new Date(Date.parse(afterExpiry) + 60_000).toISOString();
      await repositories.hosted.writeWorkerHeartbeat({ workerId, workerIncarnationId, region: "local",
        buildSha: "test", startedAt: afterExpiry, lastHeartbeatAt: afterExpiry, status: "online" }, true);
      const claimedAction = await repositories.hosted.claimAction(workerId, workerIncarnationId, afterExpiry,
        lifecycleLeaseExpiresAt);
      expect(claimedAction).toMatchObject({ actionRequestId: action.actionRequestId, claimedByWorkerId: workerId });
      if (!claimedAction) throw new Error("Lifecycle action claim was not acquired.");
      expect(await repositories.hosted.acquireRuntimeLease({ serverInstanceId, workerId, now: afterExpiry,
        workerIncarnationId, expiresAt: lifecycleLeaseExpiresAt })).toBe(true);
      expect(await repositories.hosted.completeAction({
        request: claimedAction,
        workerIncarnationId,
        nextStatus: "stopped",
        nextJoinPolicy: "closed",
        at: afterExpiry,
        audit: audit("lifecycle-success", serverInstanceId, adminUserId, afterExpiry, suffix)
      })).toBe(true);
      expect(await repositories.hosted.getJoinReservation(pendingAfterClose.reservation.reservationId))
        .toMatchObject({ status: "reserved" });
      expect(await repositories.hosted.getServer(serverInstanceId)).toMatchObject({ status: "stopped", joinPolicy: "closed" });
    } finally {
      await database.close();
    }
  });

  it("opens registration from the database clock for exactly sixty minutes", async () => {
    const database = createPostgresDatabase(databaseUrl!);
    const repositories = createPostgresAdminDurableRepositories(database);
    const suffix = crypto.randomUUID();
    const serverInstanceId = `instance:registration-live:${suffix}`;
    const requestedAt = new Date().toISOString();
    const adminUser = await repositories.users.getByNormalizedUsername("erik22");
    if (!adminUser) throw new Error("Live owner admin Erik22 is required.");
    const hosted: HostedServerRecord = {
      serverInstanceId,
      mode: "free",
      serverTemplate: "full",
      displayName: `Registration Live ${suffix.slice(0, 8)}`,
      region: "eu-central",
      capacity: 20,
      status: "lobby",
      joinPolicy: "closed",
      provisioningState: "ready",
      minimumReadyPlayersToStart: 2,
      registrationWindowMinutes: 60,
      registrationScheduleVersion: 0,
      registrationOpensAt: null,
      registrationClosesAt: null,
      registrationClosedAt: null,
      registrationBaselinePlayers: null,
      canonicalFinalLockdownTrigger: 8,
      canonicalFirstEliminationTick: 5_760,
      canonicalTickRateMs: 5_000,
      effectiveFinalLockdownTrigger: null,
      effectiveFirstEliminationTick: null,
      worldSeed: crypto.randomBytes(32).toString("base64url"),
      configVersion: 1,
      mapComposition: { downtown: 8, commercial: 36, residential: 64, industrial: 37, park: 16 },
      initialSnapshotId: `snapshot:initial:${suffix}`,
      currentSnapshotId: `snapshot:initial:${suffix}`,
      runtimeLeaseOwnerId: null,
      runtimeLeaseExpiresAt: null,
      lastWorkerHeartbeatAt: null,
      lastStartedAt: null,
      lastPausedAt: null,
      lastStoppedAt: null,
      lastErrorCode: null,
      createdByAdminUserId: adminUser.adminUserId,
      createdAt: requestedAt,
      updatedAt: requestedAt,
      version: 1
    };

    try {
      expect((await repositories.hosted.createServerTransaction({
        server: hosted,
        job: { jobId: `job:${serverInstanceId}`, serverInstanceId, attempt: 1, status: "completed",
          availableAt: requestedAt, claimedByWorkerId: null, claimedUntil: null, lastErrorCode: null,
          createdAt: requestedAt, updatedAt: requestedAt, version: 1 },
        adminUserId: adminUser.adminUserId,
        idempotencyKey: `create-registration:${suffix}`,
        requestHash: `create-registration:${suffix}`,
        audit: audit("create-server-request", serverInstanceId, adminUser.adminUserId, requestedAt, suffix)
      })).kind).toBe("created");
      const request = {
        actionRequestId: `action:open-registration:${suffix}`,
        serverInstanceId,
        adminUserId: adminUser.adminUserId,
        action: "open-registration-now" as const,
        actionPayload: {},
        reason: "Open the live registration boundary test.",
        expectedVersion: 1,
        status: "requested" as const,
        claimedByWorkerId: null,
        claimedUntil: null,
        lastErrorCode: null,
        createdAt: requestedAt,
        updatedAt: requestedAt,
        version: 1
      };
      expect((await repositories.hosted.enqueueActionTransaction({ request,
        idempotencyKey: `open-registration:${suffix}`, requestHash: `open-registration:${suffix}`,
        audit: audit("lifecycle-request", serverInstanceId, adminUser.adminUserId, requestedAt, suffix) })).kind)
        .toBe("created");
      const workerId = `worker:registration-live:${suffix}`;
      const workerIncarnationId = `worker-incarnation:registration-live:${suffix}`;
      const leaseExpiresAt = new Date(Date.parse(requestedAt) + 60_000).toISOString();
      await repositories.hosted.writeWorkerHeartbeat({ workerId, workerIncarnationId, region: "local",
        buildSha: "test", startedAt: requestedAt, lastHeartbeatAt: requestedAt, status: "online" }, true);
      const claimed = await repositories.hosted.claimAction(workerId, workerIncarnationId, requestedAt,
        leaseExpiresAt);
      if (!claimed) throw new Error("Registration action claim was not acquired.");
      expect(await repositories.hosted.acquireRuntimeLease({ serverInstanceId, workerId, workerIncarnationId,
        now: requestedAt, expiresAt: leaseExpiresAt })).toBe(true);
      expect(await repositories.hosted.completeAction({ request: claimed, workerIncarnationId,
        nextStatus: "lobby", nextJoinPolicy: "open", at: "2000-01-01T00:00:00.000Z",
        audit: audit("lifecycle-success", serverInstanceId, adminUser.adminUserId, requestedAt, suffix) })).toBe(true);
      const opened = await repositories.hosted.getServer(serverInstanceId);
      expect(opened).toMatchObject({ joinPolicy: "open", registrationScheduleVersion: 1 });
      if (!opened?.registrationOpensAt || !opened.registrationClosesAt) {
        throw new Error("Registration timestamps were not persisted.");
      }
      expect(Date.parse(opened.registrationClosesAt) - Date.parse(opened.registrationOpensAt)).toBe(3_600_000);
      expect(Date.parse(opened.registrationOpensAt)).toBeGreaterThan(Date.parse("2025-01-01T00:00:00.000Z"));
    } finally {
      await database.close();
    }
  });
});

const joinInput = (
  server: HostedServerRecord,
  playerIdentityId: string,
  idempotencyKey: string,
  requestHash: string,
  createdAt: string
): { reservation: HostedJoinReservationRecord; job: HostedJoinJobRecord } => {
  const reservationId = `reservation:${crypto.randomUUID()}`;
  return {
    reservation: {
      reservationId,
      serverInstanceId: server.serverInstanceId,
      playerIdentityId,
      status: "reserved",
      idempotencyKey,
      requestHash,
      expectedServerVersion: server.version,
      reservedSlot: 1,
      factionId: "cartel",
      joinTicketId: null,
      expiresAt: new Date(Date.parse(createdAt) + 60_000).toISOString(),
      createdAt,
      committedAt: null,
      canceledAt: null,
      updatedAt: createdAt,
      version: 1
    },
    job: {
      jobId: `join-job:${reservationId}`,
      reservationId,
      serverInstanceId: server.serverInstanceId,
      status: "pending",
      attempt: 0,
      availableAt: createdAt,
      claimedByWorkerId: null,
      claimedUntil: null,
      lastErrorCode: null,
      createdAt,
      updatedAt: createdAt,
      version: 1
    }
  };
};

const audit = (
  action: "create-server-request" | "lifecycle-request" | "lifecycle-success",
  serverInstanceId: string,
  actorId: string,
  createdAt: string,
  suffix: string
) => ({
  id: `admin-audit:${action}:${crypto.randomUUID()}`,
  adminSessionId: null,
  actorId,
  role: null,
  action,
  targetInstanceId: serverInstanceId,
  result: "success" as const,
  createdAt,
  correlationId: `local-postgres-live:${suffix}`
});
