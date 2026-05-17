import { describe, expect, it } from "vitest";
import { createGameplaySliceJsonHandler } from "../../apps/server/src/transport";

describe("gameplay slice json handler", () => {
  it("routes load and submit requests to the gameplay slice transport", () => {
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
      submit: (request) => {
        calls.push(`submit:${request.focusDistrictId}:${request.command.type}`);
        return {
          accepted: true,
          readModel: null,
          errors: []
        };
      }
    });

    expect(
      handler.handle({
        method: "POST",
        path: "/api/gameplay-slice/load",
        body: {
          serverInstanceId: "instance:1",
          playerId: "player:1",
          districtId: "district:1"
        }
      }).status
    ).toBe(200);
    expect(
      handler.handle({
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
            issuedAt: new Date(0).toISOString()
          }
        }
      }).status
    ).toBe(200);

    expect(calls).toEqual([
      "load:district:1",
      "submit:district:1:place-trap"
    ]);
  });

  it("returns transport-safe errors for unsupported routes", () => {
    const handler = createGameplaySliceJsonHandler({
      load: () => {
        throw new Error("unexpected load");
      },
      submit: () => {
        throw new Error("unexpected submit");
      }
    });

    expect(handler.handle({ method: "GET", path: "/api/gameplay-slice/load", body: {} })).toMatchObject({
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
    expect(handler.handle({ method: "POST", path: "/api/gameplay-slice/missing", body: {} })).toMatchObject({
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

  it("rejects invalid load and submit request shapes before transport dispatch", () => {
    const handler = createGameplaySliceJsonHandler({
      load: () => {
        throw new Error("invalid load reached transport");
      },
      submit: () => {
        throw new Error("invalid submit reached transport");
      }
    });

    expect(handler.handle({
      method: "POST",
      path: "/api/gameplay-slice/load",
      body: {
        playerId: "player:missing-instance",
        districtId: "district:1"
      }
    })).toMatchObject({
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

    expect(handler.handle({
      method: "POST",
      path: "/api/gameplay-slice/submit",
      body: {
        focusDistrictId: "district:1"
      }
    })).toMatchObject({
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

  it("rejects commands missing required envelope fields before transport dispatch", () => {
    const handler = createGameplaySliceJsonHandler({
      load: () => {
        throw new Error("unexpected load");
      },
      submit: () => {
        throw new Error("invalid command reached transport");
      }
    });

    const missingId = handler.handle({
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

    const missingPlayerId = handler.handle({
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
});
