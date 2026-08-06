import * as crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  copyFreeHostedStartingPlayerState,
  FREE_HOSTED_STARTING_MATERIAL_IDS
} from "@empire/game-config";
import type {
  HostedStartingPlayerStateView
} from "@empire/shared-types";
import type {
  HostedJoinJobRecord,
  HostedJoinReservationRecord,
  HostedServerRecord
} from "../../apps/server/src/admin/hosted";
import {
  createPostgresAdminDurableRepositories,
  hashAdminPassword
} from "../../apps/server/src/admin/read-only";
import type { PostgresDatabase } from "../../apps/server/src/runtime/persistence/postgres";
import { createIsolatedPostgresTestSchema } from "./helpers/isolated-postgres-test-schema";
import { resolveLivePostgresSmokeConfig } from "./helpers/postgres-prod-like-smoke-helpers";

const live = resolveLivePostgresSmokeConfig();
const describeWhenDatabaseConfigured = live.run ? describe : describe.skip;

describeWhenDatabaseConfigured("hosted join persisted starting-state postgres gate", () => {
  it("rejects corrupt legacy rows without reservations and accepts canonical shuffled zero values", async () => {
    const isolated = await createIsolatedPostgresTestSchema(live.databaseUrl!, "hosted_join_starting_state");
    const database = isolated.database;
    const repositories = createPostgresAdminDurableRepositories(database);
    const suffix = crypto.randomUUID();
    const now = new Date().toISOString();
    const serverInstanceId = `instance:join-starting-state:${suffix}`;
    const adminUserId = await createFixtureOwner(repositories, suffix, now);
    const server = serverRecord(serverInstanceId, adminUserId, suffix, now);

    try {
      expect((await repositories.hosted.createServerTransaction({
        server,
        job: {
          jobId: `provisioning:${serverInstanceId}`,
          serverInstanceId,
          attempt: 1,
          status: "completed",
          availableAt: now,
          claimedByWorkerId: null,
          claimedUntil: null,
          lastErrorCode: null,
          createdAt: now,
          updatedAt: now,
          version: 1
        },
        adminUserId,
        idempotencyKey: `create:${suffix}`,
        requestHash: `create:${suffix}`,
        audit: audit(serverInstanceId, adminUserId, now, suffix)
      })).kind).toBe("created");
      const workerId = `worker:join-starting-state:${suffix}`;
      const workerIncarnationId = `worker-incarnation:join-starting-state:${suffix}`;
      await repositories.hosted.writeWorkerHeartbeat({
        workerId,
        workerIncarnationId,
        region: "local",
        buildSha: "test",
        startedAt: now,
        lastHeartbeatAt: now,
        status: "online"
      }, true);
      expect(await repositories.hosted.acquireRuntimeLease({
        serverInstanceId,
        workerId,
        workerIncarnationId,
        now,
        expiresAt: new Date(Date.parse(now) + 5 * 60_000).toISOString()
      })).toBe(true);

      await database.query(
        `ALTER TABLE empire_hosted_server_instances
         ALTER COLUMN starting_player_state DROP DEFAULT,
         ALTER COLUMN starting_player_state DROP NOT NULL,
         ALTER COLUMN starting_player_state TYPE text USING starting_player_state::text`
      );

      const corruptStates = [
        null,
        "{invalid-json",
        JSON.stringify({ ...zeroStartingPlayerState(), cleanCash: "0" })
      ];
      for (const [index, persisted] of corruptStates.entries()) {
        await database.query(
          "UPDATE empire_hosted_server_instances SET starting_player_state=$2 WHERE server_instance_id=$1",
          [serverInstanceId, persisted]
        );

        expect(await repositories.hosted.reserveJoinTransaction(
          joinInput(server, `corrupt-${index}:${suffix}`, now)
        )).toEqual({ kind: "not-joinable" });
        expect(await joinRows(database, serverInstanceId)).toEqual({ reservations: 0, jobs: 0 });
      }

      const shuffled = {
        materials: Object.fromEntries(
          [...FREE_HOSTED_STARTING_MATERIAL_IDS].reverse().map((materialId) => [materialId, 0])
        ),
        spySlots: 2,
        population: 0,
        dirtyCash: 0,
        cleanCash: 0
      };
      await database.query(
        "UPDATE empire_hosted_server_instances SET starting_player_state=$2 WHERE server_instance_id=$1",
        [serverInstanceId, JSON.stringify(shuffled)]
      );

      const mapped = await repositories.hosted.getServer(serverInstanceId);
      expect(mapped?.startingPlayerState).toEqual(zeroStartingPlayerState());
      expect(Object.keys(mapped!.startingPlayerState!.materials)).toEqual(FREE_HOSTED_STARTING_MATERIAL_IDS);
      expect(await repositories.hosted.reserveJoinTransaction(
        joinInput(server, `valid:${suffix}`, now)
      )).toMatchObject({ kind: "created" });
      expect(await joinRows(database, serverInstanceId)).toEqual({ reservations: 1, jobs: 1 });
    } finally {
      await isolated.close();
    }
  }, 45_000);
});

const serverRecord = (
  serverInstanceId: string,
  adminUserId: string,
  suffix: string,
  now: string
): HostedServerRecord => ({
  serverInstanceId,
  mode: "free",
  serverTemplate: "full",
  displayName: `Join Starting State ${suffix.slice(0, 8)}`,
  region: "eu-central",
  capacity: 4,
  status: "lobby",
  joinPolicy: "open",
  provisioningState: "ready",
  minimumReadyPlayersToStart: 1,
  registrationWindowMinutes: 60,
  registrationScheduleVersion: 1,
  registrationOpensAt: new Date(Date.parse(now) - 30 * 60_000).toISOString(),
  registrationClosesAt: new Date(Date.parse(now) + 30 * 60_000).toISOString(),
  registrationClosedAt: null,
  registrationBaselinePlayers: null,
  canonicalFinalLockdownTrigger: 8,
  canonicalFirstEliminationTick: 5_760,
  canonicalTickRateMs: 10_000,
  effectiveFinalLockdownTrigger: null,
  effectiveFirstEliminationTick: null,
  worldSeed: crypto.randomBytes(32).toString("base64url"),
  configVersion: 1,
  mapComposition: {
    downtown: 8,
    commercial: 36,
    residential: 64,
    industrial: 37,
    park: 16
  },
  startingPlayerState: copyFreeHostedStartingPlayerState(),
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
  createdAt: now,
  updatedAt: now,
  version: 1
});

const createFixtureOwner = async (
  repositories: ReturnType<typeof createPostgresAdminDurableRepositories>,
  suffix: string,
  now: string
): Promise<string> => {
  const adminUserId = `admin-user:join-starting-state:${suffix}`;
  const password = await hashAdminPassword("HostedJoinStartingStatePassword");
  await repositories.users.create({
    adminUserId,
    username: `JoinState${suffix.slice(0, 8)}`,
    normalizedUsername: `joinstate${suffix.replaceAll("-", "")}`,
    ...password,
    passwordVersion: 1,
    role: "owner",
    status: "active",
    displayName: "Hosted join starting state fixture",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    passwordChangedAt: now,
    version: 1
  });
  return adminUserId;
};

const joinInput = (
  server: HostedServerRecord,
  identity: string,
  now: string
): { reservation: HostedJoinReservationRecord; job: HostedJoinJobRecord } => {
  const reservationId = `reservation:${crypto.randomUUID()}`;
  const reservation: HostedJoinReservationRecord = {
    reservationId,
    serverInstanceId: server.serverInstanceId,
    playerIdentityId: `account:${identity}`,
    status: "reserved",
    idempotencyKey: `join:${identity}`,
    requestHash: `hash:${identity}`,
    expectedServerVersion: server.version,
    reservedSlot: 1,
    factionId: "cartel",
    joinTicketId: null,
    expiresAt: new Date(Date.parse(now) + 60_000).toISOString(),
    createdAt: now,
    committedAt: null,
    canceledAt: null,
    updatedAt: now,
    version: 1
  };
  return {
    reservation,
    job: {
      jobId: `join-job:${reservationId}`,
      reservationId,
      serverInstanceId: server.serverInstanceId,
      status: "pending",
      attempt: 0,
      availableAt: now,
      claimedByWorkerId: null,
      claimedByWorkerIncarnationId: null,
      claimedUntil: null,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
      version: 1
    }
  };
};

const zeroStartingPlayerState = (): HostedStartingPlayerStateView => ({
  cleanCash: 0,
  dirtyCash: 0,
  population: 0,
  influence: 0,
  spySlots: 2,
  materials: Object.fromEntries(
    FREE_HOSTED_STARTING_MATERIAL_IDS.map((materialId) => [materialId, 0])
  ) as HostedStartingPlayerStateView["materials"]
});

const joinRows = async (
  database: PostgresDatabase,
  serverInstanceId: string
): Promise<{ reservations: number; jobs: number }> => {
  const result = await database.query<{ reservations: string | number; jobs: string | number }>(
    `SELECT
      (SELECT count(*) FROM empire_hosted_join_reservations WHERE server_instance_id=$1) AS reservations,
      (SELECT count(*) FROM empire_hosted_join_jobs WHERE server_instance_id=$1) AS jobs`,
    [serverInstanceId]
  );
  return {
    reservations: Number(result.rows[0]?.reservations ?? 0),
    jobs: Number(result.rows[0]?.jobs ?? 0)
  };
};

const audit = (
  serverInstanceId: string,
  actorId: string,
  now: string,
  suffix: string
) => ({
  id: `admin-audit:create-server-request:${crypto.randomUUID()}`,
  adminSessionId: null,
  actorId,
  role: null,
  action: "create-server-request" as const,
  targetInstanceId: serverInstanceId,
  result: "success" as const,
  createdAt: now,
  correlationId: `join-starting-state:${suffix}`
});
