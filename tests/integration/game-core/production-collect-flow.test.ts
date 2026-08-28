import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand } from "../../../packages/game-core/src/engine";
import { createCollectProductionCommandFixture, createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

describe("production collect command flow", () => {
  it.each([
    ["factory", "metal-parts", "metal-parts", { cash: 300 }],
    ["drug_lab", "neon-dust", "neon-dust", { cash: 500, chemicals: 2 }]
  ])("credits a completed %s output to player resources in the craft command", (
    buildingTypeId,
    recipeId,
    resourceKey,
    playerBalances
  ) => {
    const context = {
      config: resolveModeConfig("free")
    };
    const { state, building } = createCoreStateWithFixedBuildingFixture(buildingTypeId, {
      includeWarehouse: true,
      productionResourceKey: resourceKey,
      playerBalances
    });
    const buildingId = building.id;
    const buildingResourceStateId = `resource:${buildingId}`;

    expect(state.districtsById["district:1"].buildingIds).toContain(buildingId);
    expect(state.districtsById["district:1"].buildingIds).toContain("building:district-1:warehouse:1");
    expect(state.resourceStatesById[buildingResourceStateId]?.balances[resourceKey]).toBe(0);

    const started = applyCommand(state, createCraftItemCommandFixture({
      payload: { districtId: "district:1", buildingId, recipeId, quantity: 1 }
    }), context);
    expect(started.errors).toEqual([]);
    expect(started.nextState.root.tick).toBe(state.root.tick);
    expect(started.nextState.resourceStatesById[buildingResourceStateId]?.balances[resourceKey]).toBe(0);
    expect(started.nextState.resourceStatesById["resource:1"]?.balances[resourceKey]).toBe(1);
    expect(started.nextState.buildingsById[buildingId]?.processing).toBeNull();
    expect(Object.values(started.nextState.buildingsById[buildingId]?.productionLines ?? {})).toEqual([]);
    expect(started.events).toHaveLength(1);
    expect(started.events[0]).toMatchObject({
      type: "item-crafted",
      payload: expect.objectContaining({
        outputResourceKey: resourceKey,
        outputAmount: 1,
        instant: true
      })
    });
  });

  it("collects only available capacity from a legacy ready output and leaves the remainder", () => {
    const context = {
      config: resolveModeConfig("free")
    };
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      includeWarehouse: true,
      productionResourceKey: "metal-parts",
      productionStoredAmount: 12,
      playerBalances: {
        cash: 0,
        "metal-parts": 88
      }
    });
    const buildingResourceStateId = `resource:${building.id}`;

    const collected = applyCommand(state, createCollectProductionCommandFixture({
      payload: {
        districtId: "district:1",
        buildingId: building.id,
        resourceKey: "metal-parts"
      }
    }), context);

    expect(collected.errors).toEqual([]);
    expect(collected.nextState.resourceStatesById[buildingResourceStateId]?.balances["metal-parts"]).toBe(10);
    expect(collected.nextState.resourceStatesById["resource:1"]?.balances["metal-parts"]).toBe(90);
  });

  it("rejects legacy collect-production when the global capacity is full", () => {
    const context = { config: resolveModeConfig("free") };
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      includeWarehouse: true,
      productionResourceKey: "metal-parts",
      productionStoredAmount: 12,
      playerBalances: { cash: 0, "metal-parts": 90 }
    });

    const collected = applyCommand(state, createCollectProductionCommandFixture({
      payload: { districtId: "district:1", buildingId: building.id, resourceKey: "metal-parts" }
    }), context);

    expect(collected.errors.map((error) => error.code)).toEqual(["storage_capacity_full"]);
    expect(collected.nextState.resourceStatesById["resource:" + building.id]?.balances["metal-parts"]).toBe(12);
  });
});
