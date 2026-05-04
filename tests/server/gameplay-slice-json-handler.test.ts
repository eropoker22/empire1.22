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
            type: "place-trap"
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
});
