import { describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSession } from "../../apps/server/src/bootstrap/gameplay-slice-session-bootstrap";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";

describe("faction gameplay slice bootstrap", () => {
  it("persists requested faction and applies its starting package server-side", async () => {
    const server = createServerApp();
    const client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });

    const request = {
      serverInstanceId: "instance:free-faction-foundation",
      playerId: "player:faction-test",
      districtId: "district:77",
      factionId: "kartel"
    };

    await ensureGameplaySliceSession(server.instanceManager, request);
    await client.load(request);

    const runtime = server.instanceManager.getInstanceById("instance:free-faction-foundation");
    const player = runtime?.state.playersById["player:faction-test"];
    const resources = player ? runtime?.state.resourceStatesById[player.resourceStateId] : null;

    expect(player?.factionId).toBe("kartel");
    expect(resources?.balances).toMatchObject({
      cash: 1600,
      "dirty-cash": 480,
      chemicals: 13
    });
    expect(client.getGameplaySlice()?.player.faction).toMatchObject({
      factionId: "kartel",
      activePassiveEffects: expect.arrayContaining(["Dirty income +15 %"])
    });
  });

  it("does not create a fallback mafian session for cold submit without snapshot", async () => {
    const server = createServerApp();
    const request = {
      focusDistrictId: "district:88",
      command: {
        id: "command:faction-submit-without-runtime",
        type: "collect-production",
        mode: "free",
        playerId: "player:kartel-cold-submit",
        serverInstanceId: "instance:free-faction-cold-submit",
        issuedAt: new Date(0).toISOString(),
        payload: {
          districtId: "district:88",
          buildingId: "building:district:88:factory:1"
        },
        clientRequestId: null
      }
    } as const;

    await expect(ensureGameplaySliceSession(server.instanceManager, request)).resolves.toBe(false);
    expect(server.instanceManager.getInstanceById("instance:free-faction-cold-submit")).toBeUndefined();

    const response = server.gameplaySliceTransport.submit(request);

    expect(response.accepted).toBe(false);
    expect(response.errors[0]?.code).toBe("transport.session_token_missing");
  });
});
