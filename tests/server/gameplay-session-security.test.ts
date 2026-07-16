import { describe, expect, it } from "vitest";
import {
  createDevAccountIdentityProvider,
  createInMemoryGameplaySessionService,
  createPersistentGameplaySessionService,
  type AccountIdentityProvider,
  type GameplayIdentitySessionRepository,
  type GameplaySessionRecord,
  type JoinTicketRecord,
  type PlayerRegistrationRecord
} from "../../apps/server/src/auth";
import { createServerApp } from "../../apps/server/src/app";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";
import { ensureDefaultLobbyServers } from "../../apps/server/src/netlify/gameplay-slice-function-default-servers";
import { createPlaceTrapCommandFixture } from "../fixtures/command-fixtures";

const env = {
  NODE_ENV: "test",
  GAMEPLAY_SLICE_SNAPSHOT_SECRET: "test-snapshot-secret",
  GAMEPLAY_SLICE_SESSION_SECRET: "test-session-secret"
};

const serverInstanceId = "instance:free:eu-central:public-1";

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

const readBody = async (responsePromise: ReturnType<ReturnType<typeof createGameplaySliceFunctionHandler>>) => {
  const response = await responsePromise;
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null
  };
};

describe("gameplay session security", () => {
  it("resolves process environment before composing the default Netlify server", async () => {
    const keys = [
      "NODE_ENV",
      "GAMEPLAY_SLICE_SNAPSHOT_SECRET",
      "GAMEPLAY_SLICE_SESSION_SECRET",
      "EMPIRE_DATABASE_URL",
      "GAMEPLAY_DATABASE_URL"
    ] as const;
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

    try {
      process.env.NODE_ENV = "production";
      process.env.GAMEPLAY_SLICE_SNAPSHOT_SECRET = "production-snapshot-secret";
      process.env.GAMEPLAY_SLICE_SESSION_SECRET = "production-session-secret";
      delete process.env.EMPIRE_DATABASE_URL;
      delete process.env.GAMEPLAY_DATABASE_URL;
      const handler = createGameplaySliceFunctionHandler();
      const load = await readBody(handler(postEvent("/api/gameplay-slice/load", {
        serverInstanceId,
        playerId: "player:forged"
      })));

      expect(load.statusCode).toBe(500);
      expect(load.json.errors[0]).toMatchObject({
        code: "SESSION_INVALID",
        message: "Production gameplay session repository is not configured."
      });
    } finally {
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  });

  it("does not use the dev account provider as the production default", () => {
    const server = createServerApp({
      environment: {
        NODE_ENV: "production",
        GAMEPLAY_SLICE_SESSION_SECRET: "test-session-secret"
      }
    });

    const identity = server.accountIdentityProvider.resolve({
      headers: { "x-empire-account-id": "alice" },
      body: { accountId: "alice", playerId: "player:alice" }
    });

    expect(server.accountIdentityProvider.productionReady).toBe(false);
    expect(server.gameplaySessionService.productionReady).toBe(false);
    expect(identity).toBeNull();
  });

  it("rejects load for a supplied playerId when no gameplay session exists", async () => {
    const handler = createGameplaySliceFunctionHandler({ environment: env });
    const load = await readBody(handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId,
      playerId: "player:victim",
      districtId: "district:1"
    })));

    expect(load.statusCode).toBe(200);
    expect(load.json.accepted).toBe(false);
    expect(load.json.readModel).toBeNull();
    expect(load.json.errors[0].code).toBe("SESSION_REQUIRED");
    expect(load.json.sessionToken ?? null).toBeNull();
  });

  it("rejects load without playerId when no gameplay session exists", async () => {
    const handler = createGameplaySliceFunctionHandler({ environment: env });
    const load = await readBody(handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId,
      districtId: "district:1"
    })));

    expect(load.statusCode).toBe(200);
    expect(load.json.accepted).toBe(false);
    expect(load.json.readModel).toBeNull();
    expect(load.json.errors[0].code).toBe("SESSION_REQUIRED");
  });

  it("uses a join ticket once and binds load/submit/logout to the server session", async () => {
    const handler = createGameplaySliceFunctionHandler({ environment: env });
    const reserve = await readBody(handler(postEvent("/api/matchmaking/reserve", {
      accountId: "alice",
      playerId: "player:forged-alice",
      mode: "free",
      preferredServerInstanceId: serverInstanceId
    })));
    const joinTicket = String(reserve.json.reservation.joinTicket);

    const join = await readBody(handler(postEvent("/api/gameplay-slice/join", {
      accountId: "alice",
      playerId: "player:forged-alice",
      joinTicket,
      serverInstanceId,
      preferredStartDistrictId: "district:1",
      factionId: "mafian"
    })));
    const sessionToken = String(join.json.sessionToken);
    const snapshotToken = String(join.json.snapshotToken);
    const serverPlayerId = String(join.json.readModel.player.playerId);

    expect(join.json.accepted).toBe(true);
    expect(serverPlayerId).not.toBe("player:forged-alice");

    const reuse = await readBody(handler(postEvent("/api/gameplay-slice/join", {
      accountId: "alice",
      playerId: "player:forged-alice",
      joinTicket,
      serverInstanceId
    })));
    expect(reuse.json.accepted).toBe(false);
    expect(reuse.json.errors[0].code).toBe("JOIN_TICKET_ALREADY_USED");

    const snapshotOnlyLoad = await readBody(handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId,
      playerId: serverPlayerId,
      districtId: "district:1",
      snapshotToken
    })));
    expect(snapshotOnlyLoad.json.accepted).toBe(false);
    expect(snapshotOnlyLoad.json.errors[0].code).toBe("SESSION_REQUIRED");

    const forgedCommand = await readBody(handler(postEvent("/api/gameplay-slice/submit", {
      sessionToken,
      snapshotToken,
      focusDistrictId: "district:1",
      command: createPlaceTrapCommandFixture({
        playerId: "player:victim",
        serverInstanceId
      })
    })));
    expect(forgedCommand.json.accepted).toBe(false);
    expect(forgedCommand.json.errors[0].code).toBe("PLAYER_IDENTITY_MISMATCH");

    const snapshotOnlySubmit = await readBody(handler(postEvent("/api/gameplay-slice/submit", {
      snapshotToken,
      focusDistrictId: "district:1",
      command: createPlaceTrapCommandFixture({
        playerId: serverPlayerId,
        serverInstanceId
      })
    })));
    expect(snapshotOnlySubmit.json.accepted).toBe(false);
    expect(snapshotOnlySubmit.json.errors[0].code).toBe("SESSION_REQUIRED");

    const logout = await readBody(handler(postEvent("/api/gameplay-slice/logout", {
      sessionToken
    })));
    expect(logout.json.accepted).toBe(true);

    const revokedLoad = await readBody(handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId,
      playerId: serverPlayerId,
      sessionToken
    })));
    expect(revokedLoad.json.accepted).toBe(false);
    expect(revokedLoad.json.errors[0].code).toBe("SESSION_REVOKED");
  });

  it("uses HttpOnly cookie sessions in production and blocks body token fallback", async () => {
    const productionEnv = {
      NODE_ENV: "production",
      GAMEPLAY_SLICE_SNAPSHOT_SECRET: "test-snapshot-secret",
      GAMEPLAY_SLICE_SESSION_SECRET: "test-session-secret",
      EMPIRE_ALLOWED_ORIGINS: "https://play.empire.test"
    };
    const sessionService = createInMemoryGameplaySessionService({
      productionReady: true,
      ticketTtlMs: 60_000
    });
    const server = createServerApp({
      environment: productionEnv,
      gameplaySessionTokenSecret: productionEnv.GAMEPLAY_SLICE_SESSION_SECRET,
      accountIdentityProvider: createFixedProductionAccountProvider("account:alice"),
      gameplaySessionService: sessionService
    });
    ensureDefaultLobbyServers(server);
    const handler = createGameplaySliceFunctionHandler({
      environment: productionEnv,
      server
    });
    const headers = {
      origin: "https://play.empire.test",
      "x-empire-account-id": "alice"
    };

    const reserve = await readBody(handler(postEvent("/api/matchmaking/reserve", {
      mode: "free",
      preferredServerInstanceId: serverInstanceId
    }, headers)));
    const joinTicket = String(reserve.json.reservation.joinTicket);

    const join = await readBody(handler(postEvent("/api/gameplay-slice/join", {
      joinTicket,
      serverInstanceId,
      preferredStartDistrictId: "district:1",
      factionId: "mafian"
    }, headers)));
    const setCookie = String(join.headers["set-cookie"] ?? "");
    const cookieHeader = toCookieHeader(setCookie);
    const snapshotToken = String(join.json.snapshotToken);
    const serverPlayerId = String(join.json.readModel.player.playerId);
    const bodySessionToken = extractCookieValue(setCookie);

    expect(join.json.accepted).toBe(true);
    expect(join.json.sessionToken ?? null).toBeNull();
    expect(setCookie).toContain("empire_gameplay_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/api/gameplay-slice");

    const cookieLoad = await readBody(handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId,
      playerId: "player:forged-load",
      districtId: "district:1"
    }, {
      cookie: cookieHeader
    })));
    expect(cookieLoad.json.accepted).toBe(true);
    expect(cookieLoad.json.readModel.player.playerId).toBe(serverPlayerId);

    const bodyTokenOnlyLoad = await readBody(handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId,
      playerId: serverPlayerId,
      districtId: "district:1",
      sessionToken: bodySessionToken
    })));
    expect(bodyTokenOnlyLoad.json.accepted).toBe(false);
    expect(bodyTokenOnlyLoad.json.errors[0].code).toBe("SESSION_REQUIRED");

    const invalidOriginSubmit = await readBody(handler(postEvent("/api/gameplay-slice/submit", {
      snapshotToken,
      focusDistrictId: "district:1",
      command: createPlaceTrapCommandFixture({
        playerId: serverPlayerId,
        serverInstanceId
      })
    }, {
      origin: "https://evil.example",
      cookie: cookieHeader
    })));
    expect(invalidOriginSubmit.json.accepted).toBe(false);
    expect(invalidOriginSubmit.json.errors[0].code).toBe("CSRF_ORIGIN_INVALID");

    const forgedSubmit = await readBody(handler(postEvent("/api/gameplay-slice/submit", {
      snapshotToken,
      focusDistrictId: "district:1",
      command: createPlaceTrapCommandFixture({
        playerId: "player:victim",
        serverInstanceId
      })
    }, {
      ...headers,
      cookie: cookieHeader
    })));
    expect(forgedSubmit.json.accepted).toBe(false);
    expect(forgedSubmit.json.errors[0].code).toBe("PLAYER_IDENTITY_MISMATCH");

    const validOriginSubmit = await readBody(handler(postEvent("/api/gameplay-slice/submit", {
      snapshotToken,
      focusDistrictId: "district:1",
      command: createPlaceTrapCommandFixture({
        playerId: serverPlayerId,
        serverInstanceId
      })
    }, {
      ...headers,
      cookie: cookieHeader
    })));
    expect(validOriginSubmit.json.errors.map((error: { code: string }) => error.code)).not.toContain("SESSION_REQUIRED");
    expect(validOriginSubmit.json.errors.map((error: { code: string }) => error.code)).not.toContain("CSRF_ORIGIN_INVALID");

    const snapshotOnlySubmit = await readBody(handler(postEvent("/api/gameplay-slice/submit", {
      snapshotToken,
      focusDistrictId: "district:1",
      command: createPlaceTrapCommandFixture({
        playerId: serverPlayerId,
        serverInstanceId
      })
    }, headers)));
    expect(snapshotOnlySubmit.json.accepted).toBe(false);
    expect(snapshotOnlySubmit.json.errors[0].code).toBe("SESSION_REQUIRED");

    const logout = await readBody(handler(postEvent("/api/gameplay-slice/logout", {}, {
      ...headers,
      cookie: cookieHeader
    })));
    expect(logout.json.accepted).toBe(true);
    expect(String(logout.headers["set-cookie"] ?? "")).toContain("Max-Age=0");

    const revokedLoad = await readBody(handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId,
      playerId: serverPlayerId
    }, {
      cookie: cookieHeader
    })));
    expect(revokedLoad.json.accepted).toBe(false);
    expect(revokedLoad.json.errors[0].code).toBe("SESSION_REVOKED");
  });

  it("keeps body session token fallback outside production", async () => {
    const service = createInMemoryGameplaySessionService({ productionReady: true });
    const ticket = await service.createJoinTicket({
      accountId: "dev:alice",
      serverInstanceId,
      mode: "free",
      nowIso: "2026-06-24T00:00:00.000Z"
    });
    const consumed = await service.consumeJoinTicket({
      ticketId: ticket.ticketId,
      accountId: "dev:alice",
      serverInstanceId,
      nowIso: "2026-06-24T00:00:01.000Z"
    });
    expect(consumed.accepted).toBe(true);
    if (!consumed.accepted) return;
    const session = await service.createSession({
      registration: consumed.registration,
      nowIso: "2026-06-24T00:00:02.000Z",
      ttlMs: 60_000
    });
    const server = createServerApp({
      environment: env,
      gameplaySessionTokenSecret: env.GAMEPLAY_SLICE_SESSION_SECRET,
      accountIdentityProvider: createDevAccountIdentityProvider({ allow: true }),
      gameplaySessionService: service
    });
    const handler = createGameplaySliceFunctionHandler({
      environment: env,
      server
    });
    const token = server.gameplaySessionTokenCodec!.seal({
      sessionId: session.sessionId,
      accountId: session.accountId,
      serverInstanceId,
      playerId: session.playerId,
      factionId: "mafian",
      issuedAt: session.createdAt,
      expiresAt: session.expiresAt,
      version: session.version
    });

    const load = await readBody(handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId,
      playerId: "player:ignored",
      sessionToken: token
    })));

    expect(load.json.errors[0]?.code).not.toBe("SESSION_REQUIRED");
  });

  it("rejects expired tickets and keeps one registration per account/server", async () => {
    const service = createInMemoryGameplaySessionService({ ticketTtlMs: 60_000 });
    const first = await service.createJoinTicket({
      accountId: "account:concurrent",
      serverInstanceId,
      mode: "free",
      nowIso: "2026-06-24T00:00:00.000Z"
    });
    const second = await service.createJoinTicket({
      accountId: "account:concurrent",
      serverInstanceId,
      mode: "free",
      nowIso: "2026-06-24T00:00:00.000Z"
    });
    const expired = await service.createJoinTicket({
      accountId: "account:late",
      serverInstanceId,
      mode: "free",
      nowIso: "2026-06-24T00:00:00.000Z"
    });

    const consumedFirst = await service.consumeJoinTicket({
      ticketId: first.ticketId,
      accountId: "account:concurrent",
      serverInstanceId,
      nowIso: "2026-06-24T00:00:30.000Z"
    });
    const consumedSecond = await service.consumeJoinTicket({
      ticketId: second.ticketId,
      accountId: "account:concurrent",
      serverInstanceId,
      nowIso: "2026-06-24T00:00:31.000Z"
    });
    const consumedExpired = await service.consumeJoinTicket({
      ticketId: expired.ticketId,
      accountId: "account:late",
      serverInstanceId,
      nowIso: "2026-06-24T00:02:00.000Z"
    });

    expect(consumedFirst.accepted).toBe(true);
    expect(consumedSecond.accepted).toBe(true);
    if (consumedFirst.accepted && consumedSecond.accepted) {
      expect(consumedSecond.registration.id).toBe(consumedFirst.registration.id);
      expect(consumedSecond.registration.playerId).toBe(consumedFirst.registration.playerId);
    }
    expect(consumedExpired).toMatchObject({
      accepted: false,
      errors: [{ code: "JOIN_TICKET_EXPIRED" }]
    });
    await expect(service.listRegistrations()).resolves.toHaveLength(1);
  });

  it("runs the persistent service ticket to session flow without using in-memory service", async () => {
    const service = createPersistentGameplaySessionService(createFakeGameplayIdentitySessionRepository(), {
      productionReady: true,
      ticketTtlMs: 60_000
    });

    const ticket = await service.createJoinTicket({
      accountId: "account:persistent",
      serverInstanceId,
      mode: "free",
      nowIso: "2026-06-24T00:00:00.000Z"
    });
    const consumed = await service.consumeJoinTicket({
      ticketId: ticket.ticketId,
      accountId: "account:persistent",
      serverInstanceId,
      nowIso: "2026-06-24T00:00:01.000Z"
    });

    expect(service.productionReady).toBe(true);
    expect(consumed.accepted).toBe(true);
    if (!consumed.accepted) return;

    const session = await service.createSession({
      registration: consumed.registration,
      nowIso: "2026-06-24T00:00:02.000Z",
      ttlMs: 60_000
    });
    const validated = await service.validateSession({
      sessionId: session.sessionId,
      accountId: "account:persistent",
      serverInstanceId,
      nowIso: "2026-06-24T00:00:03.000Z"
    });

    expect(validated).toMatchObject({
      accepted: true,
      session: {
        sessionId: session.sessionId,
        accountId: "account:persistent",
        serverInstanceId
      }
    });
  });
});

const createFakeGameplayIdentitySessionRepository = (): GameplayIdentitySessionRepository => {
  const tickets = new Map<string, JoinTicketRecord>();
  const registrationsById = new Map<string, PlayerRegistrationRecord>();
  const registrationIdByAccountServer = new Map<string, string>();
  const sessions = new Map<string, GameplaySessionRecord>();

  const getOrCreateRegistration = async (input: {
    accountId: string;
    serverInstanceId: string;
    nowIso: string;
  }): Promise<PlayerRegistrationRecord> => {
    const key = `${input.serverInstanceId}:${input.accountId}`;
    const existingId = registrationIdByAccountServer.get(key);
    if (existingId) return registrationsById.get(existingId)!;
    const registration: PlayerRegistrationRecord = {
      id: `registration:${registrationsById.size + 1}`,
      accountId: input.accountId,
      serverInstanceId: input.serverInstanceId,
      playerId: `player:${registrationsById.size + 1}`,
      status: "active",
      createdAt: input.nowIso,
      version: 1
    };
    registrationsById.set(registration.id, registration);
    registrationIdByAccountServer.set(key, registration.id);
    return registration;
  };

  return {
    createJoinTicket: async (ticket) => {
      tickets.set(ticket.ticketId, ticket);
      return ticket;
    },
    consumeJoinTicket: async (input) => {
      const ticket = tickets.get(input.ticketId);
      if (
        !ticket ||
        ticket.accountId !== input.accountId ||
        ticket.serverInstanceId !== input.serverInstanceId ||
        ticket.consumedAt ||
        Date.parse(ticket.expiresAt) <= Date.parse(input.consumedAt)
      ) {
        return null;
      }
      ticket.consumedAt = input.consumedAt;
      const registration = await getOrCreateRegistration({
        accountId: input.accountId,
        serverInstanceId: input.serverInstanceId,
        nowIso: input.consumedAt
      });
      return { ticket, registration };
    },
    getOrCreateRegistration,
    createSession: async (session) => {
      sessions.set(session.sessionId, session);
      return session;
    },
    getSessionById: async (sessionId) => sessions.get(sessionId) ?? null,
    touchSession: async (sessionId, lastSeenAt) => {
      const session = sessions.get(sessionId);
      if (!session || session.revokedAt || Date.parse(session.expiresAt) <= Date.parse(lastSeenAt)) {
        return null;
      }
      const touched = {
        ...session,
        lastSeenAt,
        version: session.version + 1
      };
      sessions.set(sessionId, touched);
      return touched;
    },
    revokeSession: async (sessionId, revokedAt) => {
      const session = sessions.get(sessionId);
      if (!session || session.revokedAt) return false;
      sessions.set(sessionId, {
        ...session,
        revokedAt,
        version: session.version + 1
      });
      return true;
    },
    revokePlayerSessions: async (playerId, revokedAt) => {
      let count = 0;
      for (const session of sessions.values()) {
        if (session.playerId === playerId && !session.revokedAt) {
          sessions.set(session.sessionId, {
            ...session,
            revokedAt,
            version: session.version + 1
          });
          count += 1;
        }
      }
      return count;
    },
    listRegistrations: async () => [...registrationsById.values()]
  };
};

const createFixedProductionAccountProvider = (accountId: string): AccountIdentityProvider => ({
  productionReady: true,
  resolve: () => ({ accountId, provider: "production" })
});

const toCookieHeader = (setCookie: string): string =>
  setCookie.split(";")[0] ?? "";

const extractCookieValue = (setCookie: string): string =>
  toCookieHeader(setCookie).split("=").slice(1).join("=");
