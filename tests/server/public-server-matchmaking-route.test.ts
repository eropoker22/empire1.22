import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";

const readBody = async (responsePromise: Promise<{ statusCode: number; body?: string | null }>) => {
  const response = await responsePromise;
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null
  };
};

describe("public server matchmaking route", () => {
  it("returns a canonical public server reservation", async () => {
    const handler = createGameplaySliceFunctionHandler({
      cryptoProvider: () => webcrypto,
      environment: { NODE_ENV: "test" }
    });

    const response = await readBody(handler({
      httpMethod: "POST",
      path: "/api/matchmaking/reserve",
      body: JSON.stringify({
        playerId: "player:route:mm",
        mode: "free",
        regionLatencyMs: {
          "EU Central": 10
        }
      })
    }));

    expect(response.statusCode).toBe(200);
    expect(response.json).toMatchObject({
      accepted: true,
      reservation: {
        serverInstanceId: "instance:free:eu-central:public-1",
        mode: "free",
        region: "EU Central"
      },
      errors: []
    });
  });
});
