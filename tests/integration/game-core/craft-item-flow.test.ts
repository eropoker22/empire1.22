import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, runTick } from "../../../packages/game-core/src/engine";
import {
  createCollectProductionCommandFixture,
  createCraftItemCommandFixture
} from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };

const craft = (buildingId: string, recipeId: string, quantity = 1) =>
  createCraftItemCommandFixture({
    id: `command:instant:${buildingId}:${recipeId}:${quantity}`,
    payload: { districtId: "district:1", buildingId, recipeId, quantity }
  });

const instantCraftCases: Array<{
  buildingTypeId: string;
  recipeId: string;
  playerBalances: Record<string, number>;
  expectedBalances: Record<string, number>;
  outputResourceKey: string;
  quantity: number;
}> = [
  {
    buildingTypeId: "pharmacy",
    recipeId: "chemicals",
    playerBalances: { cash: 720, chemicals: 0 },
    expectedBalances: { cash: 0, chemicals: 2 },
    outputResourceKey: "chemicals",
    quantity: 2
  },
  {
    buildingTypeId: "drug_lab",
    recipeId: "pulse-shot",
    playerBalances: { cash: 800, chemicals: 2, biomass: 1, "pulse-shot": 0 },
    expectedBalances: { cash: 0, chemicals: 0, biomass: 0, "pulse-shot": 1 },
    outputResourceKey: "pulse-shot",
    quantity: 1
  },
  {
    buildingTypeId: "factory",
    recipeId: "tech-core",
    playerBalances: { cash: 900, "metal-parts": 4, "tech-core": 0 },
    expectedBalances: { cash: 0, "metal-parts": 0, "tech-core": 1 },
    outputResourceKey: "tech-core",
    quantity: 1
  },
  {
    buildingTypeId: "armory",
    recipeId: "pistol",
    playerBalances: { "metal-parts": 3, "tech-core": 1, pistol: 0 },
    expectedBalances: { "metal-parts": 0, "tech-core": 0, pistol: 1 },
    outputResourceKey: "pistol",
    quantity: 1
  }
];

describe("instant craft-item command flow", () => {
  it.each(instantCraftCases)("debits inputs and credits $buildingTypeId/$recipeId in the same command", ({
    buildingTypeId,
    recipeId,
    playerBalances,
    expectedBalances,
    outputResourceKey,
    quantity
  }) => {
    const { state, building } = createCoreStateWithFixedBuildingFixture(buildingTypeId, { playerBalances });
    const result = applyCommand(state, craft(building.id, recipeId, quantity), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.root.tick).toBe(state.root.tick);
    expect(result.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject(expectedBalances);
    expect(result.nextState.buildingsById[building.id]?.processing).toBeNull();
    expect(Object.keys(result.nextState.buildingsById[building.id]?.productionLines ?? {})).toHaveLength(0);
    expect(result.nextState.resourceStatesById[`resource:${building.id}`]?.balances[outputResourceKey]).toBeUndefined();
    expect(result.events).toContainEqual(expect.objectContaining({
      payload: expect.objectContaining({
        outputResourceKey,
        quantity,
        instant: true
      })
    }));
  });

  it("supports an immediate multi-unit production command without creating a queue", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { cash: 2_000, chemicals: 4 }
    });

    const result = applyCommand(state, craft(building.id, "chemicals", 3), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 920,
      chemicals: 7
    });
    expect(result.nextState.buildingsById[building.id]?.productionLines).toBeUndefined();
  });

  it.each([
    ["factory", "tech-core", { cash: 900, "metal-parts": 3 }, "factory_missing_inputs"],
    ["armory", "pistol", { "metal-parts": 2, "tech-core": 0 }, "armory_missing_inputs"],
    ["drug_lab", "pulse-shot", { cash: 799, chemicals: 2, biomass: 1 }, "drug_lab_insufficient_clean_cash"]
  ])("rejects %s/%s atomically when a prerequisite is missing", (
    buildingTypeId,
    recipeId,
    playerBalances,
    errorCode
  ) => {
    const { state, building } = createCoreStateWithFixedBuildingFixture(buildingTypeId, { playerBalances });
    const rejected = applyCommand(state, craft(building.id, recipeId), context);

    expect(rejected.nextState).toBe(state);
    expect(rejected.events).toEqual([]);
    expect(rejected.errors.map((error) => error.code)).toContain(errorCode);
  });

  it("does not create another output on later ticks after an instant craft", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { "metal-parts": 2, "baseball-bat": 0 }
    });
    const produced = applyCommand(state, craft(building.id, "baseball-bat"), context);
    const afterTick = runTick(produced.nextState, context).nextState;

    expect(produced.nextState.resourceStatesById["resource:1"]?.balances["baseball-bat"]).toBe(1);
    expect(afterTick.resourceStatesById["resource:1"]?.balances["baseball-bat"]).toBe(1);
  });

  it("keeps collect only as a compatibility path for output stored by a legacy snapshot", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { "metal-parts": 4, "tech-core": 2 }
    });
    const buildingResourceStateId = `resource:${building.id}`;
    const prepared = {
      ...state,
      resourceStatesById: {
        ...state.resourceStatesById,
        [buildingResourceStateId]: {
          id: buildingResourceStateId,
          ownerType: "building" as const,
          ownerId: building.id,
          balances: { "metal-parts": 2, "tech-core": 1 },
          incomeModifiers: {},
          lastUpdatedTick: state.root.tick,
          version: 1
        }
      }
    };

    const collected = applyCommand(prepared, createCollectProductionCommandFixture({
      payload: { districtId: "district:1", buildingId: building.id }
    }), context);

    expect(collected.errors).toEqual([]);
    expect(collected.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      "metal-parts": 6,
      "tech-core": 3
    });
    expect(collected.nextState.resourceStatesById[buildingResourceStateId]?.balances).toMatchObject({
      "metal-parts": 0,
      "tech-core": 0
    });
  });
});
