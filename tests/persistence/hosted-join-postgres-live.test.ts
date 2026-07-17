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
      displayName: `Local Join Race ${suffix.slice(0, 8)}`,
      region: "eu-central",
      capacity: 1,
      status: "lobby",
      joinPolicy: "open",
      provisioningState: "ready",
      worldSeed: crypto.randomBytes(32).toString("base64url"),
      configVersion: 1,
      mapComposition: { downtown: 8, commercial: 36, residential: 64, industrial: 37, park: 16 },
      initialSnapshotId: null,
      currentSnapshotId: null,
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
      await repositories.hosted.completeAction({
        request: action,
        nextStatus: "stopped",
        nextJoinPolicy: "closed",
        at: afterExpiry,
        audit: audit("lifecycle-success", serverInstanceId, adminUserId, afterExpiry, suffix)
      });
      expect(await repositories.hosted.getJoinReservation(pendingAfterClose.reservation.reservationId))
        .toMatchObject({ status: "reserved" });
      expect(await repositories.hosted.getServer(serverInstanceId)).toMatchObject({ status: "stopped", joinPolicy: "closed" });
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
