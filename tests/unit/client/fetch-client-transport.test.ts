import { describe, expect, it } from "vitest";
import { createFetchClientTransport } from "../../../apps/client/src/transport";

describe("fetch client transport", () => {
  it("posts load and submit requests to the gameplay slice endpoint base", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const responseBody = {
      accepted: true,
      readModel: null,
      errors: [],
      snapshotToken: "sealed:snapshot:1"
    };
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body))
      });

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    };
    const storage = createMemoryStorage();
    const transport = createFetchClientTransport({
      endpointBase: "/api/gameplay-slice/",
      fetchImpl,
      storage
    });

    await transport.load({
      serverInstanceId: "instance:1",
      playerId: "player:1",
      districtId: "district:1"
    });
    await transport.send({
      focusDistrictId: "district:1",
      command: {
        id: "command:1",
        type: "place-trap",
        mode: "free",
        playerId: "player:1",
        serverInstanceId: "instance:1",
        issuedAt: new Date(0).toISOString(),
        payload: {
          districtId: "district:1"
        },
        clientRequestId: null
      }
    });

    expect(calls.map((call) => call.url)).toEqual([
      "/api/gameplay-slice/load",
      "/api/gameplay-slice/submit"
    ]);
    expect(calls[0]?.body).toMatchObject({
      serverInstanceId: "instance:1",
      playerId: "player:1",
      districtId: "district:1"
    });
    expect(calls[0]?.body).not.toHaveProperty("snapshotToken");
    expect(calls[1]?.body).toMatchObject({
      focusDistrictId: "district:1",
      snapshotToken: "sealed:snapshot:1",
      command: {
        type: "place-trap"
      }
    });
    expect(storage.getItem("empire:gameplay-slice:snapshot:instance:1:player:1")).toBe("sealed:snapshot:1");
  });
});

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
};
