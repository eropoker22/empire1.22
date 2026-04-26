import { describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import {
  createCraftItemCommand,
  createRunBuildingActionCommand
} from "../../apps/client/src/features";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";

describe("production building network gameplay slice", () => {
  it("exposes pharmacy, drug lab, factory and armory as fixed production/craft slots", async () => {
    const server = createServerApp();
    const instanceId = "instance:production-network";
    const playerId = "player:producer";
    const districtId = "district:production-network";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createDistrictBuildingSliceSeed({
      instanceId,
      playerId,
      districtId,
      mode: "free",
      homeDistrict: {
        zone: "industrial",
        buildingTypes: ["pharmacy", "drug_lab", "factory", "armory"]
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

    expect(initialRender.sidePanelHtml).toContain("Production slots");
    expect(initialRender.sidePanelHtml).toContain('data-slot-building-type="pharmacy"');
    expect(initialRender.sidePanelHtml).toContain('data-slot-building-type="drug-lab"');
    expect(initialRender.sidePanelHtml).toContain('data-slot-building-type="factory"');
    expect(initialRender.sidePanelHtml).toContain('data-slot-building-type="armory"');
    expect(initialRender.sidePanelHtml).toContain("Collect Metal Parts");
    expect(initialRender.sidePanelHtml).toContain("Collect Neon Dust");
    expect(initialRender.sidePanelHtml).toContain("Process Combat Module");
    expect(initialRender.sidePanelHtml).toContain("Process Pulse Shot");
    expect(initialRender.sidePanelHtml).toContain("Process Pistol");

    const factoryId = initialRender.districtPanel?.buildings.find((building) => building.buildingTypeId === "factory")?.buildingId;
    const drugLabId = initialRender.districtPanel?.buildings.find((building) => building.buildingTypeId === "drug_lab")?.buildingId;
    const armoryId = initialRender.districtPanel?.buildings.find((building) => building.buildingTypeId === "armory")?.buildingId;

    expect(factoryId).toBeTruthy();
    expect(drugLabId).toBeTruthy();
    expect(armoryId).toBeTruthy();

    const factoryAction = await client.dispatch(
      createRunBuildingActionCommand({
        commandId: "command:building-action:factory",
        slice: client.getGameplaySlice()!,
        buildingId: factoryId!,
        actionId: "produce_combat_module",
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(factoryAction.errors).toEqual([]);
    expect(factoryAction.player?.resourceSummary).toContain("Combat Module 1");

    const drugAction = await client.dispatch(
      createRunBuildingActionCommand({
        commandId: "command:building-action:drug-lab",
        slice: client.getGameplaySlice()!,
        buildingId: drugLabId!,
        actionId: "produce_pulse_shot",
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(drugAction.errors).toEqual([]);
    expect(drugAction.player?.resourceSummary).toContain("Pulse Shot 1");

    const armoryCraft = await client.dispatch(
      createCraftItemCommand({
        commandId: "command:craft:armory",
        slice: client.getGameplaySlice()!,
        buildingId: armoryId!,
        recipeId: "pistol",
        issuedAt: new Date(0).toISOString()
      })
    );

    expect(armoryCraft.errors).toEqual([]);
    expect(server.instanceManager.getInstanceById(instanceId)?.state.buildingsById[armoryId!]?.processing?.recipeId).toBe("pistol");
  });
});
