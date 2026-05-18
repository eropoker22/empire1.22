import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";
import { createGameplaySessionTokenCodec } from "../../apps/server/src/transport";

const postEvent = (path: string, body: unknown) => ({
  httpMethod: "POST",
  path,
  body: JSON.stringify(body)
});

type GameplaySliceFunctionHandler = ReturnType<typeof createGameplaySliceFunctionHandler>;

const readBody = async (responsePromise: ReturnType<GameplaySliceFunctionHandler>) => {
  const response = await responsePromise;
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null
  };
};

describe("gameplay slice Netlify function", () => {
  it("allows the explicit dev/test snapshot secret fallback outside production", async () => {
    const handler = createTestHandler({
      NODE_ENV: "test"
    });
    const load = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-dev-secret-fallback",
          playerId: "player:function-dev-secret-fallback",
          districtId: "district:function-dev-secret-fallback"
        })
      )
    );

    expect(load.statusCode).toBe(200);
    expect(load.json.accepted).toBe(true);
    expect(load.json.snapshotToken).toEqual(expect.any(String));
    expect(load.json.sessionToken).toEqual(expect.any(String));
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

  it("rejects unknown production loads by default even when the snapshot secret is configured", async () => {
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

    expect(load.statusCode).toBe(200);
    expect(load.json.accepted).toBe(false);
    expect(load.json.errors[0].code).toBe("server.instance_not_found");
  });

  it("can explicitly allow implicit production loads for compatibility tests", async () => {
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

    expect(load.statusCode).toBe(200);
    expect(load.json.accepted).toBe(true);
    expect(load.json.snapshotToken).toEqual(expect.any(String));
    expect(load.json.sessionToken).toEqual(expect.any(String));
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
        industrialDistricts: 35,
        residentialDistricts: 48,
        parkDistricts: 30
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

  it("loads and submits the first gameplay slice through cold HTTP adapters", async () => {
    const loadHandler = createTestHandler();
    const load = await readBody(
      loadHandler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-slice",
          playerId: "player:function-slice",
          districtId: "district:31"
        })
      )
    );

    expect(load.statusCode).toBe(200);
    const focusDistrictId = load.json.readModel.district.districtId;
    expect(focusDistrictId).toBe("district:spawn:1");
    expect(load.json.snapshotToken).toEqual(expect.any(String));
    expect(load.json.sessionToken).toEqual(expect.any(String));

    const building = load.json.readModel.district.buildings.find(
      (candidate: { actions: unknown[] }) => candidate.actions.length > 0
    );
    const action = building.actions[0];
    const command = {
      id: "command:function:building-action:1",
      type: "run-building-action",
      mode: load.json.readModel.mode.mode,
      playerId: "player:function-slice",
      serverInstanceId: "instance:function-slice",
      issuedAt: new Date(0).toISOString(),
      payload: {
        districtId: focusDistrictId,
        buildingId: building.buildingId,
        actionId: action.actionId
      },
      clientRequestId: null
    };
    const submitHandler = createTestHandler();
    const submit = await readBody(
      submitHandler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: load.json.snapshotToken,
          sessionToken: load.json.sessionToken,
          focusDistrictId,
          command
        })
      )
    );

    expect(submit.statusCode).toBe(200);
    expect(submit.json.accepted).toBe(true);
    expect(submit.json.readModel.reports[0].reportType).toBe("building-action");
    expect(submit.json.snapshotToken).toEqual(expect.any(String));
    expect(submit.json.sessionToken).toEqual(expect.any(String));

    const duplicateHandler = createTestHandler();
    const duplicate = await readBody(
      duplicateHandler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: submit.json.snapshotToken,
          sessionToken: submit.json.sessionToken,
          focusDistrictId,
          command
        })
      )
    );

    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json.accepted).toBe(false);
    expect(duplicate.json.errors[0].code).toBe("server.duplicate_command");
  });

  it("passes unknown command types with a valid envelope to the unsupported-command path", async () => {
    const handler = createTestHandler();
    const load = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:free-function-unknown-command",
          playerId: "player:function-unknown-command",
          districtId: "district:function-unknown-command"
        })
      )
    );
    const focusDistrictId = load.json.readModel.district.districtId;
    const submit = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: load.json.snapshotToken,
          sessionToken: load.json.sessionToken,
          focusDistrictId,
          command: {
            id: "command:function:unknown:1",
            type: "unknown-command-type",
            mode: "free",
            playerId: "player:function-unknown-command",
            serverInstanceId: "instance:free-function-unknown-command",
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
    const loadHandler = createTestHandler();
    const load = await readBody(
      loadHandler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-faction-snapshot",
          playerId: "player:function-faction-snapshot",
          districtId: "district:44",
          factionId: "kartel"
        })
      )
    );

    expect(load.statusCode).toBe(200);
    expect(load.json.readModel.player.factionId).toBe("kartel");
    const focusDistrictId = load.json.readModel.district.districtId;

    const building = load.json.readModel.district.buildings.find(
      (candidate: { actions: unknown[] }) => candidate.actions.length > 0
    );
    const action = building.actions[0];
    const command = {
      id: "command:function:faction-snapshot-submit:1",
      type: "run-building-action",
      mode: load.json.readModel.mode.mode,
      playerId: "player:function-faction-snapshot",
      serverInstanceId: "instance:function-faction-snapshot",
      issuedAt: new Date(0).toISOString(),
      payload: {
        districtId: focusDistrictId,
        buildingId: building.buildingId,
        actionId: action.actionId
      },
      clientRequestId: null
    };
    const submitHandler = createTestHandler();
    const submit = await readBody(
      submitHandler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: load.json.snapshotToken,
          sessionToken: load.json.sessionToken,
          focusDistrictId,
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
    const load = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-submit-without-session-token",
          playerId: "player:function-submit-without-session-token",
          districtId: "district:55"
        })
      )
    );
    const focusDistrictId = load.json.readModel.district.districtId;
    const building = load.json.readModel.district.buildings.find(
      (candidate: { actions: unknown[] }) => candidate.actions.length > 0
    );
    const action = building.actions[0];

    const submit = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: load.json.snapshotToken,
          focusDistrictId,
          command: {
            id: "command:function:submit-without-session-token:1",
            type: "run-building-action",
            mode: "free",
            playerId: "player:function-submit-without-session-token",
            serverInstanceId: "instance:function-submit-without-session-token",
            issuedAt: new Date(0).toISOString(),
            payload: {
              districtId: focusDistrictId,
              buildingId: building.buildingId,
              actionId: action.actionId
            },
            clientRequestId: null
          }
        })
      )
    );

    expect(submit.statusCode).toBe(200);
    expect(submit.json).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "transport.session_token_missing"
        }
      ]
    });
  });

  it("rejects submit when the gameplay session token belongs to another player or instance", async () => {
    const handler = createTestHandler();
    const load = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-session-identity",
          playerId: "player:function-session-owner",
          districtId: "district:56"
        })
      )
    );

    const wrongPlayer = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: load.json.snapshotToken,
          sessionToken: load.json.sessionToken,
          focusDistrictId: load.json.readModel.district.districtId,
          command: {
            id: "command:function:session-wrong-player:1",
            type: "unknown-command-type",
            mode: "free",
            playerId: "player:function-session-attacker",
            serverInstanceId: "instance:function-session-identity",
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
          snapshotToken: load.json.snapshotToken,
          sessionToken: load.json.sessionToken,
          focusDistrictId: load.json.readModel.district.districtId,
          command: {
            id: "command:function:session-wrong-instance:1",
            type: "unknown-command-type",
            mode: "free",
            playerId: "player:function-session-owner",
            serverInstanceId: "instance:function-session-other",
            issuedAt: new Date(0).toISOString(),
            payload: {},
            clientRequestId: null
          }
        })
      )
    );

    expect(wrongPlayer.json.errors[0].code).toBe("transport.session_identity_mismatch");
    expect(wrongPlayer.json.readModel).toBeNull();
    expect(wrongInstance.json.errors[0].code).toBe("transport.session_identity_mismatch");
    expect(wrongInstance.json.readModel).toBeNull();
  });

  it("rejects tampered gameplay session tokens", async () => {
    const handler = createTestHandler();
    const load = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-session-tamper",
          playerId: "player:function-session-tamper",
          districtId: "district:57"
        })
      )
    );
    const token = String(load.json.sessionToken);
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith("x") ? "y" : "x"}`;

    const submit = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: load.json.snapshotToken,
          sessionToken: tamperedToken,
          focusDistrictId: load.json.readModel.district.districtId,
          command: {
            id: "command:function:session-tamper:1",
            type: "unknown-command-type",
            mode: "free",
            playerId: "player:function-session-tamper",
            serverInstanceId: "instance:function-session-tamper",
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
          code: "transport.session_token_invalid"
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
    const load = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-session-expired",
          playerId: "player:function-session-expired",
          districtId: "district:58"
        })
      )
    );
    const expiredToken = createGameplaySessionTokenCodec({ secret }).seal({
      serverInstanceId: "instance:function-session-expired",
      playerId: "player:function-session-expired",
      issuedAt: "2020-01-01T00:00:00.000Z",
      expiresAt: "2020-01-01T00:00:01.000Z"
    });

    const submit = await readBody(
      handler(
        postEvent("/api/gameplay-slice/submit", {
          snapshotToken: load.json.snapshotToken,
          sessionToken: expiredToken,
          focusDistrictId: load.json.readModel.district.districtId,
          command: {
            id: "command:function:session-expired:1",
            type: "unknown-command-type",
            mode: "free",
            playerId: "player:function-session-expired",
            serverInstanceId: "instance:function-session-expired",
            issuedAt: new Date(0).toISOString(),
            payload: {},
            clientRequestId: null
          }
        })
      )
    );

    expect(submit.json.errors[0].code).toBe("transport.session_token_invalid");
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
    expect(submit.json.errors[0].code).toBe("transport.session_token_missing");
  });

  it("rejects the 21st free mode player with a domain error", async () => {
    const handler = createTestHandler();

    for (let index = 1; index <= 20; index += 1) {
      const load = await readBody(
        handler(
          postEvent("/api/gameplay-slice/load", {
            serverInstanceId: "instance:function-free-capacity",
            playerId: `player:function-capacity:${index}`,
            districtId: `district:${2000 + index * 10}`
          })
        )
      );

      expect(load.statusCode).toBe(200);
      expect(load.json.accepted).toBe(true);
    }

    const rejected = await readBody(
      handler(
        postEvent("/api/gameplay-slice/load", {
          serverInstanceId: "instance:function-free-capacity",
          playerId: "player:function-capacity:21",
          districtId: "district:2210"
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
  } = {}
) => createGameplaySliceFunctionHandler({
  cryptoProvider: () => webcrypto,
  environment,
  allowImplicitInstanceCreation: options.allowImplicitInstanceCreation
});
