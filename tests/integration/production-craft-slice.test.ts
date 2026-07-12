import { describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";
import { createDevGameplaySession } from "../helpers/gameplay-session-test-helpers";

describe("production craft gameplay slice", () => {
  it("starts the server-authoritative pharmacy Stim Pack line from a minimal intent", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-craft-slice";
    const playerId = "player:producer";
    const districtId = "district:producer";
    const runtime = server.instanceManager.createInstance(instanceId, "free");
    runtime.state = createDistrictBuildingSliceSeed({ instanceId, playerId, districtId, mode: "free" });
    server.instanceManager.startInstance(instanceId);
    const client = createClientApp({ transport: createInMemoryClientTransport(server.gameplaySliceTransport) });
    const session = await createDevGameplaySession(server, { serverInstanceId: instanceId, playerId, districtId });
    const initialRender = await client.load(session.loadRequest);
    const buildingId = initialRender.districtPanel?.buildings.find((building) => building.buildingTypeId === "pharmacy")?.buildingId;

    expect(buildingId).toBeTruthy();
    const crafted = await client.dispatch({
      id: "command:craft:stim-pack",
      type: "craft-item",
      mode: "free",
      playerId,
      serverInstanceId: instanceId,
      issuedAt: new Date().toISOString(),
      clientRequestId: null,
      payload: { districtId, buildingId: buildingId!, recipeId: "stim-pack", quantity: 1 }
    });

    expect(crafted.errors).toEqual([]);
    expect(client.getGameplaySlice()?.district?.buildings.find((building) => building.buildingId === buildingId)?.pharmacy?.lines.find(
      (line) => line.recipeId === "stim-pack"
    )).toMatchObject({ queuedAmount: 1, activeAmount: 1, unitCleanCashCost: 800 });
  });
});
