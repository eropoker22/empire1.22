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
});
