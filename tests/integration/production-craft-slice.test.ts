import { describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import { createRunBuildingActionCommand } from "../../apps/client/src/features";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";

describe("production craft gameplay slice", () => {
  it("runs a fixed pharmacy stim-pack action and returns resources, cooldown, and report projection", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-craft-slice";
    const playerId = "player:producer";
    const districtId = "district:producer";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createDistrictBuildingSliceSeed({
      instanceId,
      playerId,
      districtId,
      mode: "free"
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
      (building) => building.buildingTypeId === "pharmacy"
    )?.buildingId;

    expect(buildingId).toBeTruthy();
    expect(initialRender.sidePanelHtml).toContain("Produce Stim Pack");
    expect(initialRender.sidePanelHtml).toContain("Cost 2 Chemicals + 1 Biomass");

    const crafted = await client.dispatch(
      createRunBuildingActionCommand({
        commandId: "command:building-action:stim-pack",
        slice: client.getGameplaySlice()!,
        buildingId: buildingId!,
        actionId: "produce_stim_pack",
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(crafted.errors).toEqual([]);
    expect(crafted.player?.resourceSummary).toContain("Chemicals 8");
    expect(crafted.player?.resourceSummary).toContain("Biomass 5");
    expect(crafted.player?.resourceSummary).toContain("Stim Pack 1");
    expect(crafted.districtPanel?.heatLabel).toBe("2");
    expect(crafted.districtPanel?.influenceLabel).toBe("1");
    expect(crafted.sidePanelHtml).toContain("Produce Stim Pack on district:producer");
    expect(crafted.topBarHtml).toContain("Alerts: 1");
    expect(crafted.reports[0]?.category).toBe("building-action");
    expect(
      server.gameplaySliceTransport.load({
        serverInstanceId: instanceId,
        playerId,
        districtId
      }).readModel?.player.resourceBalances["stim-pack"]
    ).toBe(1);
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${playerId}`]?.balances.chemicals
    ).toBe(8);
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${playerId}`]?.balances["stim-pack"]
    ).toBe(1);
    expect(
      server.instanceManager.getInstanceById(instanceId)?.state.buildingsById[buildingId!]?.actionCooldowns.produce_stim_pack
    ).toBeGreaterThan(0);
  });
});
