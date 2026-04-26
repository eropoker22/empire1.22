import { describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import { createRunBuildingActionCommand } from "../../apps/client/src/features";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";

describe("production collect gameplay slice", () => {
  it("runs a fixed warehouse collection action through the migrated command flow", async () => {
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

    const client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });

    const initialRender = await client.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
    });

    const buildingId = initialRender.districtPanel?.buildings.find(
      (building) => building.buildingTypeId === "warehouse"
    )?.buildingId;

    expect(buildingId).toBeTruthy();
    expect(initialRender.sidePanelHtml).toContain("Collect Stored Resources");
    expect(initialRender.sidePanelHtml).toContain("Gain 2 Chemicals + 2 Metal Parts + 50 Dirty Cash");

    const collected = await client.dispatch(
      createRunBuildingActionCommand({
        commandId: "command:building-action:warehouse",
        slice: client.getGameplaySlice()!,
        buildingId: buildingId!,
        actionId: "collect_stored_resources",
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(collected.errors).toEqual([]);
    expect(collected.player?.resourceSummary).toContain("Chemicals 12");
    expect(collected.player?.resourceSummary).toContain("Metal Parts 10");
    expect(collected.player?.resourceSummary).toContain("Dirty Cash 350");
    expect(collected.districtPanel?.heatLabel).toBe("1");
    expect(collected.reports[0]?.category).toBe("building-action");
    expect(
      collected.districtPanel?.buildings
        .find((building) => building.buildingId === buildingId)
        ?.actions.find((action) => action.actionId === "collect_stored_resources")?.disabled
    ).toBe(true);
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${playerId}`]?.balances.chemicals
    ).toBe(12);
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${playerId}`]?.balances["metal-parts"]
    ).toBe(10);
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${playerId}`]?.balances["dirty-cash"]
    ).toBe(350);
    expect(
      server.gameplaySliceTransport.load({
        serverInstanceId: instanceId,
        playerId,
        districtId
      }).readModel?.player.resourceBalances.chemicals
    ).toBe(12);
  });
});
