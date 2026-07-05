import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick } from "../../../packages/game-core/src/engine";
import { createCollectProductionCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

describe("production collect command flow", () => {
  it.each([
    ["pharmacy", "chemicals", 12],
    ["factory", "metal-parts", 8],
    ["drug_lab", "neon-dust", 2]
  ])("fills %s output on tick and moves it to player resources on collect", (
    buildingTypeId,
    resourceKey,
    expectedAmount
  ) => {
    const context = {
      config: resolveModeConfig("free")
    };
    const { state, building } = createCoreStateWithFixedBuildingFixture(buildingTypeId, {
      includeWarehouse: true,
      productionResourceKey: resourceKey
    });
    const buildingId = building.id;
    const buildingResourceStateId = `resource:${buildingId}`;

    expect(state.districtsById["district:1"].buildingIds).toContain(buildingId);
    expect(state.districtsById["district:1"].buildingIds).toContain("building:district-1:warehouse:1");
    expect(state.resourceStatesById[buildingResourceStateId]?.balances[resourceKey]).toBe(0);

    const firstTick = runTick(state, context);
    const secondTick = runTick(firstTick.nextState, context);

    expect(secondTick.nextState.resourceStatesById[buildingResourceStateId]?.balances[resourceKey]).toBe(expectedAmount);

    const collectCommand = createCollectProductionCommandFixture({
      payload: {
        districtId: "district:1",
        buildingId
      }
    });
    const collected = applyCommand(secondTick.nextState, collectCommand, context);

    expect(collected.errors).toEqual([]);
    expect(collected.nextState.resourceStatesById[buildingResourceStateId]?.balances[resourceKey]).toBe(0);
    expect(collected.nextState.resourceStatesById["resource:1"]?.balances[resourceKey]).toBe(expectedAmount);
    expect(collected.events).toHaveLength(1);
    expect(collected.events[0]?.type).toBe("production-collected");
  });

  it("rejects collect-production when warehouse storage is already full", () => {
    const context = {
      config: resolveModeConfig("free")
    };
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      includeWarehouse: true,
      productionResourceKey: "chemicals",
      productionStoredAmount: 12,
      playerBalances: {
        cash: 0,
        chemicals: 350
      }
    });
    const buildingResourceStateId = `resource:${building.id}`;

    const collected = applyCommand(state, createCollectProductionCommandFixture({
      payload: {
        districtId: "district:1",
        buildingId: building.id
      }
    }), context);

    expect(collected.errors.map((error) => error.code)).toEqual(["production_storage_full"]);
    expect(collected.events).toEqual([]);
    expect(collected.nextState.resourceStatesById[buildingResourceStateId]?.balances.chemicals).toBe(12);
    expect(collected.nextState.resourceStatesById["resource:1"]?.balances.chemicals).toBe(350);
  });
});
