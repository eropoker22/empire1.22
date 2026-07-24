import { describe, expect, it } from "vitest";
import { createPlaceTrapCommandFixture, createSelectSpawnDistrictCommandFixture } from "../fixtures/command-fixtures";
import { createServerApp } from "../../apps/server/src/app";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";
import {
  createPostgresDatabase,
  createPostgresGameplayIdentitySessionRepository
} from "../../apps/server/src/runtime/persistence/postgres";
import type { AccountIdentityProvider } from "../../apps/server/src/auth";
import { createHostedControlPlaneService, createHostedRuntimeWorker } from "../../apps/server/src/admin/hosted";
import { createPostgresAdminDurableRepositories, hashAdminPassword } from "../../apps/server/src/admin/read-only";
import { createPostgresPlayerEntryRepository } from "../../apps/server/src/player-entry";
import type { AdminSessionView, GameplaySliceResponse } from "@empire/shared-types";
import {
  applyPostgresTestMigrations,
  resolveLivePostgresSmokeConfig
} from "./helpers/postgres-prod-like-smoke-helpers";

type JsonResponse<T = GameplaySliceResponse & Record<string, any>> = {
  json: T | null;
};

const liveConfig = resolveLivePostgresSmokeConfig();
if (liveConfig.skipReason) {
  console.warn(liveConfig.skipReason);
}

const runSmoke = liveConfig.run ? it : it.skip;

describe("postgres prod-like runtime smoke", () => {
  runSmoke("verifies the closed-alpha free flow against live Postgres persistence", async () => {
    const database = createPostgresDatabase(liveConfig.databaseUrl!);
    await applyPostgresTestMigrations(database);

    const origin = "https://play.empire.test";
    const warServerInstanceId = "instance:war:eu-central:public-1";
    const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const accountId = `account:postgres-smoke:${runId}`;
    const warAccountId = `account:postgres-smoke-war:${runId}`;
    const environment = {
      NODE_ENV: "production",
      EMPIRE_PERSISTENCE_DRIVER: "postgres",
      EMPIRE_DATABASE_URL: liveConfig.databaseUrl!,
      GAMEPLAY_SLICE_SESSION_SECRET: "postgres-smoke-session-secret-2026-test",
      GAMEPLAY_SLICE_SNAPSHOT_SECRET: "postgres-smoke-snapshot-secret-2026-test",
      EMPIRE_ADMIN_FINGERPRINT_SECRET: "postgres-smoke-admin-fingerprint-secret-2026-test",
      EMPIRE_BUILD_SHA: "postgres-smoke",
      EMPIRE_ADMIN_WRITES_ENABLED: "true",
      EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "true",
      EMPIRE_SERVER_PROVISIONING_ENABLED: "true",
      EMPIRE_LEGACY_MATCHMAKING_ENABLED: "true",
      EMPIRE_ALLOWED_ORIGINS: origin
    };
    const adminRepositories = createPostgresAdminDurableRepositories(database);
    const adminUserId = `admin-user:postgres-smoke:${runId}`;
    const workerId = `worker:postgres-smoke:${runId}`;
    const at = new Date().toISOString();
    const password = await hashAdminPassword("PostgresSmokeFixturePassword");
    await adminRepositories.users.create({
      adminUserId,
      username: `PostgresSmoke${runId}`,
      normalizedUsername: `postgressmoke${runId}`,
      ...password,
      passwordVersion: 1,
      role: "owner",
      status: "active",
      displayName: "Postgres Smoke",
      createdAt: at,
      updatedAt: at,
      lastLoginAt: null,
      passwordChangedAt: at,
      version: 1
    });
    await adminRepositories.hosted.writeWorkerHeartbeat({
      workerId,
      workerIncarnationId: `worker-incarnation:${workerId}`,
      region: "eu-central",
      buildSha: "postgres-smoke",
      startedAt: at,
      lastHeartbeatAt: at,
      status: "online"
    });
    const adminSession: AdminSessionView = {
      adminSessionId: `admin-session:postgres-smoke:${runId}`,
      adminUserId,
      actorId: adminUserId,
      username: `PostgresSmoke${runId}`,
      displayName: "Postgres Smoke",
      role: "owner",
      authenticationMethod: "password",
      createdAt: at,
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      revokedAt: null,
      lastSeenAt: at
    };
    const controlPlane = createHostedControlPlaneService({ repositories: adminRepositories, environment });

    const createHandler = (currentAccountId: string) => {
      const server = createServerApp({
        environment,
        database,
        accountIdentityProvider: createFixedProductionAccountProvider(currentAccountId)
      });
      return {
        server,
        handler: createGameplaySliceFunctionHandler({ environment, server, adminRepositories, database })
      };
    };

    const first = createHandler(accountId);
    const workerServer = createServerApp({ environment, database });
    const playerEntry = createPostgresPlayerEntryRepository(database);
    const identityRepository = createPostgresGameplayIdentitySessionRepository(database);
    let worker: ReturnType<typeof createHostedRuntimeWorker> | null = null;
    let freeServerInstanceId: string | null = null;

    try {
      const created = await controlPlane.createServer({
        session: adminSession,
        payload: {
          mode: "free",
          serverTemplate: "full",
          displayName: `Postgres Smoke ${runId}`,
          region: "eu-central",
          capacity: 20,
          joinPolicy: "closed",
          mapComposition: { downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 }
        },
        idempotencyKey: `postgres-smoke-create-${runId}`,
        correlationId: `postgres-smoke:create:${runId}`
      });
      if (!created.accepted) throw new Error(`Hosted smoke server creation failed: ${created.errors[0]?.code ?? "unknown"}`);
      freeServerInstanceId = created.data.server.serverInstanceId;
      worker = createHostedRuntimeWorker({
        workerId,
        region: "eu-central",
        buildSha: "postgres-smoke",
        controlPlane: adminRepositories.hosted,
        server: workerServer,
        playerEntry
      });
      await worker.runOnce();
      const provisioned = await adminRepositories.hosted.getServer(freeServerInstanceId);
      if (!provisioned || provisioned.provisioningState !== "ready") {
        throw new Error(`Hosted smoke server was not provisioned: ${JSON.stringify({
          status: provisioned?.status ?? null,
          provisioningState: provisioned?.provisioningState ?? null,
          lastErrorCode: provisioned?.lastErrorCode ?? null
        })}`);
      }
      const openJoins = await controlPlane.requestAction({
        session: adminSession,
        serverInstanceId: freeServerInstanceId,
        payload: { action: "open-registration-now", expectedVersion: provisioned.version, reason: "Postgres smoke join verification" },
        idempotencyKey: `postgres-smoke-open-${runId}`,
        correlationId: `postgres-smoke:open:${runId}`
      });
      if (!openJoins.accepted) throw new Error(`Hosted smoke joins failed: ${openJoins.errors[0]?.code ?? "unknown"}`);
      await worker.runOnce();
      const opened = await adminRepositories.hosted.getServer(freeServerInstanceId);
      if (opened?.joinPolicy !== "open" || opened.status !== "lobby") {
        throw new Error(`Hosted smoke joins were not opened: ${JSON.stringify({
          status: opened?.status ?? null,
          joinPolicy: opened?.joinPolicy ?? null,
          lastErrorCode: opened?.lastErrorCode ?? null
        })}`);
      }

      for (let index = 1; index <= 2; index += 1) {
        const readyAccount = (await playerEntry.registerAccount({
          username: `ready_${index}_${runId.replaceAll("-", "").slice(0, 10)}`,
          password: "PostgresSmokeReadyPlayerPassword",
          passwordConfirmation: "PostgresSmokeReadyPlayerPassword",
          dateOfBirth: "1990-01-01",
          gangName: `Ready Gang ${index}`
        })).session;
        const selection = await playerEntry.getSpawnSelection(readyAccount.accountId, freeServerInstanceId);
        const district = selection.districts.find((entry) => entry.available);
        if (!district) throw new Error(`Hosted smoke ready player ${index} has no spawn district.`);
        const membership = await playerEntry.confirmSpawnDistrict(readyAccount.accountId, {
          serverInstanceId: freeServerInstanceId,
          districtId: district.districtId,
          expectedAvailabilityRevision: selection.availabilityRevision
        }, `postgres-smoke-ready-confirm-${runId}-${index}`);
        await playerEntry.finalizeSetup(readyAccount.accountId, {
          membershipId: membership.membershipId,
          factionId: index === 1 ? "mafian" : "hackeri",
          avatarId: index === 1 ? "mafian:1" : "hackeri:1",
          gangColor: index === 1 ? "#22d3ee" : "#3b82f6"
        }, `postgres-smoke-ready-setup-${runId}-${index}`);
      }
      await worker.runOnce();
      await worker.runOnce();

      const matchmakingKey = `postgres-smoke-matchmaking-${runId}`;
      const matchmakingRequest = {
        playerId: "player:forged-reserve",
        mode: "free",
        preferredServerInstanceId: freeServerInstanceId
      };
      const pendingReserve = await readJson(first.handler(postEvent("/api/matchmaking/reserve", matchmakingRequest,
        createHeaders(origin, accountId, matchmakingKey))));
      const pendingReserveJson = expectJson(pendingReserve);
      expect(pendingReserveJson.accepted).toBe(false);
      if (!pendingReserveJson.reservation) {
        throw new Error(`Hosted smoke reservation was not created: ${JSON.stringify(pendingReserveJson.errors ?? [])}`);
      }
      expect(pendingReserveJson.reservation).toMatchObject({
        serverInstanceId: freeServerInstanceId,
        status: "reserved",
        joinTicket: null
      });
      expect(pendingReserveJson.errors[0]?.code).toBe("matchmaking.preparing");

      await worker.runOnce();
      const committedReserve = await readJson(first.handler(postEvent("/api/matchmaking/reserve", matchmakingRequest,
        createHeaders(origin, accountId, matchmakingKey))));
      const reserveJson = expectJson(committedReserve);
      if (!reserveJson.accepted) {
        throw new Error(`Hosted smoke reservation was not committed: ${JSON.stringify({
          reservation: reserveJson.reservation ?? null,
          errors: reserveJson.errors ?? []
        })}`);
      }
      expect(reserveJson.reservation).toMatchObject({ serverInstanceId: freeServerInstanceId, status: "committed" });
      const joinTicket = String(reserveJson.reservation?.joinTicket ?? "");
      expect(joinTicket).toBeTruthy();
      await expect(countRows(database, "empire_join_tickets", "ticket_id", joinTicket)).resolves.toBe(1);
      expect(first.server.instanceManager.getInstanceById(freeServerInstanceId)).toBeUndefined();

      const join = await readJson(first.handler(postEvent("/api/gameplay-slice/join", {
        joinTicket,
        serverInstanceId: freeServerInstanceId,
        preferredStartDistrictId: "district:1",
        factionId: "mafian"
      }, createHeaders(origin, accountId))));
      const joinJson = expectJson(join);
      expect(joinJson.accepted).toBe(true);
      expect(first.server.instanceManager.getInstanceById(freeServerInstanceId)).toBeDefined();
      expect(joinJson.sessionToken ?? null).toBeNull();
      const setCookie = String(join.headers["set-cookie"] ?? "");
      const cookieHeader = toCookieHeader(setCookie);
      const cookieToken = extractCookieValue(setCookie);
      expect(cookieHeader).toContain("empire_gameplay_session=");
      const tokenPayload = first.server.gameplaySessionTokenCodec!.open(cookieToken);
      expect(tokenPayload?.accountId).toBe(accountId);
      const persistedSession = await identityRepository.getSessionById(String(tokenPayload?.sessionId ?? ""));
      expect(persistedSession?.accountId).toBe(accountId);

      const readModel = joinJson.readModel!;
      const serverPlayerId = String(readModel.player.playerId);
      expect(serverPlayerId).not.toBe("player:forged-reserve");
      await expect(first.server.gameplaySessionService.listRegistrations()).resolves.toContainEqual(
        expect.objectContaining({
          accountId,
          serverInstanceId: freeServerInstanceId,
          playerId: serverPlayerId
        })
      );

      const loadWithCookie = await readJson(first.handler(postEvent("/api/gameplay-slice/load", {
        serverInstanceId: freeServerInstanceId,
        playerId: "player:forged-load"
      }, { cookie: cookieHeader })));
      const loadWithCookieJson = expectJson(loadWithCookie);
      expect(loadWithCookieJson.accepted).toBe(true);
      expect(loadWithCookieJson.readModel?.player.playerId).toBe(serverPlayerId);

      expect(loadWithCookieJson.snapshotToken ?? null).toBeNull();
      const snapshotOnlyLoad = await readJson(first.handler(postEvent("/api/gameplay-slice/load", {
        serverInstanceId: freeServerInstanceId,
        playerId: serverPlayerId,
        snapshotToken: "snapshot-token-must-not-authorize-production-load"
      })));
      const snapshotOnlyLoadJson = expectJson(snapshotOnlyLoad);
      expect(snapshotOnlyLoadJson.accepted).toBe(false);
      expect(snapshotOnlyLoadJson.errors[0]?.code).toBe("SESSION_REQUIRED");

      const noSessionLoad = await readJson(first.handler(postEvent("/api/gameplay-slice/load", {
        serverInstanceId: freeServerInstanceId,
        playerId: serverPlayerId
      })));
      const noSessionLoadJson = expectJson(noSessionLoad);
      expect(noSessionLoadJson.accepted).toBe(false);
      expect(noSessionLoadJson.errors[0]?.code).toBe("SESSION_REQUIRED");

      expect(loadWithCookieJson.readModel?.spawnSelection?.status).toBe("awaiting_spawn_selection");
      expect(loadWithCookieJson.readModel?.player.homeDistrictId ?? null).toBeNull();
      const spawnDistrictId = String(
        loadWithCookieJson.readModel?.spawnSelection?.districts?.find((district: { status?: string }) => district.status === "available")?.districtId ?? ""
      );
      expect(spawnDistrictId).toBeTruthy();
      const workerRuntime = workerServer.instanceManager.getInstanceById(freeServerInstanceId);
      if (!workerRuntime) throw new Error("Hosted smoke worker runtime disappeared before start.");
      expect(workerRuntime.state.root.playerIds.filter((playerId) =>
        workerRuntime.state.playersById[playerId]?.status === "active").length).toBeGreaterThanOrEqual(2);
      const beforeStart = await adminRepositories.hosted.getServer(freeServerInstanceId);
      if (!beforeStart) throw new Error("Hosted smoke server disappeared before start.");
      const start = await controlPlane.requestAction({
        session: adminSession,
        serverInstanceId: freeServerInstanceId,
        payload: { action: "start", expectedVersion: beforeStart.version, reason: "Postgres smoke gameplay start" },
        idempotencyKey: `postgres-smoke-start-${runId}`,
        correlationId: `postgres-smoke:start:${runId}`
      });
      if (!start.accepted) throw new Error(`Hosted smoke start failed: ${start.errors[0]?.code ?? "unknown"}`);
      await worker.runOnce();
      const started = await adminRepositories.hosted.getServer(freeServerInstanceId);
      if (started?.status !== "running") throw new Error(`Hosted smoke server did not start: ${started?.status ?? "missing"}`);
      const spawnSubmit = await readJson(first.handler(postEvent("/api/gameplay-slice/submit", {
        focusDistrictId: spawnDistrictId,
        command: createSelectSpawnDistrictCommandFixture({
          id: `command:postgres-smoke:${runId}:spawn`,
          playerId: serverPlayerId,
          serverInstanceId: freeServerInstanceId,
          payload: { districtId: spawnDistrictId }
        })
      }, {
        ...createHeaders(origin, accountId),
        cookie: cookieHeader
      })));
      const spawnSubmitJson = expectJson(spawnSubmit);
      expect(spawnSubmitJson.accepted).toBe(true);
      const homeDistrictId = String(spawnSubmitJson.readModel?.player.homeDistrictId ?? "");
      expect(homeDistrictId).toBeTruthy();
      expect(spawnSubmitJson.readModel?.spawnSelection?.status).not.toBe("awaiting_spawn_selection");

      const postSpawnLoad = await readJson(first.handler(postEvent("/api/gameplay-slice/load", {
        serverInstanceId: freeServerInstanceId,
        districtId: homeDistrictId
      }, { cookie: cookieHeader })));
      const postSpawnLoadJson = expectJson(postSpawnLoad);
      expect(postSpawnLoadJson.accepted).toBe(true);
      expect(postSpawnLoadJson.snapshotToken ?? null).toBeNull();

      const actionCommand = createPlaceTrapCommandFixture({
        id: `command:postgres-smoke:${runId}:trap`,
        playerId: serverPlayerId,
        serverInstanceId: freeServerInstanceId,
        payload: { districtId: homeDistrictId }
      });
      const actionSubmit = await readJson(first.handler(postEvent("/api/gameplay-slice/submit", {
        focusDistrictId: homeDistrictId,
        command: actionCommand
      }, {
        ...createHeaders(origin, accountId),
        cookie: cookieHeader
      })));
      const actionSubmitJson = expectJson(actionSubmit);
      expect(actionSubmitJson.accepted).toBe(true);
      const actionVersion = actionSubmitJson.commandResult?.rootVersionAfter;
      expect(actionVersion).toEqual(expect.any(Number));

      const replaySubmit = await readJson(first.handler(postEvent("/api/gameplay-slice/submit", {
        focusDistrictId: homeDistrictId,
        command: actionCommand
      }, {
        ...createHeaders(origin, accountId),
        cookie: cookieHeader
      })));
      const replaySubmitJson = expectJson(replaySubmit);
      expect(replaySubmitJson.accepted).toBe(true);
      expect(replaySubmitJson.commandResult).toMatchObject({
        commandId: actionCommand.id,
        status: "applied",
        rootVersionAfter: actionVersion
      });

      const payloadConflict = await readJson(first.handler(postEvent("/api/gameplay-slice/submit", {
        focusDistrictId: homeDistrictId,
        command: {
          ...actionCommand,
          payload: {
            districtId: `${homeDistrictId}:changed`
          }
        }
      }, {
        ...createHeaders(origin, accountId),
        cookie: cookieHeader
      })));
      const payloadConflictJson = expectJson(payloadConflict);
      expect(payloadConflictJson.accepted).toBe(false);
      expect(payloadConflictJson.errors[0]?.code).toBe("server.command_payload_conflict");

      const persistedResult = await first.server.instanceManager.getPersistenceRepositories()
        .commandResultRepository!.getByCommandId(freeServerInstanceId, actionCommand.id);
      expect(persistedResult?.status).toBe("applied");
      expect((await first.server.instanceManager.listEventRecords(freeServerInstanceId))
        .filter((record) => record.causedByCommandId === actionCommand.id)).toHaveLength(1);
      await expect(countRows(database, "empire_runtime_outbox", "command_id", actionCommand.id)).resolves.toBe(1);

      const latestSnapshot = await first.server.instanceManager.getPersistenceRepositories()
        .snapshotRepository.loadLatest(freeServerInstanceId);
      expect(latestSnapshot?.integrity.rootVersion).toBe(actionVersion);

      const second = createHandler(accountId);
      try {
        expect(second.server.instanceManager.getInstanceById(freeServerInstanceId)).toBeUndefined();

        const restoredLoad = await readJson(second.handler(postEvent("/api/gameplay-slice/load", {
          serverInstanceId: freeServerInstanceId,
          districtId: homeDistrictId
        }, { cookie: cookieHeader })));
        const restoredLoadJson = expectJson(restoredLoad);
        expect(restoredLoadJson.accepted).toBe(true);
        expect(restoredLoadJson.readModel?.player.homeDistrictId).toBe(homeDistrictId);
        const restoredRuntime = second.server.instanceManager.getInstanceById(freeServerInstanceId);
        expect(restoredRuntime?.state.playersById[serverPlayerId]?.homeDistrictId).toBe(homeDistrictId);
        expect(restoredRuntime?.state.root.version).toBe(actionVersion);

        const restoredReplay = await readJson(second.handler(postEvent("/api/gameplay-slice/submit", {
          focusDistrictId: homeDistrictId,
          command: actionCommand
        }, {
          ...createHeaders(origin, accountId),
          cookie: cookieHeader
        })));
        const restoredReplayJson = expectJson(restoredReplay);
        expect(restoredReplayJson.commandResult).toMatchObject({
          commandId: actionCommand.id,
          status: "applied",
          rootVersionAfter: actionVersion
        });

        const logout = await readJson(second.handler(postEvent("/api/gameplay-slice/logout", {}, {
          ...createHeaders(origin, accountId),
          cookie: cookieHeader
        })));
        const logoutJson = expectJson(logout);
        expect(logoutJson.accepted).toBe(true);

        const revokedLoad = await readJson(second.handler(postEvent("/api/gameplay-slice/load", {
          serverInstanceId: freeServerInstanceId,
          districtId: homeDistrictId
        }, { cookie: cookieHeader })));
        const revokedLoadJson = expectJson(revokedLoad);
        expect(revokedLoadJson.accepted).toBe(false);
        expect(["SESSION_REVOKED", "SESSION_INVALID"]).toContain(revokedLoadJson.errors[0]?.code);

        const revokedSubmit = await readJson(second.handler(postEvent("/api/gameplay-slice/submit", {
          focusDistrictId: homeDistrictId,
          command: createPlaceTrapCommandFixture({
            id: `command:postgres-smoke:${runId}:after-logout`,
            playerId: serverPlayerId,
            serverInstanceId: freeServerInstanceId,
            payload: { districtId: homeDistrictId }
          })
        }, {
          ...createHeaders(origin, accountId),
          cookie: cookieHeader
        })));
        const revokedSubmitJson = expectJson(revokedSubmit);
        expect(revokedSubmitJson.accepted).toBe(false);
        expect(["SESSION_REVOKED", "SESSION_INVALID"]).toContain(revokedSubmitJson.errors[0]?.code);
      } finally {
        await second.server.instanceManager.getPersistenceRepositories().close?.();
      }

      const war = createHandler(warAccountId);
      try {
        const warReserve = await readJson(war.handler(postEvent("/api/matchmaking/reserve", {
          mode: "war",
          preferredServerInstanceId: warServerInstanceId
        }, createHeaders(origin, warAccountId, `postgres-smoke-war-${runId}-canonical`))));
        const legacyWarReserve = await readJson(war.handler(postEvent("/api/matchmaking/reserve", {
          mode: "war",
          preferredServerInstanceId: "war-eu-01"
        }, createHeaders(origin, warAccountId, `postgres-smoke-war-${runId}-legacy`))));
        const warReserveJson = expectJson(warReserve);
        const legacyWarReserveJson = expectJson(legacyWarReserve);
        expect(warReserveJson.accepted).toBe(false);
        expect(legacyWarReserveJson.accepted).toBe(false);
        expect(warReserveJson.reservation).toBeNull();
        expect(legacyWarReserveJson.reservation).toBeNull();
        await expect(countRows(database, "empire_join_tickets", "account_id", warAccountId)).resolves.toBe(0);
      } finally {
        await war.server.instanceManager.getPersistenceRepositories().close?.();
      }
    } finally {
      await worker?.stop();
      await workerServer.instanceManager.getPersistenceRepositories().close?.();
      await first.server.instanceManager.getPersistenceRepositories().close?.();
      if (freeServerInstanceId) await cleanupHostedSmokeFixture(database, freeServerInstanceId, adminUserId, workerId);
      await database.close();
    }
  }, 90_000);
});

const postEvent = (
  path: string,
  body: unknown,
  headers?: Record<string, string | string[] | undefined>
) => ({
  httpMethod: "POST",
  path,
  body: JSON.stringify(body),
  headers
});

const readJson = async (responsePromise: Promise<{ statusCode: number; headers: Record<string, string>; body: string | null }>) => {
  const response = await responsePromise;
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) as GameplaySliceResponse & Record<string, any> : null
  };
};

const expectJson = <T = GameplaySliceResponse & Record<string, any>>(response: JsonResponse<T>): T => {
  expect(response.json).not.toBeNull();
  return response.json as T;
};

const createHeaders = (
  origin: string,
  accountId: string,
  idempotencyKey?: string
): Record<string, string> => ({
  origin,
  "x-empire-account-id": accountId,
  ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {})
});

const createFixedProductionAccountProvider = (accountId: string): AccountIdentityProvider => ({
  productionReady: true,
  resolve: ({ headers }) => String(headers?.["x-empire-account-id"] ?? "").trim() === accountId
    ? { accountId, provider: "production" }
    : null
});

const toCookieHeader = (setCookie: string): string =>
  setCookie.split(";")[0] ?? "";

const extractCookieValue = (setCookie: string): string =>
  toCookieHeader(setCookie).split("=").slice(1).join("=");

const countRows = async (
  database: ReturnType<typeof createPostgresDatabase>,
  table: "empire_join_tickets" | "empire_runtime_outbox",
  field: "ticket_id" | "account_id" | "command_id",
  value: string
): Promise<number> => {
  const result = await database.query<{ count: number | string }>(
    `SELECT COUNT(*)::int AS count FROM ${table} WHERE ${field} = $1`,
    [value]
  );
  return Number(result.rows[0]?.count ?? 0);
};

const cleanupHostedSmokeFixture = async (
  database: ReturnType<typeof createPostgresDatabase>,
  serverInstanceId: string,
  adminUserId: string,
  workerId: string
): Promise<void> => {
  await database.transaction(async (client) => {
    const membershipAccounts = await client.query<{ account_id: string }>(
      "SELECT account_id FROM empire_server_memberships WHERE server_instance_id=$1",
      [serverInstanceId]
    );
    const accountIds = membershipAccounts.rows.map((row) => String(row.account_id));
    await client.query("DELETE FROM empire_server_membership_jobs WHERE server_instance_id=$1", [serverInstanceId]);
    await client.query("DELETE FROM empire_server_membership_events WHERE server_instance_id=$1", [serverInstanceId]);
    await client.query("DELETE FROM empire_hosted_join_jobs WHERE server_instance_id=$1", [serverInstanceId]);
    await client.query("DELETE FROM empire_hosted_join_reservations WHERE server_instance_id=$1", [serverInstanceId]);
    await client.query("DELETE FROM empire_server_memberships WHERE server_instance_id=$1", [serverInstanceId]);
    if (accountIds.length > 0) {
      await client.query("DELETE FROM empire_accounts WHERE account_id=ANY($1::text[])", [accountIds]);
    }
    await client.query("DELETE FROM empire_hosted_instance_heartbeats WHERE server_instance_id=$1", [serverInstanceId]);
    await client.query("DELETE FROM empire_hosted_server_action_requests WHERE server_instance_id=$1", [serverInstanceId]);
    await client.query("DELETE FROM empire_hosted_server_provisioning_jobs WHERE server_instance_id=$1", [serverInstanceId]);
    await client.query("DELETE FROM empire_hosted_server_idempotency WHERE resource_id=$1", [serverInstanceId]);
    await client.query("DELETE FROM empire_hosted_server_idempotency WHERE admin_user_id=$1", [adminUserId]);
    await client.query("DELETE FROM empire_hosted_server_instances WHERE server_instance_id=$1", [serverInstanceId]);
    await client.query("DELETE FROM empire_server_instances WHERE server_instance_id=$1", [serverInstanceId]);
    await client.query("DELETE FROM empire_hosted_instance_heartbeats WHERE worker_id=$1", [workerId]);
    await client.query("DELETE FROM empire_hosted_worker_heartbeats WHERE worker_id=$1", [workerId]);
    await client.query("DELETE FROM empire_admin_access_audit WHERE actor_id=$1", [adminUserId]);
    await client.query("DELETE FROM empire_admin_users WHERE admin_user_id=$1", [adminUserId]);
  });
};
