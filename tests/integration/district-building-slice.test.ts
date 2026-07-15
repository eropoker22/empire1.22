import { describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import {
  createRunBuildingActionCommand,
  districtPanelFeature
} from "../../apps/client/src/features";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createServerApp } from "../../apps/server/src/app";
import { createDistrictBuildingSliceSeed } from "../../tools/seed/src";
import { createDevGameplaySession } from "../helpers/gameplay-session-test-helpers";

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
    const session = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId,
      districtId
    });

    const initialRender = await client.load(session.loadRequest);

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
    expect(initialRender.mapDistricts.find((district) => district.districtId === enemyDistrictId)?.attackEnabled).toBe(false);
    expect(initialRender.mapDistricts.find((district) => district.districtId === neutralDistrictId)?.attackEnabled).toBe(false);
    expect(initialRender.sidePanelHtml).toContain("Starter District");
    expect(initialRender.sidePanelHtml).toContain("Budovy distriktu");
    expect(initialRender.sidePanelHtml).toContain("Pulse Pharmacy");
    expect(initialRender.sidePanelHtml).toContain("Lékárna");
    expect(initialRender.sidePanelHtml).toContain("Restaurace");
    expect(initialRender.sidePanelHtml).toContain("district-building-popup");
    expect(initialRender.sidePanelHtml).toContain("Speciální akce");
    expect(initialRender.sidePanelHtml).toContain("Clean / h");
    expect(initialRender.sidePanelHtml).not.toContain("Empty slot 1");
    expect(initialRender.sidePanelHtml).not.toContain("data-build-actions");
    expect(initialRender.sidePanelHtml).not.toContain("<button class=\"district-panel__action-button\" data-building-type=");
    expect(initialRender.mapHtml).toContain("Budovy: 2 pevných");
    expect(initialRender.topBarHtml).toContain("Zdroje:");
    expect(client.getRenderState().districtPanel?.buildingSummary).toBe("2 pevných budov");

    const enemyDistrictRender = await client.selectDistrict(enemyDistrictId);

    expect(enemyDistrictRender.districtPanel?.districtId).toBe(enemyDistrictId);
    expect(enemyDistrictRender.sidePanelHtml).toContain("Enemy District");
    expect(enemyDistrictRender.mapHtml).toContain(`data-selected-district-id="${enemyDistrictId}"`);
    expect(enemyDistrictRender.districtPanel?.attackTargets).toEqual([]);
    expect(enemyDistrictRender.sidePanelHtml).toContain("Zbrojovka");
    expect(enemyDistrictRender.districtPanel?.buildings[0]?.actions).toEqual([]);
    expect(enemyDistrictRender.districtPanel?.ownershipLabel).toBe("Vlastní player:enemy");

    const homeDistrictRender = await client.selectDistrict(districtId);

    expect(homeDistrictRender.districtPanel?.districtId).toBe(districtId);
    const pharmacy = client.getGameplaySlice()?.district?.buildings.find((building) => building.buildingTypeId === "pharmacy")?.pharmacy;
    expect(pharmacy?.lines).toHaveLength(3);
    expect(pharmacy?.lines.find((line) => line.recipeId === "chemicals")?.maxStartQuantity).toBeGreaterThan(0);
    expect(homeDistrictRender.mapDistricts.find((district) => district.districtId === neutralDistrictId)?.isAttackTarget).toBe(true);

    const pharmacyBuildingId = homeDistrictRender.districtPanel?.buildings.find(
      (building) => building.buildingTypeId === "pharmacy"
    )?.buildingId;
    const actionCommand = {
      id: "command:craft:chemicals",
      type: "craft-item" as const,
      mode: "free" as const,
      playerId,
      serverInstanceId: instanceId,
      issuedAt: new Date().toISOString(),
      clientRequestId: null,
      payload: { districtId, buildingId: pharmacyBuildingId!, recipeId: "chemicals", quantity: 1 }
    };
    const updatedRender = await client.dispatch(actionCommand);

    expect(updatedRender.errors).toEqual([]);
    expect(updatedRender.sidePanelHtml).toContain("data-building-action-building-id");
    expect(updatedRender.sidePanelHtml).not.toContain("data-build-actions");
    expect(client.getGameplaySlice()?.district?.buildings.find((building) => building.buildingId === pharmacyBuildingId)?.pharmacy?.lines.find((line) => line.recipeId === "chemicals")).toMatchObject({ queuedAmount: 1, activeAmount: 1 });
    expect(server.instanceManager.getInstanceById(instanceId)?.state.districtsById[districtId].buildingIds).toHaveLength(2);

    expect(updatedRender.mapDistricts.find((district) => district.districtId === neutralDistrictId)?.isOwnedByPlayer).toBe(false);
    expect(updatedRender.mapDistricts.find((district) => district.districtId === neutralDistrictId)?.attackEnabled).toBe(false);
    expect(server.instanceManager.getInstanceById(instanceId)?.state.districtsById[neutralDistrictId].ownerPlayerId).toBeNull();
    expect(server.instanceManager.getInstanceById(instanceId)?.state.districtsById[neutralDistrictId].status).toBe("neutral");
    expect((await server.gameplaySliceTransport.load(session.loadRequest)).readModel?.district?.attackTargets.find((target) => target.districtId === neutralDistrictId)?.enabled).toBe(false);
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
    const session = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId,
      districtId
    });
    const render = await client.load(session.loadRequest);
    const streetDealerAction = render.districtPanel?.buildings
      .find((building) => building.buildingTypeId === "street_dealers")
      ?.actions.find((action) => action.actionId === "start_drug_sale");

    expect(streetDealerAction).toMatchObject({
      statusLabel: "Blocked",
      inputs: [
        expect.objectContaining({ id: "dealerSlotId", type: "select" }),
        expect.objectContaining({ id: "amount", type: "number", min: 10 })
      ]
    });
    expect(render.sidePanelHtml).toContain('data-building-action-input="dealerSlotId"');
    expect(render.sidePanelHtml).toContain('data-building-action-input="amount"');
    expect(render.sidePanelHtml).not.toContain('data-building-action-input="itemId"');
  });
});
