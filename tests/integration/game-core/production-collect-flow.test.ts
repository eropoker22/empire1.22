import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick } from "../../../packages/game-core/src/engine";
import { createCollectProductionCommandFixture, createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

describe("production collect command flow", () => {
  it.each([
    ["factory", "metal-parts", "metal-parts", { cash: 300 }],
    ["drug_lab", "neon-dust", "neon-dust", { cash: 500, chemicals: 2 }]
  ])("moves a completed %s line output to player resources on collect", (
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
    const baseDuration = buildingTypeId === "factory"
      ? context.config.balance.factory!.recipes[recipeId as "metal-parts"].durationTicksPerUnit
      : context.config.balance.drugLab!.recipes[recipeId as "neon-dust"].durationTicksPerUnit;
    const duration = Math.ceil(baseDuration * context.config.balance.cooldownMultiplier);
    let completedState = started.nextState;
    for (let index = 0; index < duration + 1; index += 1) {
      completedState = runTick(completedState, context).nextState;
    }

    expect(started.errors).toEqual([]);
    expect(completedState.resourceStatesById[buildingResourceStateId]?.balances[resourceKey]).toBe(1);

    const collectCommand = createCollectProductionCommandFixture({
      payload: {
        districtId: "district:1",
        buildingId,
        resourceKey
      }
    });
    const collected = applyCommand(completedState, collectCommand, context);

    expect(collected.errors).toEqual([]);
    expect(collected.nextState.resourceStatesById[buildingResourceStateId]?.balances[resourceKey]).toBe(0);
    expect(collected.nextState.resourceStatesById["resource:1"]?.balances[resourceKey]).toBe(1);
    expect(collected.events).toHaveLength(1);
    expect(collected.events[0]?.type).toBe("production-collected");
  });

  it("collects only available capacity and leaves the remainder in the production building", () => {
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

  it("rejects collect-production when the global capacity is full", () => {
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
