import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { createServerApp, type ServerApp } from "../../apps/server/src/app";
import { enabledSharedCitySpawnDistrictIds } from "../../apps/server/src/bootstrap/gameplay-slice-spawn-pool";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";
import { createGameplaySessionTokenCodec } from "../../apps/server/src/transport";

const PUBLIC_FREE_SERVER_INSTANCE_ID = "instance:free:eu-central:public-1";
const DEFAULT_SPAWN_DISTRICT_ID = enabledSharedCitySpawnDistrictIds[0]!;

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

type GameplaySliceFunctionHandler = ReturnType<typeof createGameplaySliceFunctionHandler>;

const readBody = async (responsePromise: ReturnType<GameplaySliceFunctionHandler>) => {
  const response = await responsePromise;
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null
  };
};

const joinPublicFreeSession = async (
  handler: GameplaySliceFunctionHandler,
  input: {
    accountId: string;
    preferredStartDistrictId?: string;
    factionId?: string;
  }
) => {
  const preferredStartDistrictId = input.preferredStartDistrictId ?? DEFAULT_SPAWN_DISTRICT_ID;
  const reserve = await readBody(
    handler(
      postEvent("/api/matchmaking/reserve", {
        accountId: input.accountId,
        mode: "free",
        preferredServerInstanceId: PUBLIC_FREE_SERVER_INSTANCE_ID
      })
    )
  );
  expect(reserve.statusCode).toBe(200);
  if (!reserve.json.accepted) {
    throw new Error(`Expected matchmaking reserve to be accepted: ${JSON.stringify(reserve.json.errors)}`);
  }

  const join = await readBody(
    handler(
      postEvent("/api/gameplay-slice/join", {
        accountId: input.accountId,
        joinTicket: reserve.json.reservation.joinTicket,
        serverInstanceId: PUBLIC_FREE_SERVER_INSTANCE_ID,
        preferredStartDistrictId,
        factionId: input.factionId ?? "mafian"
      })
    )
  );
  expect(join.statusCode).toBe(200);
  if (!join.json.accepted) {
    throw new Error(`Expected gameplay join to be accepted: ${JSON.stringify(join.json.errors)}`);
  }

  return {
    reserve,
    join,
    accountId: input.accountId,
    serverInstanceId: PUBLIC_FREE_SERVER_INSTANCE_ID,
    playerId: String(join.json.readModel.player.playerId),
    sessionToken: String(join.json.sessionToken),
    snapshotToken: String(join.json.snapshotToken),
    focusDistrictId: preferredStartDistrictId,
    readModel: join.json.readModel
  };
};

const selectSpawnDistrict = async (
  handler: GameplaySliceFunctionHandler,
  session: Awaited<ReturnType<typeof joinPublicFreeSession>>,
  commandId: string
) => {
  const response = await readBody(
    handler(
      postEvent("/api/gameplay-slice/submit", {
        snapshotToken: session.snapshotToken,
        sessionToken: session.sessionToken,
        focusDistrictId: session.focusDistrictId,
        command: {
          id: commandId,
          type: "select-spawn-district",
          mode: "free",
          playerId: session.playerId,
          serverInstanceId: session.serverInstanceId,
          issuedAt: new Date(0).toISOString(),
          payload: {
            districtId: session.focusDistrictId
          },
          clientRequestId: null
        }
      })
    )
  );
  expect(response.statusCode).toBe(200);
  if (!response.json.accepted) {
    throw new Error(`Expected spawn selection to be accepted: ${JSON.stringify(response.json.errors)}`);
  }
  return {
    ...session,
    snapshotToken: String(response.json.snapshotToken),
    sessionToken: String(response.json.sessionToken ?? session.sessionToken),
    readModel: response.json.readModel
  };
};

const createPlaceTrapBody = (
  session: Pick<Awaited<ReturnType<typeof joinPublicFreeSession>>, "playerId" | "serverInstanceId" | "focusDistrictId">,
  commandId: string
) => ({
  id: commandId,
  type: "place-trap",
  mode: "free",
  playerId: session.playerId,
  serverInstanceId: session.serverInstanceId,
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: session.focusDistrictId
  },
  clientRequestId: null
});

describe("gameplay slice Netlify function", () => {
  it("allows the explicit dev/test snapshot secret fallback outside production", async () => {
    const handler = createTestHandler({
      NODE_ENV: "test"
    });
    const session = await joinPublicFreeSession(handler, {
      accountId: "function-dev-secret-fallback"
    });

    expect(session.join.statusCode).toBe(200);
    expect(session.join.json.accepted).toBe(true);
    expect(session.join.json.snapshotToken).toEqual(expect.any(String));
    expect(session.join.json.sessionToken).toEqual(expect.any(String));
  });

  it("rejects production requests when the snapshot secret is missing", async () => {
    const handler = createTestHandler({
      NODE_ENV: "production",
      GAMEPLAY_SLICE_SNAPSHOT_SECRET: undefined
    });
    const load = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-missing-production-secret",
          playerId: "player:function-missing-production-secret",
          districtId: "district:function-missing-production-secret"
        })
      )
    );

    expect(load.statusCode).toBe(500);
    expect(load.json).toEqual({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "transport.snapshot_secret_unavailable",
          message: "Snapshot service is not configured."
        }
      ]
    });
  });

  it("rejects production loads by default when the gameplay session runtime is not production-ready", async () => {
    const handler = createTestHandler({
      NODE_ENV: "production",
      GAMEPLAY_SLICE_SNAPSHOT_SECRET: "test-production-snapshot-secret"
    });
    const load = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-production-secret",
          playerId: "player:function-production-secret",
          districtId: "district:function-production-secret"
        })
      )
    );

    expect(load.statusCode).toBe(500);
    expect(load.json.accepted).toBe(false);
    expect(load.json.errors[0].code).toBe("SESSION_INVALID");
  });

  it("keeps production fail-closed even if implicit instance creation is enabled for a test handler", async () => {
    const handler = createTestHandler({
      NODE_ENV: "production",
      GAMEPLAY_SLICE_SNAPSHOT_SECRET: "test-production-snapshot-secret"
    }, {
      allowImplicitInstanceCreation: true
    });
    const load = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-production-secret-explicit-implicit",
          playerId: "player:function-production-secret-explicit-implicit",
          districtId: "district:function-production-secret-explicit-implicit"
        })
      )
    );

    expect(load.statusCode).toBe(500);
    expect(load.json.accepted).toBe(false);
    expect(load.json.errors[0].code).toBe("SESSION_INVALID");
  });

  it("uses an explicit gameplay session secret separately from the snapshot secret", async () => {
    const handler = createTestHandler({
      NODE_ENV: "test",
      GAMEPLAY_SLICE_SNAPSHOT_SECRET: "test-production-snapshot-secret",
      GAMEPLAY_SLICE_SESSION_SECRET: "test-production-session-secret"
    });
    const joined = await joinPublicFreeSession(handler, {
      accountId: "function-production-session-secret"
    });
    const spawned = await selectSpawnDistrict(
      handler,
      joined,
      "command:function:wrong-session-secret:spawn"
    );
    const wrongSecretToken = createGameplaySessionTokenCodec({
      secret: "test-production-snapshot-secret"
    }).seal({
      serverInstanceId: spawned.serverInstanceId,
      playerId: spawned.playerId,
      issuedAt: "2026-05-21T00:00:00.000Z",
      expiresAt: "2099-05-21T00:00:00.000Z"
    });

    const submit = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: spawned.snapshotToken,
          sessionToken: wrongSecretToken,
          focusDistrictId: spawned.focusDistrictId,
          command: {
            id: "command:function:wrong-session-secret:1",
            type: "unknown-command-type",
            mode: "free",
            playerId: spawned.playerId,
            serverInstanceId: spawned.serverInstanceId,
            issuedAt: new Date(0).toISOString(),
            payload: {},
            clientRequestId: null
          }
        })
      )
    );

    expect(joined.join.statusCode).toBe(200);
    expect(joined.join.json.sessionToken).toEqual(expect.any(String));
    expect(submit.json.errors[0].code).toBe("SESSION_INVALID");
  });

  it("returns lobby-safe server summaries with map composition", async () => {
    const handler = createTestHandler();
    const response = await readBody(
      handler({
        httpMethod: "GET",
        path: "/api/servers",
        body: null
      })
    );

    expect(response.statusCode).toBe(200);
    expect(response.json.accepted).toBe(true);
    expect(response.json.servers).toContainEqual(expect.objectContaining({
      serverInstanceId: "instance:free:eu-central:public-1",
      displayName: "Neon Docks FREE-01",
      mode: "free",
      joinable: true,
      map: {
        totalDistricts: 161,
        downtownDistricts: 8,
        commercialDistricts: 40,
        industrialDistricts: 38,
        residentialDistricts: 38,
        parkDistricts: 37
      }
    }));
  });

  it("rejects invalid load and submit shapes without crashing", async () => {
    const handler = createTestHandler();
    const missingInstanceId = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          playerId: "player:function-invalid-load",
          districtId: "district:invalid-load"
        })
      )
    );

    expect(missingInstanceId.statusCode).toBe(200);
    expect(missingInstanceId.json).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "transport.invalid_request",
          details: {
            field: "serverInstanceId"
          }
        }
      ]
    });

    const missingCommand = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          focusDistrictId: "district:invalid-submit"
        })
      )
    );

    expect(missingCommand.statusCode).toBe(200);
    expect(missingCommand.json).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "transport.invalid_request",
          details: {
            field: "command"
          }
        }
      ]
    });
  });

  it("returns consistent transport errors for malformed serverless requests", async () => {
    const handler = createTestHandler();

    const unknownRoute = await readBody(
      handler({
        httpMethod: "POST",
        path: "/api/gameplay-slice/unknown",
        body: "{}"
      })
    );
    const invalidJson = await readBody(
      handler({
        httpMethod: "POST",
        path: "/api/gameplay-slice/load",
        body: "{"
      })
    );
    const oversized = await readBody(
      handler({
        httpMethod: "POST",
        path: "/api/gameplay-slice/load",
        body: JSON.stringify({ padding: "x".repeat(600 * 1024) })
      })
    );

    expect(unknownRoute.statusCode).toBe(404);
    expect(unknownRoute.json.errors[0].code).toBe("transport.not_found");
    expect(invalidJson.statusCode).toBe(400);
    expect(invalidJson.json.errors[0].code).toBe("transport.invalid_json");
    expect(oversized.statusCode).toBe(413);
    expect(oversized.json.errors[0].code).toBe("transport.request_body_too_large");
  });

  it("rejects invalid snapshot tokens without leaking token details", async () => {
    const handler = createTestHandler();
    const load = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-invalid-snapshot-token",
          playerId: "player:function-invalid-snapshot-token",
          districtId: "district:function-invalid-snapshot-token",
          snapshotToken: "v1.invalid.invalid"
        })
      )
    );

    expect(load.statusCode).toBe(200);
    expect(load.json).toEqual({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "transport.snapshot_token_invalid",
          message: "Snapshot token is invalid."
        }
      ]
    });
  });

  it("loads and submits the first gameplay slice through the HTTP adapters", async () => {
    const handler = createTestHandler();
    const joined = await joinPublicFreeSession(handler, {
      accountId: "function-slice"
    });
    const spawned = await selectSpawnDistrict(handler, joined, "command:function:spawn:1");
    const command = createPlaceTrapBody(spawned, "command:function:place-trap:1");
    const submit = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: spawned.snapshotToken,
          sessionToken: spawned.sessionToken,
          focusDistrictId: spawned.focusDistrictId,
          command
        })
      )
    );

    expect(submit.statusCode).toBe(200);
    expect(submit.json.accepted).toBe(true);
    expect(submit.json.readModel).not.toBeNull();
    expect(submit.json.snapshotToken).toEqual(expect.any(String));

    const duplicate = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: submit.json.snapshotToken,
          sessionToken: spawned.sessionToken,
          focusDistrictId: spawned.focusDistrictId,
          command
        })
      )
    );

    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json.accepted).toBe(true);
    expect(duplicate.json.errors).toEqual([]);
  });

  it("passes unknown command types with a valid envelope to the unsupported-command path", async () => {
    const handler = createTestHandler();
    const joined = await joinPublicFreeSession(handler, {
      accountId: "function-unknown-command"
    });
    const spawned = await selectSpawnDistrict(handler, joined, "command:function:unknown:spawn");
    const submit = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: spawned.snapshotToken,
          sessionToken: spawned.sessionToken,
          focusDistrictId: spawned.focusDistrictId,
          command: {
            id: "command:function:unknown:1",
            type: "unknown-command-type",
            mode: "free",
            playerId: spawned.playerId,
            serverInstanceId: spawned.serverInstanceId,
            issuedAt: new Date(0).toISOString(),
            payload: {},
            clientRequestId: null
          }
        })
      )
    );

    expect(submit.statusCode).toBe(200);
    expect(submit.json.accepted).toBe(false);
    expect(submit.json.readModel).not.toBeNull();
    expect(submit.json.errors[0].code).toBe("unsupported_command");
  });

  it("preserves factionId through cold snapshot submit flow", async () => {
    const handler = createTestHandler();
    const joined = await joinPublicFreeSession(handler, {
      accountId: "function-faction-snapshot",
      factionId: "kartel"
    });
    const spawned = await selectSpawnDistrict(
      handler,
      joined,
      "command:function:faction-snapshot:spawn"
    );
    expect(spawned.readModel.player.factionId).toBe("kartel");
    const command = createPlaceTrapBody(spawned, "command:function:faction-snapshot-submit:1");
    const submit = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: spawned.snapshotToken,
          sessionToken: spawned.sessionToken,
          focusDistrictId: spawned.focusDistrictId,
          command
        })
      )
    );

    expect(submit.statusCode).toBe(200);
    expect(submit.json.accepted).toBe(true);
    expect(submit.json.readModel.player.factionId).toBe("kartel");
  });

  it("rejects submit without a gameplay session token before command handling", async () => {
    const handler = createTestHandler();
    const joined = await joinPublicFreeSession(handler, {
      accountId: "function-submit-without-session-token"
    });
    const spawned = await selectSpawnDistrict(
      handler,
      joined,
      "command:function:submit-without-session-token:spawn"
    );

    const submit = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: spawned.snapshotToken,
          focusDistrictId: spawned.focusDistrictId,
          command: createPlaceTrapBody(spawned, "command:function:submit-without-session-token:1")
        })
      )
    );

    expect(submit.statusCode).toBe(200);
    expect(submit.json).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "SESSION_REQUIRED"
        }
      ]
    });
  });

  it("rejects submit when the gameplay session token belongs to another player or instance", async () => {
    const handler = createTestHandler();
    const joined = await joinPublicFreeSession(handler, {
      accountId: "function-session-owner"
    });
    const spawned = await selectSpawnDistrict(handler, joined, "command:function:session-identity:spawn");

    const wrongPlayer = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: spawned.snapshotToken,
          sessionToken: spawned.sessionToken,
          focusDistrictId: spawned.focusDistrictId,
          command: {
            id: "command:function:session-wrong-player:1",
            type: "unknown-command-type",
            mode: "free",
            playerId: "player:function-session-attacker",
            serverInstanceId: spawned.serverInstanceId,
            issuedAt: new Date(0).toISOString(),
            payload: {},
            clientRequestId: null
          }
        })
      )
    );

    const wrongInstance = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          sessionToken: spawned.sessionToken,
          focusDistrictId: spawned.focusDistrictId,
          command: {
            id: "command:function:session-wrong-instance:1",
            type: "unknown-command-type",
            mode: "free",
            playerId: spawned.playerId,
            serverInstanceId: "instance:function-session-other",
            issuedAt: new Date(0).toISOString(),
            payload: {},
            clientRequestId: null
          }
        })
      )
    );

    expect(wrongPlayer.json.errors[0].code).toBe("PLAYER_IDENTITY_MISMATCH");
    expect(wrongPlayer.json.readModel).toBeNull();
    expect(wrongInstance.json.errors[0].code).toBe("PLAYER_IDENTITY_MISMATCH");
    expect(wrongInstance.json.readModel).toBeNull();
  });

  it("rejects tampered gameplay session tokens", async () => {
    const handler = createTestHandler();
    const joined = await joinPublicFreeSession(handler, {
      accountId: "function-session-tamper"
    });
    const spawned = await selectSpawnDistrict(handler, joined, "command:function:session-tamper:spawn");
    const token = spawned.sessionToken;
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith("x") ? "y" : "x"}`;

    const submit = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: spawned.snapshotToken,
          sessionToken: tamperedToken,
          focusDistrictId: spawned.focusDistrictId,
          command: {
            id: "command:function:session-tamper:1",
            type: "unknown-command-type",
            mode: "free",
            playerId: spawned.playerId,
            serverInstanceId: spawned.serverInstanceId,
            issuedAt: new Date(0).toISOString(),
            payload: {},
            clientRequestId: null
          }
        })
      )
    );

    expect(submit.json).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "SESSION_INVALID"
        }
      ]
    });
  });

  it("rejects expired gameplay session tokens", async () => {
    const secret = "test-expired-session-secret";
    const handler = createTestHandler({
      NODE_ENV: "test",
      GAMEPLAY_SLICE_SNAPSHOT_SECRET: secret
    });
    const joined = await joinPublicFreeSession(handler, {
      accountId: "function-session-expired"
    });
    const spawned = await selectSpawnDistrict(handler, joined, "command:function:session-expired:spawn");
    const expiredToken = createGameplaySessionTokenCodec({ secret }).seal({
      serverInstanceId: spawned.serverInstanceId,
      playerId: spawned.playerId,
      issuedAt: "2020-01-01T00:00:00.000Z",
      expiresAt: "2020-01-01T00:00:01.000Z"
    });

    const submit = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: spawned.snapshotToken,
          sessionToken: expiredToken,
          focusDistrictId: spawned.focusDistrictId,
          command: {
            id: "command:function:session-expired:1",
            type: "unknown-command-type",
            mode: "free",
            playerId: spawned.playerId,
            serverInstanceId: spawned.serverInstanceId,
            issuedAt: new Date(0).toISOString(),
            payload: {},
            clientRequestId: null
          }
        })
      )
    );

    expect(submit.json.errors[0].code).toBe("SESSION_INVALID");
    expect(submit.json.readModel).toBeNull();
  });

  it("rejects cold submit without snapshot instead of silently creating mafian fallback", async () => {
    const submitHandler = createTestHandler();
    const submit = await readBody(
      submitHandler(
        postEvent("/api/gameplay-slice/submit", {
          focusDistrictId: "district:55",
          command: {
            id: "command:function:cold-submit-without-snapshot:1",
            type: "collect-production",
            mode: "free",
            playerId: "player:cold-submit-without-snapshot",
            serverInstanceId: "instance:function-cold-submit-without-snapshot",
            issuedAt: new Date(0).toISOString(),
            payload: {
              districtId: "district:55",
              buildingId: "building:district:55:factory:1"
            },
            clientRequestId: null
          }
        })
      )
    );

    expect(submit.statusCode).toBe(200);
    expect(submit.json.accepted).toBe(false);
    expect(submit.json.readModel).toBeNull();
    expect(submit.json.errors[0].code).toBe("SESSION_REQUIRED");
  });

  it("rejects the 21st free mode player with a domain error", async () => {
    const environment = {
      NODE_ENV: "test",
      GAMEPLAY_SLICE_SNAPSHOT_SECRET: "test-capacity-snapshot-secret",
      GAMEPLAY_SLICE_SESSION_SECRET: "test-capacity-session-secret"
    };
    const server = createServerApp({ environment });
    const handler = createTestHandler(environment, { server });

    for (let index = 1; index <= 20; index += 1) {
      const accountId = `dev:function-capacity:${index}`;
      const ticket = await server.gameplaySessionService.createJoinTicket({
        accountId,
        serverInstanceId: PUBLIC_FREE_SERVER_INSTANCE_ID,
        mode: "free",
        nowIso: new Date().toISOString()
      });
      const join = await readBody(
        handler(
          postEvent("/api/gameplay-slice/join", {
            accountId: `function-capacity:${index}`,
            joinTicket: ticket.ticketId,
            serverInstanceId: PUBLIC_FREE_SERVER_INSTANCE_ID,
            preferredStartDistrictId: DEFAULT_SPAWN_DISTRICT_ID
          })
        )
      );

      expect(join.statusCode).toBe(200);
      if (!join.json.accepted) {
        throw new Error(`Expected capacity join ${index} to be accepted: ${JSON.stringify(join.json.errors)}`);
      }
    }

    const rejectedTicket = await server.gameplaySessionService.createJoinTicket({
      accountId: "dev:function-capacity:21",
      serverInstanceId: PUBLIC_FREE_SERVER_INSTANCE_ID,
      mode: "free",
      nowIso: new Date().toISOString()
    });
    const rejected = await readBody(
      handler(
        postEvent("/api/gameplay-slice/join", {
          accountId: "function-capacity:21",
          joinTicket: rejectedTicket.ticketId,
          serverInstanceId: PUBLIC_FREE_SERVER_INSTANCE_ID,
          preferredStartDistrictId: DEFAULT_SPAWN_DISTRICT_ID
        })
      )
    );

    expect(rejected.statusCode).toBe(200);
    expect(rejected.json).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "server.player_cap_reached",
          details: {
            currentPlayerCount: 20,
            maxPlayersPerServer: 20
          }
        }
      ]
    });
  }, 10000);
});

const createTestHandler = (
  environment?: Record<string, string | undefined>,
  options: {
    allowImplicitInstanceCreation?: boolean;
    server?: ServerApp;
  } = {}
) => createGameplaySliceFunctionHandler({
  cryptoProvider: () => webcrypto,
  environment,
  allowImplicitInstanceCreation: options.allowImplicitInstanceCreation,
  server: options.server
});
