import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick } from "../../../packages/game-core/src/engine";
import { createCollectProductionCommandFixture, createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { advanceStateToTick } from "../../fixtures/timed-operation-fixtures";

describe("production collect command flow", () => {
  it.each([
    ["factory", "metal-parts", "metal-parts", { cash: 300 }],
    ["drug_lab", "neon-dust", "neon-dust", { cash: 500, chemicals: 2 }]
  ])("credits a completed %s output only when the craft timer is due", (
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
    const line = started.nextState.buildingsById[buildingId]?.productionLines?.[recipeId];
    expect(line?.activeCompletesAtTick).toBeGreaterThan(state.root.tick);
    const beforeDue = advanceStateToTick(started.nextState, line!.activeCompletesAtTick! - 1, context);
    const completed = runTick(beforeDue, context);
    const collected = applyCommand(completed.nextState, createCollectProductionCommandFixture({
      payload: { districtId: "district:1", buildingId, resourceKey }
    }), context);
    expect(started.errors).toEqual([]);
    expect(started.nextState.root.tick).toBe(state.root.tick);
    expect(started.nextState.resourceStatesById[buildingResourceStateId]?.balances[resourceKey]).toBe(0);
    expect(started.nextState.resourceStatesById["resource:1"]?.balances[resourceKey] ?? 0).toBe(0);
    expect(beforeDue.resourceStatesById["resource:1"]?.balances[resourceKey] ?? 0).toBe(0);
    expect(completed.nextState.resourceStatesById[buildingResourceStateId]?.balances[resourceKey]).toBe(1);
    expect(completed.nextState.resourceStatesById["resource:1"]?.balances[resourceKey] ?? 0).toBe(0);
    expect(collected.errors).toEqual([]);
    expect(collected.nextState.resourceStatesById[buildingResourceStateId]?.balances[resourceKey]).toBe(0);
    expect(collected.nextState.resourceStatesById["resource:1"]?.balances[resourceKey]).toBe(1);
    expect(started.nextState.buildingsById[buildingId]?.processing).toBeNull();
    expect(started.events).toEqual([]);
    expect(completed.events).toContainEqual(expect.objectContaining({
      type: "item-crafted",
      payload: expect.objectContaining({
        buildingId,
        recipeId,
        outputResourceKey: resourceKey,
        outputAmount: 1,
        completedAtTick: line!.activeCompletesAtTick
      })
    }));
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
