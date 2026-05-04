import { describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import { createCollectProductionCommand } from "../../apps/client/src/features";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";

describe("production collect gameplay slice", () => {
  it("runs a fixed production collection action through the migrated command flow", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-slice";
    const playerId = "player:producer";
    const districtId = "district:producer";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createDistrictBuildingSliceSeed({
      instanceId,
      playerId,
      districtId,
      mode: "free",
      homeDistrict: {
        zone: "industrial",
        buildingSetKey: "ind-early-1"
      }
    });
    server.instanceManager.startInstance(instanceId);
    server.instanceManager.tickInstance(instanceId);
    server.instanceManager.tickInstance(instanceId);

    const client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });

    const initialRender = await client.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
    });

    const buildingId = initialRender.districtPanel?.buildings.find(
      (building) => building.buildingTypeId === "factory"
    )?.buildingId;

    expect(buildingId).toBeTruthy();
    expect(initialRender.sidePanelHtml).toContain("Collect Metal Parts");
    expect(initialRender.sidePanelHtml).toContain("8/24 ready");

    const collected = await client.dispatch(
      createCollectProductionCommand({
        commandId: "command:collect:factory",
        serverInstanceId: instanceId,
        playerId,
        mode: "free",
        districtId,
        buildingId: buildingId!,
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(collected.errors).toEqual([]);
    expect(collected.player?.resourceSummary).toContain("Metal Parts 16");
    expect(
      collected.districtPanel?.buildings
        .find((building) => building.buildingId === buildingId)
    ).toBeTruthy();
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${playerId}`]?.balances["metal-parts"]
    ).toBe(16);
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${buildingId}`]?.balances["metal-parts"]
    ).toBe(0);
    expect(
      server.gameplaySliceTransport.load({
        serverInstanceId: instanceId,
        playerId,
        districtId
      }).readModel?.player.resourceBalances["metal-parts"]
    ).toBe(16);
  });
});
