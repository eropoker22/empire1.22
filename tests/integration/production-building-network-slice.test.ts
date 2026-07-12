import { describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";
import { createDevGameplaySession } from "../helpers/gameplay-session-test-helpers";

describe("production building network gameplay slice", () => {
  it("exposes pharmacy as independent server lines alongside other fixed production slots", async () => {
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
    const resourceStateId = runtime.state.playersById[playerId]!.resourceStateId;
    runtime.state = {
      ...runtime.state,
      resourceStatesById: {
        ...runtime.state.resourceStatesById,
        [resourceStateId]: {
          ...runtime.state.resourceStatesById[resourceStateId]!,
          balances: {
            ...runtime.state.resourceStatesById[resourceStateId]!.balances,
            cash: 10_000,
            chemicals: 20,
            biomass: 20,
            "metal-parts": 30,
            "tech-core": 12
          }
        }
      }
    };
    server.instanceManager.startInstance(instanceId);
    server.instanceManager.tickInstance(instanceId);
    server.instanceManager.tickInstance(instanceId);

    const client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const session = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId,
      districtId
    });
    const initialRender = await client.load(session.loadRequest);

    expect(initialRender.sidePanelHtml).toContain('data-building-type="factory"');
    expect(initialRender.sidePanelHtml).toContain('data-building-type="armory"');
    expect(initialRender.sidePanelHtml).not.toContain('data-slot-building-type="armory"');
    expect(client.getGameplaySlice()?.district?.buildings.find((building) => building.buildingTypeId === "pharmacy")?.pharmacy?.lines).toHaveLength(3);
    expect(client.getGameplaySlice()?.district?.buildings.find((building) => building.buildingTypeId === "drug_lab")?.drugLab?.lines).toHaveLength(5);

    const factoryId = initialRender.districtPanel?.buildings.find((building) => building.buildingTypeId === "factory")?.buildingId;
    const drugLabId = initialRender.districtPanel?.buildings.find((building) => building.buildingTypeId === "drug_lab")?.buildingId;
    const armoryId = initialRender.districtPanel?.buildings.find((building) => building.buildingTypeId === "armory")?.buildingId;

    expect(factoryId).toBeTruthy();
    expect(drugLabId).toBeTruthy();
    expect(armoryId).toBeTruthy();

    const factoryCraft = await client.dispatch({
      id: "command:craft:factory",
      type: "craft-item",
      mode: "free",
      playerId,
      serverInstanceId: instanceId,
      issuedAt: new Date().toISOString(),
      clientRequestId: null,
      payload: { districtId, buildingId: factoryId!, recipeId: "metal-parts", quantity: 1 }
    });
    expect(factoryCraft.errors).toEqual([]);
    expect(client.getGameplaySlice()?.district?.buildings.find((building) => building.buildingId === factoryId)?.factory?.productionLines).toHaveLength(3);

    const drugAction = await client.dispatch({
      id: "command:craft:drug-lab",
      type: "craft-item",
      mode: "free",
      playerId,
      serverInstanceId: instanceId,
      issuedAt: new Date().toISOString(),
      clientRequestId: null,
      payload: { districtId, buildingId: drugLabId!, recipeId: "pulse-shot", quantity: 1 }
    });

    expect(drugAction.errors).toEqual([]);
    expect(client.getGameplaySlice()?.district?.buildings.find((building) => building.buildingId === drugLabId)?.drugLab?.lines.find(
      (line) => line.recipeId === "pulse-shot"
    )).toMatchObject({ queuedAmount: 1, activeAmount: 1 });

    const armoryCraft = await client.dispatch(
      {
        id: "command:craft:armory",
        type: "craft-item",
        mode: "free",
        playerId,
        serverInstanceId: instanceId,
        issuedAt: new Date().toISOString(),
        clientRequestId: null,
        payload: { districtId, buildingId: armoryId!, recipeId: "pistol", quantity: 1 }
      }
    );

    expect(armoryCraft.errors).toEqual([]);
    expect(client.getGameplaySlice()?.district?.buildings.find((building) => building.buildingId === armoryId)?.armory?.productionLines).toHaveLength(10);
    expect(client.getGameplaySlice()?.district?.buildings.find((building) => building.buildingId === armoryId)?.armory?.productionLines.find(
      (line) => line.recipeId === "pistol"
    )).toMatchObject({ queuedAmount: 1, activeAmount: 1 });
  });
});
