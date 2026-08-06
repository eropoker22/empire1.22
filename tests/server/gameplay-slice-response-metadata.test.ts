import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import { createPlaceTrapCommandFixture } from "../fixtures/command-fixtures";
import { createDevGameplaySession, loadWithDevGameplaySession } from "../helpers/gameplay-session-test-helpers";

describe("gameplay slice response metadata", () => {
  it("includes compact building indexes for owned districts while keeping the selected panel full", async () => {
    const server = createServerApp();
    const instanceId = "instance:owned-district-panels";
    const session = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: "player:owned-district-panels",
      districtId: "district:501",
      autoSelectSpawn: true
    });
    const runtime = server.instanceManager.getInstanceById(instanceId);
    if (!runtime) throw new Error("Owned district panel fixture failed to create a runtime.");

    const player = runtime.state.playersById["player:owned-district-panels"];
    const availableDistricts = Object.values(runtime.state.districtsById)
      .filter((district) => district.id !== player?.homeDistrictId && !district.ownerPlayerId);
    const secondOwnedDistrict = availableDistricts.find((district) => district.buildingIds.some((buildingId) => {
      const building = runtime.state.buildingsById[buildingId];
      return building !== undefined && building.status !== "destroyed";
    }));
    const foreignDistrict = availableDistricts.find((district) => district.id !== secondOwnedDistrict?.id);
    if (!player?.homeDistrictId || !secondOwnedDistrict || !foreignDistrict) {
      throw new Error("Owned district panel fixture lacks suitable districts.");
    }
    runtime.state.districtsById[secondOwnedDistrict.id] = {
      ...secondOwnedDistrict,
      ownerPlayerId: player.id,
      status: "claimed"
    };
    runtime.state.districtsById[foreignDistrict.id] = {
      ...foreignDistrict,
      ownerPlayerId: "player:foreign",
      status: "claimed"
    };

    const expectedBuilding = secondOwnedDistrict.buildingIds
      .map((buildingId) => runtime.state.buildingsById[buildingId])
      .find((building) => building !== undefined && building.status !== "destroyed");
    if (!expectedBuilding) {
      throw new Error("Owned district index fixture lacks a visible building.");
    }

    const response = await server.gameplaySliceTransport.load(session.loadRequest);
    const ownedDistricts = response.readModel?.ownedDistricts ?? [];
    const ownedDistrictIds = ownedDistricts.map((district) => district.districtId);
    const secondOwnedIndex = ownedDistricts.find((district) => district.districtId === secondOwnedDistrict.id);

    expect(ownedDistrictIds).toContain(player.homeDistrictId);
    expect(ownedDistrictIds).toContain(secondOwnedDistrict.id);
    expect(ownedDistrictIds).not.toContain(foreignDistrict.id);
    expect(response.readModel?.district).toEqual(expect.objectContaining({
      attackTargets: expect.any(Array),
      buildings: expect.any(Array),
      slots: expect.any(Array),
      targetActions: expect.any(Object)
    }));
    expect(secondOwnedIndex).toEqual(expect.objectContaining({
      districtId: secondOwnedDistrict.id,
      isOwnedByPlayer: true,
      buildings: expect.arrayContaining([
        expect.objectContaining({
          buildingId: expectedBuilding.id,
          buildingTypeId: expectedBuilding.buildingTypeId,
          level: expectedBuilding.level,
          status: expectedBuilding.status
        })
      ])
    }));
    expect(secondOwnedIndex).not.toHaveProperty("attackTargets");
    expect(secondOwnedIndex).not.toHaveProperty("slots");
    expect(secondOwnedIndex).not.toHaveProperty("targetActions");
    expect(secondOwnedIndex?.buildings[0]).not.toHaveProperty("actions");
    expect(secondOwnedIndex?.buildings[0]).not.toHaveProperty("presentation");
  });

  it("keeps full district panel construction scoped to the selected district", async () => {
    const source = await readFile(new URL(
      "../../apps/server/src/runtime/projections/gameplay-slice-projection-service.ts",
      import.meta.url
    ), "utf8");

    expect(source.match(/\bcreateDistrictPanelProjection\(/gu)).toHaveLength(1);
    expect(source).toContain("createOwnedDistrictBuildingIndexViews(");
  });

  it("load response carries the current server tick and state version", async () => {
    const server = createServerApp();
    const instanceId = "instance:metadata:load";

    const session = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: "player:metadata:load",
      districtId: "district:501"
    });

    const runtime = server.instanceManager.getInstanceById(instanceId);

    if (!runtime) {
      throw new Error("Metadata load fixture failed to create a runtime.");
    }

    runtime.state.root.tick = 17;
    runtime.state.root.version = 23;

    const response = await server.gameplaySliceTransport.load(session.loadRequest);

    expect(response.accepted).toBe(true);
    expect(response.metadata).toEqual({
      serverTick: 17,
      stateVersion: 23
    });
  });

  it("submit response carries metadata from the runtime after command dispatch", async () => {
    const server = createServerApp();
    const instanceId = "instance:metadata:submit";

    const { sessionToken } = await loadWithDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: "player:metadata:submit",
      districtId: "district:601"
    });

    const runtime = server.instanceManager.getInstanceById(instanceId);

    if (!runtime) {
      throw new Error("Metadata submit fixture failed to create a runtime.");
    }

    runtime.state.root.tick = 31;
    runtime.state.root.version = 41;
    const response = await server.gameplaySliceTransport.submit({
      sessionToken,
      focusDistrictId: "district:601",
      command: createPlaceTrapCommandFixture({
        id: "command:metadata:submit:1",
        playerId: "player:metadata:submit",
        serverInstanceId: instanceId,
        payload: {
          districtId: "district:601"
        }
      })
    });

    expect(response.metadata).toEqual({
      serverTick: runtime.state.root.tick,
      stateVersion: runtime.state.root.version
    });
  });
});
