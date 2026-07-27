import * as crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPostgresAdminDurableRepositories, hashAdminPassword } from "../../apps/server/src/admin/read-only";
import {
  createPostgresHostedRuntimeMutationCommitter,
  type HostedActionRequestRecord,
  type HostedServerRecord
} from "../../apps/server/src/admin/hosted";
import { createServerApp } from "../../apps/server/src/app";
import { createPersistentGameplaySessionService } from "../../apps/server/src/auth";
import { createPostgresPlayerEntryRepository } from "../../apps/server/src/player-entry";
import {
  createInstanceSnapshot,
  createLifecycleCheckpoint
} from "../../apps/server/src/runtime/persistence";
import {
  createPostgresGameplayIdentitySessionRepository,
  createPostgresRuntimePersistenceRepositories
} from "../../apps/server/src/runtime/persistence/postgres";
import { createIsolatedPostgresTestSchema } from "./helpers/isolated-postgres-test-schema";
import { resolveLivePostgresSmokeConfig } from "./helpers/postgres-prod-like-smoke-helpers";

const live = resolveLivePostgresSmokeConfig();
const run = live.run ? it : it.skip;

describe("hosted runtime mutation committer PostgreSQL live", () => {
  run("atomically commits membership, head, session revocation and lifecycle checkpoint", async () => {
    const fixture = await createFixture();
    try {
      const first = await fixture.createLeaveJob("first");
      const firstSnapshot = fixture.advanceSnapshot();
      expect(await fixture.committer.commitMembership({
        snapshot: firstSnapshot,
        completion: {
          membershipId: first.membershipId,
          jobId: first.jobId,
          serverInstanceId: fixture.serverInstanceId,
          accountId: first.accountId,
          workerId: fixture.workerId,
          workerIncarnationId: fixture.workerIncarnationId,
          expectedJobVersion: 1,
          joinTicketId: null,
          at: fixture.now
        },
        nextStatus: "left_early",
        revokePlayerId: first.playerId,
        fence: fixture.fence
      })).toBe(true);
      expect(await fixture.membershipStatus(first.membershipId)).toBe("left_early");
      expect(await fixture.headVersion()).toBe(firstSnapshot.integrity.rootVersion);
      expect(await fixture.sessionRevokedAt(first.sessionId)).not.toBeNull();

      const fenced = await fixture.createLeaveJob("incarnation-fence");
      const fencedSnapshot = fixture.advanceSnapshot();
      await fixture.database.query(
        `UPDATE empire_server_membership_jobs
         SET claimed_by_worker_incarnation_id='worker-incarnation:replacement'
         WHERE job_id=$1`,
        [fenced.jobId]
      );
      expect(await fixture.committer.commitMembership({
        snapshot: fencedSnapshot,
        completion: {
          membershipId: fenced.membershipId,
          jobId: fenced.jobId,
          serverInstanceId: fixture.serverInstanceId,
          accountId: fenced.accountId,
          workerId: fixture.workerId,
          workerIncarnationId: fixture.workerIncarnationId,
          expectedJobVersion: 1,
          joinTicketId: null,
          at: fixture.now
        },
        nextStatus: "left_early",
        revokePlayerId: fenced.playerId,
        fence: fixture.fence
      })).toBe(false);
      expect(await fixture.membershipStatus(fenced.membershipId)).toBe("leave_pending");
      expect(await fixture.headVersion()).toBe(firstSnapshot.integrity.rootVersion);
      expect(await fixture.sessionRevokedAt(fenced.sessionId)).toBeNull();
      await fixture.database.query(
        "DELETE FROM empire_server_membership_jobs WHERE job_id=$1",
        [fenced.jobId]
      );
      await fixture.database.query(
        "DELETE FROM empire_server_memberships WHERE membership_id=$1",
        [fenced.membershipId]
      );

      const second = await fixture.createLeaveJob("stale");
      const mismatchedSnapshot = fixture.advanceSnapshot();
      await expect(fixture.committer.commitMembership({
        snapshot: mismatchedSnapshot,
        completion: {
          membershipId: second.membershipId,
          jobId: second.jobId,
          serverInstanceId: fixture.serverInstanceId,
          accountId: second.accountId,
          workerId: fixture.workerId,
          workerIncarnationId: fixture.workerIncarnationId,
          expectedJobVersion: 1,
          joinTicketId: null,
          at: fixture.now
        },
        nextStatus: "left_early",
        revokePlayerId: "player:wrong-instance:wrong-account",
        fence: fixture.fence
      })).rejects.toThrow(/revocation player mismatch/u);
      expect(await fixture.membershipStatus(second.membershipId)).toBe("leave_pending");
      expect(await fixture.headVersion()).toBe(firstSnapshot.integrity.rootVersion);
      expect(await fixture.sessionRevokedAt(second.sessionId)).toBeNull();

      const staleSnapshot = fixture.advanceSnapshot();
      await fixture.database.query(
        `UPDATE empire_hosted_server_instances
         SET runtime_lease_incarnation_id='worker-incarnation:replacement'
         WHERE server_instance_id=$1`,
        [fixture.serverInstanceId]
      );
      await expect(fixture.committer.commitMembership({
        snapshot: staleSnapshot,
        completion: {
          membershipId: second.membershipId,
          jobId: second.jobId,
          serverInstanceId: fixture.serverInstanceId,
          accountId: second.accountId,
          workerId: fixture.workerId,
          workerIncarnationId: fixture.workerIncarnationId,
          expectedJobVersion: 1,
          joinTicketId: null,
          at: fixture.now
        },
        nextStatus: "left_early",
        revokePlayerId: second.playerId,
        fence: fixture.fence
      })).rejects.toMatchObject({ safeCode: "RUNTIME_LEASE_FENCE_REJECTED" });
      expect(await fixture.membershipStatus(second.membershipId)).toBe("leave_pending");
      expect(await fixture.headVersion()).toBe(firstSnapshot.integrity.rootVersion);
      expect(await fixture.sessionRevokedAt(second.sessionId)).toBeNull();
      await fixture.restoreLease();

      const prematureTicket = await fixture.sessions.createJoinTicket({
        ticketId: `join:premature:${fixture.suffix}`,
        accountId: second.accountId,
        serverInstanceId: fixture.serverInstanceId,
        mode: "free",
        factionId: "mafian",
        nowIso: fixture.now
      });
      await expect(fixture.sessions.consumeJoinTicket({
        ticketId: prematureTicket.ticketId,
        accountId: second.accountId,
        serverInstanceId: fixture.serverInstanceId,
        nowIso: fixture.now
      })).resolves.toMatchObject({ accepted: false, errors: [{ code: "JOIN_TICKET_INVALID" }] });

      const action = await fixture.createPauseAction();
      const lifecycleSnapshot = fixture.advanceSnapshot("paused");
      const checkpoint = createLifecycleCheckpoint(lifecycleSnapshot, "instance-paused");
      if (!lifecycleSnapshot.lobby) throw new Error("Lifecycle snapshot lobby is missing.");
      const colliding = {
        ...checkpoint,
        snapshot: {
          ...lifecycleSnapshot,
          lobby: {
            ...lifecycleSnapshot.lobby,
            displayName: `${lifecycleSnapshot.lobby.displayName} collision`
          }
        }
      };
      await fixture.persistence.snapshotRepository.saveCheckpoint(colliding);
      await expect(fixture.committer.commitAction({
        completion: fixture.actionCompletion(action),
        createSnapshotWrite: () => ({ snapshot: lifecycleSnapshot, checkpoint }),
        fence: fixture.fence
      })).rejects.toThrow(/collides with a different persisted checkpoint/u);
      expect(await fixture.hostedStatus()).toBe("running");
      expect(await fixture.actionStatus(action.actionRequestId)).toBe("processing");
      expect(await fixture.headVersion()).toBe(firstSnapshot.integrity.rootVersion);
      await fixture.database.query(
        "DELETE FROM empire_snapshots WHERE server_instance_id=$1 AND snapshot_id=$2",
        [fixture.serverInstanceId, checkpoint.checkpointId]
      );
      expect(await fixture.committer.commitAction({
        completion: fixture.actionCompletion(action),
        createSnapshotWrite: () => ({ snapshot: lifecycleSnapshot, checkpoint }),
        fence: fixture.fence
      })).toBe(true);
      expect(await fixture.hostedStatus()).toBe("paused");
      expect(await fixture.actionStatus(action.actionRequestId)).toBe("completed");
      expect(await fixture.headVersion()).toBe(lifecycleSnapshot.integrity.rootVersion);
      expect(await fixture.checkpointCount(checkpoint.checkpointId)).toBe(1);
    } finally {
      await fixture.close();
    }
  }, 90_000);
});

const createFixture = async () => {
  const isolated = await createIsolatedPostgresTestSchema(
    live.databaseUrl!,
    "hosted_runtime_mutation"
  );
  const database = isolated.database;
  const suffix = crypto.randomUUID();
  const now = new Date().toISOString();
  const workerId = `worker:mutation:${suffix}`;
  const workerIncarnationId = `worker-incarnation:mutation:${suffix}`;
  const adminUserId = `admin-user:mutation:${suffix}`;
  const serverInstanceId = `instance:mutation:${suffix}`;
  const admin = createPostgresAdminDurableRepositories(database);
  const password = await hashAdminPassword("MutationCommitterFixturePassword");
  await admin.users.create({
    adminUserId,
    username: `Mutation${suffix.slice(0, 8)}`,
    normalizedUsername: `mutation${suffix.replaceAll("-", "")}`,
    ...password,
    passwordVersion: 1,
    role: "owner",
    status: "active",
    displayName: "Mutation fixture",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    passwordChangedAt: now,
    version: 1
  });
  await admin.hosted.writeWorkerHeartbeat({
    workerId,
    workerIncarnationId,
    region: "eu-central",
    startedAt: now,
    lastHeartbeatAt: now,
    buildSha: "test",
    status: "online"
  });
  const record = hostedRecord({ suffix, now, workerId, serverInstanceId, adminUserId });
  await admin.hosted.createServerTransaction({
    server: record,
    job: {
      jobId: `provision:${suffix}`,
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
    requestHash: crypto.createHash("sha256").update(suffix).digest("hex"),
    audit: audit(`create:${suffix}`, adminUserId, serverInstanceId, now)
  });
  await database.query(
    `UPDATE empire_hosted_server_instances
     SET runtime_lease_incarnation_id=$2
     WHERE server_instance_id=$1`,
    [serverInstanceId, workerIncarnationId]
  );
  const persistence = createPostgresRuntimePersistenceRepositories({
    databaseUrl: isolated.databaseUrl,
    database,
    tickLockOwnerId: workerId
  });
  const sessions = createPersistentGameplaySessionService(
    createPostgresGameplayIdentitySessionRepository(database),
    { productionReady: true }
  );
  const server = createServerApp({ persistence, gameplaySessionService: sessions });
  const created = server.serverInstanceCreationService.createGameServerInstanceResult({
    serverInstanceId,
    mode: "free",
    displayName: record.displayName,
    region: record.region,
    capacity: record.capacity,
    mapComposition: record.mapComposition as never,
    joinPolicy: "closed",
    worldSeed: record.worldSeed
  });
  if (!created.accepted) throw new Error("Mutation committer runtime fixture failed.");
  const runtime = created.runtime;
  await server.instanceManager.saveInstanceSnapshot(serverInstanceId);
  const initial = await persistence.snapshotRepository.loadRecoveryHead(serverInstanceId);
  if (!initial) throw new Error("Mutation committer snapshot fixture failed.");
  await database.query(
    `UPDATE empire_hosted_server_instances
     SET status='running',provisioning_state='ready',initial_snapshot_id=$2,current_snapshot_id=$2
     WHERE server_instance_id=$1`,
    [serverInstanceId, initial.snapshotId]
  );
  const entry = createPostgresPlayerEntryRepository(database);
  const committer = createPostgresHostedRuntimeMutationCommitter(database, persistence.snapshotMetrics);
  const fence = { workerId, workerIncarnationId };

  const createLeaveJob = async (label: string) => {
    const account = (await entry.registerAccount({
      username: `m_${label}_${suffix.slice(0, 8)}`,
      password: "MutationFixturePassword",
      passwordConfirmation: "MutationFixturePassword",
      dateOfBirth: "1990-01-01",
      gangName: `Mutation ${label}`
    })).session;
    const registration = await sessions.getOrCreateRegistration({
      accountId: account.accountId,
      serverInstanceId,
      nowIso: now
    });
    const session = await sessions.createSession({ registration, nowIso: now, ttlMs: 60_000 });
    const membershipId = `membership:${label}:${suffix}`;
    const jobId = `membership-job:${label}:${suffix}`;
    await database.query(
      `INSERT INTO empire_server_memberships
       (id,membership_id,account_id,server_instance_id,player_id,reserved_spawn_district_id,status,
        confirm_idempotency_key,confirm_request_hash,joined_at,early_leave_deadline,created_at,updated_at,version)
       VALUES ($1,$2,$3,$4,$5,$6,'leave_pending',$7,$8,$9::timestamptz,$10::timestamptz,$9::timestamptz,$9::timestamptz,1)`,
      [`membership-row:${membershipId}`, membershipId, account.accountId, serverInstanceId,
        registration.playerId, runtime.state.root.districtIds[0], `confirm:${label}:${suffix}`,
        `hash:${label}:${suffix}`, now, new Date(Date.parse(now) + 60_000).toISOString()]
    );
    await database.query(
      `INSERT INTO empire_server_membership_jobs
       (id,job_id,membership_id,server_instance_id,job_type,status,attempt,available_at,
        claimed_by_worker_id,claimed_by_worker_incarnation_id,claimed_until,created_at,updated_at,version)
       VALUES ($1,$2,$3,$4,'leave','claimed',1,$5::timestamptz,$6,$7,$8::timestamptz,
         $5::timestamptz,$5::timestamptz,1)`,
      [`membership-job-row:${jobId}`, jobId, membershipId, serverInstanceId, now, workerId,
        workerIncarnationId, new Date(Date.parse(now) + 60_000).toISOString()]
    );
    return { accountId: account.accountId, membershipId, jobId, playerId: registration.playerId, sessionId: session.sessionId };
  };

  const advanceSnapshot = (status: "running" | "paused" = "running") => {
    runtime.state.root = { ...runtime.state.root, version: runtime.state.root.version + 1 };
    runtime.record.status = status;
    runtime.state.serverInstance = { ...runtime.state.serverInstance, status, version: runtime.state.serverInstance.version + 1 };
    return createInstanceSnapshot(runtime);
  };

  return {
    suffix,
    now,
    workerId,
    workerIncarnationId,
    serverInstanceId,
    database,
    persistence,
    sessions,
    committer,
    fence,
    createLeaveJob,
    advanceSnapshot,
    restoreLease: () => database.query(
      `UPDATE empire_hosted_server_instances
       SET runtime_lease_owner_id=$2,runtime_lease_incarnation_id=$3,runtime_lease_expires_at=$4::timestamptz
       WHERE server_instance_id=$1`,
      [serverInstanceId, workerId, workerIncarnationId, new Date(Date.now() + 60_000).toISOString()]
    ),
    membershipStatus: async (id: string) => (await database.query<{ status: string }>(
      "SELECT status FROM empire_server_memberships WHERE membership_id=$1", [id])).rows[0]?.status,
    sessionRevokedAt: async (id: string) => (await database.query<{ revoked_at: unknown }>(
      "SELECT revoked_at FROM empire_gameplay_sessions WHERE session_id=$1", [id])).rows[0]?.revoked_at ?? null,
    headVersion: async () => Number((await database.query<{ root_version: string | number }>(
      "SELECT root_version FROM empire_snapshot_latest WHERE server_instance_id=$1", [serverInstanceId]
    )).rows[0]?.root_version),
    hostedStatus: async () => (await database.query<{ status: string }>(
      "SELECT status FROM empire_hosted_server_instances WHERE server_instance_id=$1", [serverInstanceId])).rows[0]?.status,
    actionStatus: async (id: string) => (await database.query<{ status: string }>(
      "SELECT status FROM empire_hosted_server_action_requests WHERE action_request_id=$1", [id])).rows[0]?.status,
    checkpointCount: async (id: string) => Number((await database.query<{ count: string | number }>(
      "SELECT count(*) FROM empire_snapshots WHERE server_instance_id=$1 AND snapshot_id=$2", [serverInstanceId, id]
    )).rows[0]?.count),
    createPauseAction: async (): Promise<HostedActionRequestRecord> => {
      const version = Number((await database.query<{ version: string | number }>(
        "SELECT version FROM empire_hosted_server_instances WHERE server_instance_id=$1", [serverInstanceId]
      )).rows[0]?.version);
      const action: HostedActionRequestRecord = {
        actionRequestId: `action:pause:${suffix}`,
        serverInstanceId,
        adminUserId,
        action: "pause",
        actionPayload: {},
        reason: "Atomic lifecycle test.",
        expectedVersion: version,
        status: "processing",
        claimedByWorkerId: workerId,
        claimedUntil: new Date(Date.now() + 60_000).toISOString(),
        lastErrorCode: null,
        createdAt: now,
        updatedAt: now,
        version: 1
      };
      await database.query(
        `INSERT INTO empire_hosted_server_action_requests
         (id,action_request_id,server_instance_id,admin_user_id,action,action_payload,reason,expected_version,status,
          claimed_by_worker_id,claimed_until,created_at,updated_at,version)
         VALUES ($1,$2,$3,$4,$5,'{}'::jsonb,$6,$7,$8,$9,$10::timestamptz,$11::timestamptz,$11::timestamptz,$12)`,
        [`action-row:${action.actionRequestId}`, action.actionRequestId, serverInstanceId, adminUserId,
          action.action, action.reason, version, action.status, workerId, action.claimedUntil, now, action.version]
      );
      return action;
    },
    actionCompletion: (request: HostedActionRequestRecord) => ({
      request,
      workerIncarnationId,
      nextStatus: "paused" as const,
      nextJoinPolicy: "closed" as const,
      at: now,
      audit: audit(`pause:${suffix}`, adminUserId, serverInstanceId, now)
    }),
    close: async () => {
      await database.query("DELETE FROM empire_gameplay_sessions WHERE server_instance_id=$1", [serverInstanceId]);
      await database.query("DELETE FROM empire_join_tickets WHERE server_instance_id=$1", [serverInstanceId]);
      await database.query("DELETE FROM empire_player_registrations WHERE server_instance_id=$1", [serverInstanceId]);
      await database.query("DELETE FROM empire_server_membership_events WHERE server_instance_id=$1", [serverInstanceId]);
      await database.query("DELETE FROM empire_server_membership_jobs WHERE server_instance_id=$1", [serverInstanceId]);
      await database.query("DELETE FROM empire_server_memberships WHERE server_instance_id=$1", [serverInstanceId]);
      await database.query("DELETE FROM empire_hosted_server_action_requests WHERE server_instance_id=$1", [serverInstanceId]);
      await database.query("DELETE FROM empire_hosted_server_provisioning_jobs WHERE server_instance_id=$1", [serverInstanceId]);
      await database.query("DELETE FROM empire_hosted_server_idempotency WHERE resource_id=$1", [serverInstanceId]);
      await database.query("DELETE FROM empire_hosted_server_instances WHERE server_instance_id=$1", [serverInstanceId]);
      await database.query("DELETE FROM empire_server_instances WHERE server_instance_id=$1", [serverInstanceId]);
      await database.query("DELETE FROM empire_accounts WHERE account_id LIKE $1", [`account:%`]);
      await database.query("DELETE FROM empire_admin_access_audit WHERE actor_id=$1", [adminUserId]);
      await database.query("DELETE FROM empire_admin_users WHERE admin_user_id=$1", [adminUserId]);
      await database.query("DELETE FROM empire_hosted_worker_heartbeats WHERE worker_id=$1", [workerId]);
      await persistence.close();
      await isolated.close();
    }
  };
};

const hostedRecord = (input: {
  suffix: string;
  now: string;
  workerId: string;
  serverInstanceId: string;
  adminUserId: string;
}): HostedServerRecord => ({
  serverInstanceId: input.serverInstanceId,
  mode: "free",
  serverTemplate: "full",
  displayName: `Mutation ${input.suffix.slice(0, 8)}`,
  region: "eu-central",
  capacity: 20,
  status: "lobby",
  joinPolicy: "closed",
  provisioningState: "ready",
  minimumReadyPlayersToStart: 2,
  registrationWindowMinutes: 60,
  registrationScheduleVersion: 1,
  registrationOpensAt: new Date(Date.parse(input.now) - 60_000).toISOString(),
  registrationClosesAt: new Date(Date.parse(input.now) + 59 * 60_000).toISOString(),
  registrationClosedAt: null,
  registrationBaselinePlayers: null,
  canonicalFinalLockdownTrigger: 8,
  canonicalFirstEliminationTick: 5_760,
  canonicalTickRateMs: 10_000,
  effectiveFinalLockdownTrigger: null,
  effectiveFirstEliminationTick: null,
  worldSeed: crypto.randomBytes(32).toString("base64url"),
  configVersion: 1,
  mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 },
  initialSnapshotId: null,
  currentSnapshotId: null,
  runtimeLeaseOwnerId: input.workerId,
  runtimeLeaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  lastWorkerHeartbeatAt: input.now,
  lastStartedAt: input.now,
  lastPausedAt: null,
  lastStoppedAt: null,
  lastErrorCode: null,
  createdByAdminUserId: input.adminUserId,
  createdAt: input.now,
  updatedAt: input.now,
  version: 1
});

const audit = (id: string, actorId: string, serverInstanceId: string, at: string) => ({
  id: `audit:${id}`,
  adminSessionId: null,
  actorId,
  role: "owner" as const,
  action: "lifecycle-success" as const,
  targetInstanceId: serverInstanceId,
  result: "success" as const,
  correlationId: `test:${id}`,
  createdAt: at
});
