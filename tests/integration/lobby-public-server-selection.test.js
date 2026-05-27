import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicServerRegistry } from "../../packages/game-config/src/public/public-server-registry.js";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function.ts";
import {
  SERVER_CATALOG,
  saveLobbyStep,
  saveLoginStep
} from "../../page-assets/js/app/auth-flow.js";

const SESSION_STORAGE_KEY = "empireStreets.session.v1";

const createLocalStorage = () => {
  const store = new Map();

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
};

const readBody = async (responsePromise) => {
  const response = await responsePromise;
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null
  };
};

describe("lobby public server selection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T10:00:00.000Z"));
    globalThis.window = { localStorage: createLocalStorage() };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
  });

  it("passes a backend public serverInstanceId through the faction/game entry flow", async () => {
    const canonicalServer = publicServerRegistry.find((server) => server.isPublic && server.mode === "free");
    const handler = createGameplaySliceFunctionHandler({
      cryptoProvider: () => webcrypto,
      environment: { NODE_ENV: "test" }
    });
    const response = await readBody(handler({
      httpMethod: "GET",
      path: "/api/servers",
      body: null
    }));
    const serverSummary = response.json.servers.find(
      (server) => server.serverInstanceId === canonicalServer.serverInstanceId
    );

    expect(serverSummary).toBeTruthy();
    expect(SERVER_CATALOG.some((server) => server.id === canonicalServer.serverInstanceId)).toBe(true);

    saveLoginStep({
      identity: "Backend Boss",
      isGuest: true,
      mode: serverSummary.mode
    });

    const session = saveLobbyStep({
      serverId: serverSummary.serverInstanceId,
      districtId: 27,
      server: {
        id: serverSummary.serverInstanceId,
        serverInstanceId: serverSummary.serverInstanceId,
        name: serverSummary.displayName,
        mode: serverSummary.mode,
        region: serverSummary.region,
        status: serverSummary.status
      }
    });

    expect(session.registration).toMatchObject({
      activeServerId: canonicalServer.serverInstanceId,
      activeServerInstanceId: canonicalServer.serverInstanceId,
      serverId: canonicalServer.serverInstanceId,
      serverInstanceId: canonicalServer.serverInstanceId,
      serverMode: canonicalServer.mode,
      preferredStartDistrictId: 27,
      startDistrictId: 27,
      serverRegistrationStatus: "server_selected"
    });
  });
});
