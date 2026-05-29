import { describe, expect, it } from "vitest";
import { createGameplaySliceJsonHandler } from "../../apps/server/src/transport";

describe("gameplay slice json handler", () => {
  it("routes load and submit requests to the gameplay slice transport", async () => {
    const calls: string[] = [];
    const handler = createGameplaySliceJsonHandler({
      load: (request) => {
        calls.push(`load:${request.districtId}`);
        return {
          accepted: true,
          readModel: null,
          errors: []
        };
      },
      submit: async (request) => {
        calls.push(`submit:${request.focusDistrictId}:${request.command.type}`);
        return {
          accepted: true,
          readModel: null,
          errors: []
        };
      }
    });

    expect((
      await handler.handle({
        method: "POST",
        path: "/api/gameplay-slice/load",
        body: {
          serverInstanceId: "instance:1",
          playerId: "player:1",
          districtId: "district:1"
        }
      })
    ).status
    ).toBe(200);
    expect((
      await handler.handle({
        method: "POST",
        path: "/api/gameplay-slice/submit",
        body: {
          focusDistrictId: "district:1",
          command: {
            id: "command:json-handler:1",
            type: "place-trap",
            mode: "free",
            playerId: "player:1",
            serverInstanceId: "instance:1",
            issuedAt: new Date(0).toISOString(),
            payload: {
              districtId: "district:1"
            }
          }
        }
      })
    ).status
    ).toBe(200);

    expect(calls).toEqual([
      "load:district:1",
      "submit:district:1:place-trap"
    ]);
  });

  it("returns transport-safe errors for unsupported routes", async () => {
    const handler = createGameplaySliceJsonHandler({
      load: () => {
        throw new Error("unexpected load");
      },
      submit: async () => {
        throw new Error("unexpected submit");
      }
    });

    await expect(handler.handle({ method: "GET", path: "/api/gameplay-slice/load", body: {} })).resolves.toMatchObject({
      status: 405,
      body: {
        accepted: false,
        readModel: null,
        errors: [
          {
            code: "transport.method_not_allowed"
          }
        ]
      }
    });
    await expect(handler.handle({ method: "POST", path: "/api/gameplay-slice/missing", body: {} })).resolves.toMatchObject({
      status: 404,
      body: {
        errors: [
          {
            code: "transport.not_found"
          }
        ]
      }
    });
  });

  it("rejects invalid load and submit request shapes before transport dispatch", async () => {
    const handler = createGameplaySliceJsonHandler({
      load: () => {
        throw new Error("invalid load reached transport");
      },
      submit: async () => {
        throw new Error("invalid submit reached transport");
      }
    });

    await expect(handler.handle({
      method: "POST",
      path: "/api/gameplay-slice/load",
      body: {
        playerId: "player:missing-instance",
        districtId: "district:1"
      }
    })).resolves.toMatchObject({
      status: 200,
      body: {
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
      }
    });

    await expect(handler.handle({
      method: "POST",
      path: "/api/gameplay-slice/submit",
      body: {
        focusDistrictId: "district:1"
      }
    })).resolves.toMatchObject({
      status: 200,
      body: {
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
      }
    });
  });

  it("allows first load without a concrete district and rejects server-assigned focus on submit", async () => {
    const calls: string[] = [];
    const handler = createGameplaySliceJsonHandler({
      load: (request) => {
        calls.push(`load:${request.districtId ?? "server-assigned"}`);
        return {
          accepted: true,
          readModel: null,
          errors: []
        };
      },
      submit: async () => {
        throw new Error("server-assigned submit focus reached transport");
      }
    });

    await expect(handler.handle({
      method: "POST",
      path: "/api/gameplay-slice/load",
      body: {
        serverInstanceId: "instance:1",
        playerId: "player:1"
      }
    })).resolves.toMatchObject({
      status: 200,
      body: {
        accepted: true
      }
    });

    await expect(handler.handle({
      method: "POST",
      path: "/api/gameplay-slice/submit",
      body: {
        focusDistrictId: "district:server-assigned",
        command: {
          id: "command:server-assigned-focus",
          type: "place-trap",
          mode: "free",
          playerId: "player:1",
          serverInstanceId: "instance:1",
          issuedAt: new Date(0).toISOString(),
          payload: {
            districtId: "district:1"
          }
        }
      }
    })).resolves.toMatchObject({
      status: 200,
      body: {
        accepted: false,
        errors: [
          {
            code: "transport.invalid_request",
            details: {
              field: "focusDistrictId"
            }
          }
        ]
      }
    });
    expect(calls).toEqual(["load:server-assigned"]);
  });

  it("rejects invalid preferred start district hint shape before transport dispatch", async () => {
    const handler = createGameplaySliceJsonHandler({
      load: () => {
        throw new Error("invalid load reached transport");
      },
      submit: async () => {
        throw new Error("unexpected submit");
      }
    });

    const response = await handler.handle({
      method: "POST",
      path: "/api/gameplay-slice/load",
      body: {
        serverInstanceId: "instance:1",
        playerId: "player:1",
        districtId: "district:server-assigned",
        preferredStartDistrictId: 27
      }
    });

    expect(response).toMatchObject({
      status: 200,
      body: {
        accepted: false,
        readModel: null,
        errors: [
          {
            code: "transport.invalid_request",
            details: {
              field: "preferredStartDistrictId"
            }
          }
        ]
      }
    });
  });

  it("rejects commands missing required envelope fields before transport dispatch", async () => {
    const handler = createGameplaySliceJsonHandler({
      load: () => {
        throw new Error("unexpected load");
      },
      submit: async () => {
        throw new Error("invalid command reached transport");
      }
    });

    const missingId = await handler.handle({
      method: "POST",
      path: "/api/gameplay-slice/submit",
      body: {
        focusDistrictId: "district:1",
        command: {
          type: "spy-district",
          mode: "free",
          playerId: "player:1",
          serverInstanceId: "instance:1",
          issuedAt: new Date(0).toISOString()
        }
      }
    });

    expect(missingId.body.errors).toContainEqual(expect.objectContaining({
      code: "transport.invalid_request",
      details: {
        field: "command.id"
      }
    }));

    const missingPlayerId = await handler.handle({
      method: "POST",
      path: "/api/gameplay-slice/submit",
      body: {
        focusDistrictId: "district:1",
        command: {
          id: "command:missing-player",
          type: "spy-district",
          mode: "free",
          serverInstanceId: "instance:1",
          issuedAt: new Date(0).toISOString()
        }
      }
    });

    expect(missingPlayerId.body.errors).toContainEqual(expect.objectContaining({
      code: "transport.invalid_request",
      details: {
        field: "command.playerId"
      }
    }));
  });

  it.each([
    ["attack-district", {}, "command.payload.districtId"],
    ["occupy-district", {}, "command.payload.districtId"],
    ["spy-district", { districtId: "district:2" }, "command.payload.sourceDistrictId"],
    ["place-trap", {}, "command.payload.districtId"],
    ["collect-production", { districtId: "district:1" }, "command.payload.buildingId"],
    ["craft-item", { districtId: "district:1", buildingId: "building:1" }, "command.payload.recipeId"],
    ["run-building-action", { districtId: "district:1", buildingId: "building:1" }, "command.payload.actionId"]
  ])("rejects invalid %s payload shape before transport dispatch", async (type, payload, field) => {
    const handler = createGameplaySliceJsonHandler({
      load: () => {
        throw new Error("unexpected load");
      },
      submit: async () => {
        throw new Error("invalid command reached transport");
      }
    });

    const response = await handler.handle({
      method: "POST",
      path: "/api/gameplay-slice/submit",
      body: {
        focusDistrictId: "district:1",
        command: {
          id: `command:invalid-payload:${type}`,
          type,
          mode: "free",
          playerId: "player:1",
          serverInstanceId: "instance:1",
          issuedAt: new Date(0).toISOString(),
          payload,
          clientRequestId: null
        }
      }
    });

    expect(response).toMatchObject({
      status: 200,
      body: {
        accepted: false,
        readModel: null
      }
    });
    expect(response.body.errors).toContainEqual(expect.objectContaining({
      code: "transport.invalid_request",
      details: {
        field
      }
    }));
  });
});
