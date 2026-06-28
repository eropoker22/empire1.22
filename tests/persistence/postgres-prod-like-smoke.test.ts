import { describe, expect, it } from "vitest";
import { createPlaceTrapCommandFixture, createSelectSpawnDistrictCommandFixture } from "../fixtures/command-fixtures";
import { createServerApp } from "../../apps/server/src/app";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";
import {
  createPostgresDatabase,
  createPostgresGameplayIdentitySessionRepository
} from "../../apps/server/src/runtime/persistence/postgres";
import type { AccountIdentityProvider } from "../../apps/server/src/auth";
import type { GameplaySliceResponse } from "@empire/shared-types";
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
    const freeServerInstanceId = "instance:free:eu-central:public-1";
    const warServerInstanceId = "instance:war:eu-central:public-1";
    const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const accountId = `account:postgres-smoke:${runId}`;
    const warAccountId = `account:postgres-smoke-war:${runId}`;
    const environment = {
      NODE_ENV: "production",
      EMPIRE_PERSISTENCE_DRIVER: "postgres",
      EMPIRE_DATABASE_URL: liveConfig.databaseUrl!,
      GAMEPLAY_SLICE_SESSION_SECRET: "postgres-smoke-session-secret",
      GAMEPLAY_SLICE_SNAPSHOT_SECRET: "postgres-smoke-snapshot-secret",
      EMPIRE_ALLOWED_ORIGINS: origin
    };

    const createHandler = (currentAccountId: string) => {
      const server = createServerApp({
        environment,
        accountIdentityProvider: createFixedProductionAccountProvider(currentAccountId)
      });
      return {
        server,
        handler: createGameplaySliceFunctionHandler({ environment, server })
      };
    };

    const first = createHandler(accountId);
    const identityRepository = createPostgresGameplayIdentitySessionRepository(database);

    try {
      const reserve = await readJson(first.handler(postEvent("/api/matchmaking/reserve", {
        playerId: "player:forged-reserve",
        mode: "free",
        preferredServerInstanceId: freeServerInstanceId
      }, createHeaders(origin, accountId))));
      const reserveJson = expectJson(reserve);
      expect(reserveJson.accepted).toBe(true);
      expect(reserveJson.reservation?.serverInstanceId).toBe(freeServerInstanceId);
      const joinTicket = String(reserveJson.reservation?.joinTicket ?? "");
      expect(joinTicket).toBeTruthy();
      await expect(countRows(database, "empire_join_tickets", "ticket_id", joinTicket)).resolves.toBe(1);

      const join = await readJson(first.handler(postEvent("/api/gameplay-slice/join", {
        joinTicket,
        serverInstanceId: freeServerInstanceId,
        preferredStartDistrictId: "district:1",
        factionId: "mafian"
      }, createHeaders(origin, accountId))));
      const joinJson = expectJson(join);
      expect(joinJson.accepted).toBe(true);
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

      const snapshotToken = String(loadWithCookieJson.snapshotToken ?? joinJson.snapshotToken ?? "");
      const snapshotOnlyLoad = await readJson(first.handler(postEvent("/api/gameplay-slice/load", {
        serverInstanceId: freeServerInstanceId,
        playerId: serverPlayerId,
        snapshotToken
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

      const spawnSubmit = await readJson(first.handler(postEvent("/api/gameplay-slice/submit", {
        snapshotToken,
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
      const gameplaySnapshotToken = String(postSpawnLoadJson.snapshotToken ?? "");

      const actionCommand = createPlaceTrapCommandFixture({
        id: `command:postgres-smoke:${runId}:trap`,
        playerId: serverPlayerId,
        serverInstanceId: freeServerInstanceId,
        payload: { districtId: homeDistrictId }
      });
      const actionSubmit = await readJson(first.handler(postEvent("/api/gameplay-slice/submit", {
        snapshotToken: gameplaySnapshotToken,
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
        snapshotToken: gameplaySnapshotToken,
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
        snapshotToken: gameplaySnapshotToken,
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
        second.server.instanceManager.createInstance(freeServerInstanceId, "free");
        await second.server.instanceManager.restoreInstance(freeServerInstanceId);
        const restoredRuntime = second.server.instanceManager.getInstanceById(freeServerInstanceId);
        expect(restoredRuntime?.state.playersById[serverPlayerId]?.homeDistrictId).toBe(homeDistrictId);
        expect(restoredRuntime?.state.root.version).toBe(actionVersion);

        const restoredLoad = await readJson(second.handler(postEvent("/api/gameplay-slice/load", {
          serverInstanceId: freeServerInstanceId,
          districtId: homeDistrictId
        }, { cookie: cookieHeader })));
        const restoredLoadJson = expectJson(restoredLoad);
        expect(restoredLoadJson.accepted).toBe(true);
        expect(restoredLoadJson.readModel?.player.homeDistrictId).toBe(homeDistrictId);

        const restoredReplay = await readJson(second.handler(postEvent("/api/gameplay-slice/submit", {
          snapshotToken: restoredLoadJson.snapshotToken,
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
        }, createHeaders(origin, warAccountId))));
        const legacyWarReserve = await readJson(war.handler(postEvent("/api/matchmaking/reserve", {
          mode: "war",
          preferredServerInstanceId: "war-eu-01"
        }, createHeaders(origin, warAccountId))));
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
      await first.server.instanceManager.getPersistenceRepositories().close?.();
      await database.close();
    }
  });
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
  accountId: string
): Record<string, string> => ({
  origin,
  "x-empire-account-id": accountId
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
