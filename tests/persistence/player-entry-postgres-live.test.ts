import * as crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { createHostedRuntimeWorker, type HostedServerRecord } from "../../apps/server/src/admin/hosted";
import { createPostgresAdminDurableRepositories, hashAdminPassword } from "../../apps/server/src/admin/read-only";
import { createServerApp } from "../../apps/server/src/app";
import { createPersistentGameplaySessionService } from "../../apps/server/src/auth";
import { createPostgresPlayerEntryRepository, entryErrorCode } from "../../apps/server/src/player-entry";
import { createPostgresDatabase, createPostgresGameplayIdentitySessionRepository,
  createPostgresRuntimePersistenceRepositories } from "../../apps/server/src/runtime/persistence/postgres";
import { applyPostgresTestMigrations, resolveLivePostgresSmokeConfig } from "./helpers/postgres-prod-like-smoke-helpers";

const live = resolveLivePostgresSmokeConfig();
const run = live.run ? it : it.skip;

describe("player entry postgres live", () => {
  run("accepts the last millisecond, rejects closesAt, and replays after close", async () => {
    const fixture = await createFixture();
    try {
      const hosted = await fixture.createServer(4);
      const [acceptedAccount, rejectedAccount] = await Promise.all([
        fixture.createAccount("boundary-accepted"),
        fixture.createAccount("boundary-rejected")
      ]);
      const closesAt = Date.parse(hosted.registrationClosesAt!);
      const beforeClose = new Date(closesAt - 1);
      const atClose = new Date(closesAt);
      await fixture.database.query(
        `UPDATE empire_hosted_server_instances
         SET last_worker_heartbeat_at=$2::timestamptz,runtime_lease_expires_at=$3::timestamptz
         WHERE server_instance_id=$1`,
        [hosted.serverInstanceId, atClose.toISOString(), new Date(closesAt + 60_000).toISOString()]
      );
      const acceptedProjection = await fixture.entry.getSpawnSelection(
        acceptedAccount.accountId,
        hosted.serverInstanceId,
        beforeClose
      );
      const rejectedProjection = await fixture.entry.getSpawnSelection(
        rejectedAccount.accountId,
        hosted.serverInstanceId,
        beforeClose
      );
      const acceptedDistrict = acceptedProjection.districts.find((district) => district.available)!;
      const rejectedDistrict = rejectedProjection.districts.find((district) =>
        district.available && district.districtId !== acceptedDistrict.districtId)!;
      const idempotencyKey = key("boundary-replay");
      const acceptedRequest = request(acceptedProjection, acceptedDistrict.districtId);
      const [accepted, rejected] = await Promise.allSettled([
        fixture.entry.confirmSpawnDistrict(acceptedAccount.accountId, acceptedRequest, idempotencyKey, beforeClose),
        fixture.entry.confirmSpawnDistrict(rejectedAccount.accountId,
          request(rejectedProjection, rejectedDistrict.districtId), key("boundary-closed"), atClose)
      ]);
      expect(accepted.status).toBe("fulfilled");
      expect(rejected.status === "rejected" ? entryErrorCode(rejected.reason) : null).toBe("SERVER_REGISTRATION_CLOSED");
      if (accepted.status !== "fulfilled") throw accepted.reason;
      await expect(fixture.entry.confirmSpawnDistrict(
        acceptedAccount.accountId,
        acceptedRequest,
        idempotencyKey,
        new Date(closesAt + 5_000)
      )).resolves.toMatchObject({ membershipId: accepted.value.membershipId });
      expect(await fixture.count("empire_server_memberships", hosted.serverInstanceId)).toBe(1);
      expect(await fixture.count("empire_hosted_join_reservations", hosted.serverInstanceId)).toBe(1);
    } finally {
      await fixture.close();
    }
  }, 60_000);

  run("serializes same-district and last-slot races without partial memberships", async () => {
    const fixture = await createFixture();
    try {
      const sameDistrictServer = await fixture.createServer(4);
      const [left, right] = await Promise.all([fixture.createAccount("left"), fixture.createAccount("right")]);
      const projection = await fixture.entry.getSpawnSelection(left.accountId, sameDistrictServer.serverInstanceId);
      const district = projection.districts.find((entry) => entry.available);
      expect(district).toBeTruthy();
      const sameDistrict = await Promise.allSettled([
        fixture.entry.confirmSpawnDistrict(left.accountId, request(projection, district!.districtId), key("same-left")),
        fixture.entry.confirmSpawnDistrict(right.accountId, request(projection, district!.districtId), key("same-right"))
      ]);
      expect(sameDistrict.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(sameDistrict.filter((result) => result.status === "rejected").map((result) =>
        result.status === "rejected" ? entryErrorCode(result.reason) : null)).toEqual(["SPAWN_ALREADY_RESERVED"]);
      expect(await fixture.count("empire_server_memberships", sameDistrictServer.serverInstanceId)).toBe(1);

      const lastSlotServer = await fixture.createServer(1);
      const [first, second] = await Promise.all([fixture.createAccount("slot-a"), fixture.createAccount("slot-b")]);
      const lastSlotProjection = await fixture.entry.getSpawnSelection(first.accountId, lastSlotServer.serverInstanceId);
      const districts = lastSlotProjection.districts.filter((entry) => entry.available).slice(0, 2);
      expect(districts).toHaveLength(2);
      const lastSlot = await Promise.allSettled([
        fixture.entry.confirmSpawnDistrict(first.accountId, request(lastSlotProjection, districts[0]!.districtId), key("slot-left")),
        fixture.entry.confirmSpawnDistrict(second.accountId, request(lastSlotProjection, districts[1]!.districtId), key("slot-right"))
      ]);
      expect(lastSlot.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(lastSlot.filter((result) => result.status === "rejected").map((result) =>
        result.status === "rejected" ? entryErrorCode(result.reason) : null)).toEqual(["SERVER_FULL"]);
      expect(await fixture.count("empire_server_memberships", lastSlotServer.serverInstanceId)).toBe(1);
      expect(await fixture.count("empire_hosted_join_reservations", lastSlotServer.serverInstanceId)).toBe(1);
    } finally {
      await fixture.close();
    }
  }, 60_000);

  run("restores setup, activates exactly once, scopes identity per server, and enforces server time leave", async () => {
    const fixture = await createFixture();
    try {
      const serverA = await fixture.createServer(4);
      const account = await fixture.createAccount("identity");
      const projectionA = await fixture.entry.getSpawnSelection(account.accountId, serverA.serverInstanceId);
      const districtA = projectionA.districts.find((entry) => entry.available)!;
      const membershipA = await fixture.entry.confirmSpawnDistrict(account.accountId, request(projectionA, districtA.districtId), key("interrupt"));
      expect((await fixture.entry.getOverview(account)).activeBlockingMembership).toMatchObject({
        membershipId: membershipA.membershipId,
        status: "setup_required",
        reservedSpawnDistrictId: districtA.districtId,
        factionId: null,
        avatarId: null
      });
      const setupRequest = { membershipId: membershipA.membershipId, factionId: "mafian", avatarId: "mafian:1", gangColor: "#22d3ee" };
      const setupKey = key("setup-a");
      const finalizing = await fixture.entry.finalizeSetup(account.accountId, setupRequest, setupKey);
      expect(await fixture.entry.finalizeSetup(account.accountId, setupRequest, setupKey)).toMatchObject({ membershipId: finalizing.membershipId });
      await expect(fixture.entry.finalizeSetup(account.accountId, { ...setupRequest, factionId: "hackeri", avatarId: "hackeri:1" }, setupKey))
        .rejects.toMatchObject({ entryCode: "IDEMPOTENCY_CONFLICT" });
      await fixture.worker.runOnce();
      await fixture.worker.runOnce();
      expect(await fixture.entry.getMembership(membershipA.membershipId)).toMatchObject({
        status: "active", factionId: "mafian", avatarId: "mafian:1", starterPackageAppliedAt: expect.any(String)
      });
      expect(Object.keys(fixture.server.instanceManager.getInstanceById(serverA.serverInstanceId)!.state.playersById)).toHaveLength(1);
      expect(await fixture.eventCount(membershipA.membershipId, "player-activated")).toBe(1);

      await fixture.entry.syncResolvedMemberships(serverA.serverInstanceId, [], true, new Date().toISOString());
      const serverB = await fixture.createServer(4);
      const projectionB = await fixture.entry.getSpawnSelection(account.accountId, serverB.serverInstanceId);
      const membershipB = await fixture.entry.confirmSpawnDistrict(account.accountId,
        request(projectionB, projectionB.districts.find((entry) => entry.available)!.districtId), key("server-b"));
      await fixture.entry.finalizeSetup(account.accountId, {
        membershipId: membershipB.membershipId, factionId: "hackeri", avatarId: "hackeri:1", gangColor: "#3b82f6"
      }, key("setup-b"));
      await fixture.worker.runOnce();
      expect(await fixture.entry.getMembership(membershipA.membershipId)).toMatchObject({ status: "completed", factionId: "mafian", avatarId: "mafian:1" });
      expect(await fixture.entry.getMembership(membershipB.membershipId)).toMatchObject({ status: "active", factionId: "hackeri", avatarId: "hackeri:1" });

      await fixture.entry.syncResolvedMemberships(serverB.serverInstanceId, [], true, new Date().toISOString());
      const startedAt = new Date(Date.now() - 30 * 60 * 1000);
      const leaveServer = await fixture.createServer(4, startedAt.toISOString());
      const leaveAccount = await fixture.createAccount("leave-ok");
      const leaveProjection = await fixture.entry.getSpawnSelection(leaveAccount.accountId, leaveServer.serverInstanceId, new Date());
      const leaveMembership = await fixture.entry.confirmSpawnDistrict(leaveAccount.accountId,
        request(leaveProjection, leaveProjection.districts.find((entry) => entry.available)!.districtId), key("leave-ok"), new Date());
      expect((await fixture.entry.requestEarlyLeave(leaveAccount.accountId, leaveMembership.membershipId, new Date())).status).toBe("left_early");

      const expiredServer = await fixture.createServer(4, new Date(Date.now() - 61 * 60 * 1000).toISOString());
      const expiredAccount = await fixture.createAccount("leave-expired");
      const expiredProjection = await fixture.entry.getSpawnSelection(expiredAccount.accountId, expiredServer.serverInstanceId, new Date());
      const expiredMembership = await fixture.entry.confirmSpawnDistrict(expiredAccount.accountId,
        request(expiredProjection, expiredProjection.districts.find((entry) => entry.available)!.districtId), key("leave-expired"), new Date());
      await expect(fixture.entry.requestEarlyLeave(expiredAccount.accountId, expiredMembership.membershipId, new Date()))
        .rejects.toMatchObject({ entryCode: "EARLY_LEAVE_WINDOW_EXPIRED" });
    } finally {
      await fixture.close();
    }
  }, 90_000);
});

const createFixture = async () => {
  const database = createPostgresDatabase(live.databaseUrl!);
  await applyPostgresTestMigrations(database);
  await database.query(
    `UPDATE empire_server_membership_jobs SET status='failed',claimed_by_worker_id=NULL,claimed_until=NULL,
       last_error_code='TEST_FIXTURE_SUPERSEDED',updated_at=clock_timestamp(),version=version+1
     WHERE server_instance_id LIKE 'instance:player-entry:%' AND status IN ('pending','claimed')`
  );
  await database.query(
    `UPDATE empire_hosted_server_instances SET status='stopped',join_policy='closed',
       runtime_lease_owner_id=NULL,runtime_lease_incarnation_id=NULL,runtime_lease_expires_at=NULL,
       updated_at=clock_timestamp(),version=version+1
     WHERE server_instance_id LIKE 'instance:player-entry:%' AND status <> 'stopped'`
  );
  const suffix = crypto.randomUUID();
  const admin = createPostgresAdminDurableRepositories(database);
  const entry = createPostgresPlayerEntryRepository(database);
  const password = await hashAdminPassword("PlayerEntryLiveFixturePassword");
  const adminUserId = `admin-user:player-entry:${suffix}`;
  const at = new Date().toISOString();
  await admin.users.create({ adminUserId, username: `Entry${suffix.slice(0, 8)}`, normalizedUsername: `entry${suffix.replaceAll("-", "")}`,
    ...password, passwordVersion: 1, role: "owner", status: "active", displayName: "Player Entry Live", createdAt: at,
    updatedAt: at, lastLoginAt: null, passwordChangedAt: at, version: 1 });
  const workerId = `worker:player-entry:${suffix}`;
  const workerIncarnationId = `worker-incarnation:${workerId}`;
  await admin.hosted.writeWorkerHeartbeat({ workerId, workerIncarnationId,
    region: "eu-central", buildSha: "live-test", startedAt: at, lastHeartbeatAt: at, status: "online" });
  const persistence = createPostgresRuntimePersistenceRepositories({ databaseUrl: live.databaseUrl!, database, tickLockOwnerId: workerId });
  const server = createServerApp({ persistence, environment: { NODE_ENV: "production", EMPIRE_PERSISTENCE_DRIVER: "postgres",
    EMPIRE_DATABASE_URL: live.databaseUrl!, GAMEPLAY_SLICE_SESSION_SECRET: "player-entry-live-session-secret" },
    accountIdentityProvider: { productionReady: true, resolve: () => null },
    gameplaySessionService: createPersistentGameplaySessionService(createPostgresGameplayIdentitySessionRepository(database),
      { productionReady: true }) });
  const scopedControlPlane = {
    ...admin.hosted,
    listServers: async () => (await admin.hosted.listServers())
      .filter((record) => record.serverInstanceId.startsWith(`instance:player-entry:${suffix}:`))
  };
  const worker = createHostedRuntimeWorker({ workerId, workerIncarnationId, region: "eu-central", buildSha: "live-test",
    controlPlane: scopedControlPlane, server, playerEntry: entry });
  let serverIndex = 0;
  return {
    database, admin, entry, server, worker,
    createAccount: async (label: string) => (await entry.registerAccount({ username: `p_${label}_${suffix.slice(0, 8)}`,
      password: "PlayerEntryFixturePassword", gangName: `Gang ${label}` })).session,
    createServer: async (capacity: number, startedAt: string | null = null) => {
      serverIndex += 1;
      const serverInstanceId = `instance:player-entry:${suffix}:${serverIndex}`;
      const record: HostedServerRecord = { serverInstanceId, mode: "free", serverTemplate: "full",
        displayName: `Player Entry ${serverIndex} ${suffix.slice(0, 6)}`,
        region: "eu-central", capacity, status: "lobby", joinPolicy: "open", provisioningState: "ready",
        minimumReadyPlayersToStart: 2, registrationWindowMinutes: 60, registrationScheduleVersion: 1,
        registrationOpensAt: new Date(Date.parse(at) - 30 * 60_000).toISOString(),
        registrationClosesAt: new Date(Date.parse(at) + 30 * 60_000).toISOString(), registrationClosedAt: null,
        registrationBaselinePlayers: null, canonicalFinalLockdownTrigger: 8, canonicalFirstEliminationTick: 5_760,
        canonicalTickRateMs: 5_000, effectiveFinalLockdownTrigger: null, effectiveFirstEliminationTick: null,
        worldSeed: crypto.randomBytes(32).toString("base64url"), configVersion: 1,
        mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 }, initialSnapshotId: null,
        currentSnapshotId: null, runtimeLeaseOwnerId: null, runtimeLeaseExpiresAt: null,
        lastWorkerHeartbeatAt: null, lastStartedAt: null, lastPausedAt: null, lastStoppedAt: null,
        lastErrorCode: null, createdByAdminUserId: adminUserId, createdAt: at, updatedAt: at, version: 1 };
      await admin.hosted.createServerTransaction({ server: record, job: { jobId: `job:${serverInstanceId}`, serverInstanceId,
        attempt: 1, status: "completed", availableAt: at, claimedByWorkerId: null, claimedUntil: null, lastErrorCode: null,
        createdAt: at, updatedAt: at, version: 1 }, adminUserId, idempotencyKey: `create:${serverInstanceId}`,
        requestHash: crypto.createHash("sha256").update(serverInstanceId).digest("hex"), audit: { id: `audit:${serverInstanceId}`,
          adminSessionId: null, actorId: adminUserId, role: "owner", action: "create-server-request", targetInstanceId: serverInstanceId,
          result: "success", createdAt: at, correlationId: `test:${serverInstanceId}` } });
      const leaseAt = new Date();
      expect(await admin.hosted.acquireRuntimeLease({ serverInstanceId, workerId, workerIncarnationId,
        now: leaseAt.toISOString(), expiresAt: new Date(leaseAt.getTime() + 60_000).toISOString() })).toBe(true);
      const created = server.serverInstanceCreationService.createGameServerInstanceResult({ serverInstanceId, mode: "free",
        displayName: record.displayName, region: record.region, capacity, mapComposition: record.mapComposition as never, joinPolicy: "open",
        worldSeed: record.worldSeed });
      if (!created.accepted) throw new Error("Player entry live runtime fixture failed.");
      if (startedAt) server.instanceManager.startInstance(serverInstanceId);
      await server.instanceManager.saveInstanceSnapshot(serverInstanceId);
      const snapshot = await server.instanceManager.getPersistenceRepositories().snapshotRepository.loadLatest(serverInstanceId);
      if (!snapshot) throw new Error("Player entry live snapshot fixture failed.");
      await database.query(
        `UPDATE empire_hosted_server_instances
         SET initial_snapshot_id=$2,current_snapshot_id=$2,
           status=CASE WHEN $3::timestamptz IS NULL THEN status ELSE 'running' END,
           last_started_at=$3::timestamptz,updated_at=clock_timestamp()
         WHERE server_instance_id=$1`,
        [serverInstanceId, snapshot.snapshotId, startedAt]
      );
      if (startedAt) await database.query(
        "UPDATE empire_server_instances SET status='running',updated_at=clock_timestamp() WHERE server_instance_id=$1",
        [serverInstanceId]
      );
      return { ...record, status: startedAt ? "running" : "lobby", lastStartedAt: startedAt,
        initialSnapshotId: snapshot.snapshotId, currentSnapshotId: snapshot.snapshotId };
    },
    count: async (table: string, serverInstanceId: string) => Number((await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM ${table} WHERE server_instance_id=$1`, [serverInstanceId])).rows[0]?.count ?? 0),
    eventCount: async (membershipId: string, type: string) => Number((await database.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM empire_server_membership_events WHERE membership_id=$1 AND event_type=$2", [membershipId, type])).rows[0]?.count ?? 0),
    close: async () => { await worker.stop(); await persistence.close(); }
  };
};

const request = (projection: { serverInstanceId: string; availabilityRevision: string }, districtId: string) => ({
  serverInstanceId: projection.serverInstanceId, districtId, expectedAvailabilityRevision: projection.availabilityRevision
});
const key = (scope: string) => `${scope}:${crypto.randomUUID()}`;
