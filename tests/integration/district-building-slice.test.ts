import { describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import {
  createAttackDistrictCommand,
  createRunBuildingActionCommand,
  districtPanelFeature
} from "../../apps/client/src/features";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";

describe("district building gameplay slice", () => {
  it("loads fixed district buildings and rerenders after a building action command", async () => {
    const server = createServerApp();
    const instanceId = "instance:vertical-slice";
    const playerId = "player:vertical-slice";
    const districtId = "district:vertical-slice";
    const enemyDistrictId = "district:enemy";
    const neutralDistrictId = "district:neutral";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createDistrictBuildingSliceSeed({
      instanceId,
      playerId,
      districtId,
      mode: "free",
      playerColor: "#3b82f6",
      homeDistrict: {
        buildingSetKey: "early-stable-2",
        legacyBuildingNames: ["Restaurace", "Lékárna"],
        legacyBuildingDisplayNames: ["Neon Bite", "Pulse Pharmacy"]
      },
      playerAttackLoadout: {
        pistol: 1
      },
      extraDistricts: [
        {
          id: enemyDistrictId,
          name: "Enemy District",
          ownerPlayerId: "player:enemy",
          zone: "industrial",
          buildingSetKey: "ind-top-1",
          adjacentDistrictIds: [districtId, neutralDistrictId]
        },
        {
          id: neutralDistrictId,
          name: "Neutral District",
          ownerPlayerId: null,
          legacyBuildingNames: ["Centrální banka", "Magistrát"],
          adjacentDistrictIds: [districtId, enemyDistrictId]
        }
      ]
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

    expect(initialRender.player?.playerId).toBe(playerId);
    expect(initialRender.districtPanel?.districtId).toBe(districtId);
    expect(initialRender.mapDistricts).toHaveLength(3);
    expect(initialRender.mapDistricts.find((district) => district.districtId === districtId)?.ownerColor).toBe("#3b82f6");
    expect(initialRender.mapDistricts.find((district) => district.districtId === enemyDistrictId)?.ownerColor).toBe("#ef4444");
    expect(initialRender.mapDistricts.find((district) => district.districtId === neutralDistrictId)?.ownerColor).toBeNull();
    expect(new Set(initialRender.mapDistricts.map((district) => district.ownerColor).filter(Boolean)).size).toBe(2);
    expect(initialRender.mapHtml).toContain("Starter District");
    expect(initialRender.mapHtml).toContain("Enemy District");
    expect(initialRender.mapHtml).toContain("Neutral District");
    expect(initialRender.mapHtml).toContain("data-owner-color=\"#3b82f6\"");
    expect(initialRender.mapHtml).toContain("data-owner-color=\"#ef4444\"");
    expect(initialRender.sidePanelHtml).toContain("Cíle útoku");
    expect(initialRender.sidePanelHtml).toContain("data-attack-target-id=\"district:enemy\"");
    expect(initialRender.sidePanelHtml).toContain("data-attack-target-id=\"district:neutral\"");
    expect(initialRender.mapDistricts.find((district) => district.districtId === enemyDistrictId)?.attackEnabled).toBe(true);
    expect(initialRender.mapDistricts.find((district) => district.districtId === neutralDistrictId)?.attackEnabled).toBe(true);
    expect(initialRender.sidePanelHtml).toContain("Starter District");
    expect(initialRender.sidePanelHtml).toContain("Budovy distriktu");
    expect(initialRender.sidePanelHtml).toContain("Pulse Pharmacy");
    expect(initialRender.sidePanelHtml).toContain("Lékárna");
    expect(initialRender.sidePanelHtml).toContain("Restaurace");
    expect(initialRender.sidePanelHtml).toContain("Produce Chemicals");
    expect(initialRender.sidePanelHtml).toContain("district-building-popup");
    expect(initialRender.sidePanelHtml).toContain("Speciální akce");
    expect(initialRender.sidePanelHtml).toContain("Clean / h");
    expect(initialRender.sidePanelHtml).not.toContain("Empty slot 1");
    expect(initialRender.sidePanelHtml).not.toContain("data-build-actions");
    expect(initialRender.sidePanelHtml).not.toContain("<button class=\"district-panel__action-button\" data-building-type=");
    expect(initialRender.mapHtml).toContain("Budovy: 2 pevných");
    expect(initialRender.topBarHtml).toContain("Resources:");
    expect(client.getRenderState().districtPanel?.buildingSummary).toBe("2 pevných budov");

    const enemyDistrictRender = await client.selectDistrict(enemyDistrictId);

    expect(enemyDistrictRender.districtPanel?.districtId).toBe(enemyDistrictId);
    expect(enemyDistrictRender.sidePanelHtml).toContain("Enemy District");
    expect(enemyDistrictRender.mapHtml).toContain(`data-selected-district-id="${enemyDistrictId}"`);
    expect(enemyDistrictRender.districtPanel?.attackTargets).toEqual([]);
    expect(enemyDistrictRender.sidePanelHtml).toContain("Zbrojovka");
    expect(enemyDistrictRender.districtPanel?.buildings[0]?.actions[0]?.disabled).toBe(true);
    expect(enemyDistrictRender.districtPanel?.ownershipLabel).toBe("Vlastní player:enemy");

    const homeDistrictRender = await client.selectDistrict(districtId);

    expect(homeDistrictRender.districtPanel?.districtId).toBe(districtId);
    const pharmacyAction = homeDistrictRender.districtPanel?.buildings.find((building) => building.buildingTypeId === "pharmacy")?.actions.find((action) => action.actionId === "produce_chemicals");
    expect(pharmacyAction?.disabled).toBe(false);
    expect(pharmacyAction?.statusLabel).toBe("Available");
    expect(pharmacyAction?.inputSummary).toBe("Zdarma");
    expect(pharmacyAction?.expectedEffectSummary).toContain("+6 Chemicals");
    expect(pharmacyAction?.riskSummary).toContain("Heat +1");
    expect(homeDistrictRender.mapDistricts.find((district) => district.districtId === neutralDistrictId)?.isAttackTarget).toBe(true);

    const pharmacyBuildingId = homeDistrictRender.districtPanel?.buildings.find(
      (building) => building.buildingTypeId === "pharmacy"
    )?.buildingId;
    const actionCommand = createRunBuildingActionCommand({
      commandId: "command:building-action:chemicals",
      slice: client.getGameplaySlice()!,
      buildingId: pharmacyBuildingId!,
      actionId: "produce_chemicals",
      issuedAt: new Date(0).toISOString()
    });
    const updatedRender = await client.dispatch(actionCommand);

    expect(updatedRender.errors).toEqual([]);
    expect(updatedRender.player?.resourceSummary).toContain("Chemicals 16");
    expect(updatedRender.sidePanelHtml).toContain("data-building-action-building-id");
    expect(updatedRender.sidePanelHtml).not.toContain("data-build-actions");
    expect(updatedRender.topBarHtml).toContain("Chemicals 16");
    expect(updatedRender.districtPanel?.heatLabel).toBe("1");
    expect(updatedRender.districtPanel?.influenceLabel).toBe("0");
    expect(updatedRender.districtPanel?.buildings.find((building) => building.buildingId === pharmacyBuildingId)?.actions.find((action) => action.actionId === "produce_chemicals")?.disabled).toBe(true);
    expect(updatedRender.reports[0]?.category).toBe("building-action");
    expect(updatedRender.sidePanelHtml).toContain("Produce Chemicals v district:vertical-slice");
    expect(server.instanceManager.getInstanceById(instanceId)?.state.districtsById[districtId].buildingIds).toHaveLength(2);
    expect(server.instanceManager.getInstanceById(instanceId)?.state.districtsById[districtId].heat).toBe(0.96);
    expect(server.instanceManager.getInstanceById(instanceId)?.state.resourceStatesById[`resource:${playerId}`]?.balances.chemicals).toBe(16);
    expect(server.gameplaySliceTransport.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
    }).readModel?.district?.buildings.find((building) => building.buildingId === pharmacyBuildingId)?.actions.find((action) => action.actionId === "produce_chemicals")?.enabled).toBe(false);
    expect(server.gameplaySliceTransport.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
    }).readModel?.districts.find((district) => district.districtId === districtId)?.heat).toBe(0.96);

    const attackCommand = createAttackDistrictCommand({
      commandId: "command:attack:neutral",
      serverInstanceId: instanceId,
      playerId,
      mode: "free",
      sourceDistrictId: districtId,
      targetDistrictId: neutralDistrictId,
      issuedAt: new Date(0).toISOString()
    });
    const attackedRender = await client.dispatch(attackCommand);

    expect(attackedRender.errors).toEqual([]);
    expect(attackedRender.mapDistricts.find((district) => district.districtId === neutralDistrictId)?.isOwnedByPlayer).toBe(true);
    expect(attackedRender.mapDistricts.find((district) => district.districtId === neutralDistrictId)?.attackEnabled).toBe(false);
    expect(attackedRender.mapHtml).toContain("Player cannot attack a district they already own.");
    expect(server.instanceManager.getInstanceById(instanceId)?.state.districtsById[neutralDistrictId].ownerPlayerId).toBe(playerId);
    expect(server.instanceManager.getInstanceById(instanceId)?.state.districtsById[neutralDistrictId].status).toBe("claimed");
    expect(server.gameplaySliceTransport.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
    }).readModel?.district?.attackTargets.find((target) => target.districtId === neutralDistrictId)?.enabled).toBe(false);
    expect(districtPanelFeature).toBe("district-panel");
  });

  it("projects server-authored building action status and required command inputs", async () => {
    const server = createServerApp();
    const instanceId = "instance:building-action-inputs";
    const playerId = "player:building-action-inputs";
    const districtId = "district:building-action-inputs";
    const runtime = server.instanceManager.createInstance(instanceId, "free");

    runtime.state = createDistrictBuildingSliceSeed({
      instanceId,
      playerId,
      districtId,
      mode: "free",
      homeDistrict: {
        zone: "park",
        buildingSetKey: "park-early-1"
      }
    });
    server.instanceManager.startInstance(instanceId);

    const client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
    const render = await client.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
    });
    const streetDealerAction = render.districtPanel?.buildings
      .find((building) => building.buildingTypeId === "street_dealers")
      ?.actions.find((action) => action.actionId === "start_drug_sale");

    expect(streetDealerAction).toMatchObject({
      statusLabel: "Blocked",
      inputs: [
        expect.objectContaining({ id: "dealerSlotId", type: "select" }),
        expect.objectContaining({ id: "itemId", type: "select" }),
        expect.objectContaining({ id: "amount", type: "number", min: 1 })
      ]
    });
    expect(render.sidePanelHtml).toContain('data-building-action-input="dealerSlotId"');
    expect(render.sidePanelHtml).toContain('data-building-action-input="itemId"');
    expect(render.sidePanelHtml).toContain('data-building-action-input="amount"');
  });
});
