import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  applyCommand,
  createArmoryProductionBuildingView,
  migrateArmoryProductionState,
  migrateLegacyProductionToInstantState
} from "@empire/game-core";
import type { CraftItemCommand } from "@empire/shared-types";
import { createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { advanceProductionUntilIdle } from "../../fixtures/timed-operation-fixtures";

const context = { config: resolveModeConfig("free") };
const armory = context.config.balance.armory!;

const produce = (buildingId: string, recipeId: string, quantity = 1): CraftItemCommand =>
  createCraftItemCommandFixture({
    id: `command:armory:${recipeId}:${quantity}`,
    payload: { districtId: "district:1", buildingId, recipeId, quantity }
  });

describe("timed armory production", () => {
  it("keeps all ten canonical recipes and existing material costs", () => {
    expect(Object.keys(armory.recipes)).toHaveLength(10);
    expect(armory.recipes["baseball-bat"]).toMatchObject({
      inputCosts: { "metal-parts": 2 },
      outputAmount: 1
    });
    expect(armory.recipes.pistol).toMatchObject({
      inputCosts: { "metal-parts": 3, "tech-core": 1 },
      outputAmount: 1
    });
    expect(armory.recipes.bazooka).toMatchObject({
      inputCosts: { "metal-parts": 3, "combat-module": 2 },
      outputAmount: 1
    });
    expect(armory.recipes["defense-tower"]).toMatchObject({
      inputCosts: { "tech-core": 3, "combat-module": 2 },
      outputAmount: 1
    });
  });

  it("reserves every attack and defense item at start and stores each only when due", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { cash: 5_000, "metal-parts": 50, "tech-core": 20, "combat-module": 10 }
    });
    const recipeIds = Object.keys(armory.recipes);
    const finished = recipeIds.reduce((current, recipeId) => {
      const result = applyCommand(current, produce(building.id, recipeId), context);
      expect(result.errors).toEqual([]);
      return result.nextState;
    }, state);
    const completed = recipeIds.reduce(
      (current, recipeId) => advanceProductionUntilIdle(current, building.id, recipeId, context),
      finished
    );

    expect(finished.root.tick).toBe(state.root.tick);
    expect(finished.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 5_000,
      "metal-parts": 27,
      "tech-core": 11,
      "combat-module": 5
    });
    for (const recipeId of recipeIds) {
      expect(finished.resourceStatesById["resource:1"]?.balances[recipeId] ?? 0).toBe(0);
    }
    expect(completed.resourceStatesById[`resource:${building.id}`]?.balances).toMatchObject({
      "baseball-bat": 1,
      pistol: 1,
      grenade: 1,
      smg: 1,
      bazooka: 1,
      vest: 1,
      barricades: 1,
      cameras: 1,
      "defense-tower": 1,
      alarm: 1
    });
  });

  it("projects timed production with the existing attack and defense categories", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { "metal-parts": 12, "tech-core": 3, pistol: 2 }
    });
    const view = createArmoryProductionBuildingView({
      state,
      building,
      playerId: "player:1",
      config: context.config,
      tickRateMs: context.config.tickRateMs
    })!;

    expect(view.categories.map((category) => category.recipeIds)).toEqual([
      ["baseball-bat", "pistol", "grenade", "smg", "bazooka"],
      ["vest", "barricades", "cameras", "defense-tower", "alarm"]
    ]);
    expect(view.productionLines.find((line) => line.recipeId === "pistol")).toMatchObject({
      executionMode: "legacy-timed",
      producedAmount: 0,
      playerStoredAmount: 2,
      queuedAmount: 0,
      waitingAmount: 0,
      remainingTicks: 0,
      canCollect: false
    });
  });

  it("rejects invalid quantity and missing inputs atomically, and waits on full output storage", () => {
    const missingFixture = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { "metal-parts": 2, "tech-core": 0 }
    });
    const invalid = applyCommand(
      missingFixture.state,
      produce(missingFixture.building.id, "baseball-bat", 0),
      context
    );
    const missing = applyCommand(
      missingFixture.state,
      produce(missingFixture.building.id, "pistol"),
      context
    );
    expect(invalid.errors[0]?.code).toBe("armory_invalid_quantity");
    expect(invalid.nextState).toBe(missingFixture.state);
    expect(missing.errors[0]?.code).toBe("armory_missing_inputs");
    expect(missing.nextState).toBe(missingFixture.state);

    const fullFixture = createCoreStateWithFixedBuildingFixture("armory", {
      productionResourceKey: "pistol",
      productionStoredAmount: 5,
      playerBalances: { "metal-parts": 3, "tech-core": 1, pistol: 0 }
    });
    const full = applyCommand(fullFixture.state, produce(fullFixture.building.id, "pistol"), context);
    const dueTick = full.nextState.buildingsById[fullFixture.building.id]?.productionLines?.pistol?.activeCompletesAtTick;
    const completed = advanceProductionUntilIdle(full.nextState, fullFixture.building.id, "pistol", context);
    expect(full.errors).toEqual([]);
    expect(full.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      "metal-parts": 0,
      "tech-core": 0,
      pistol: 0
    });
    expect(completed.resourceStatesById[`resource:${fullFixture.building.id}`]?.balances.pistol).toBe(5);
    expect(completed.buildingsById[fullFixture.building.id]?.productionLines?.pistol).toMatchObject({
      queuedAmount: 1,
      activeCompletesAtTick: dueTick
    });
    expect(completed.root.tick).toBe(dueTick);
  });

  it("settles the historical two-item Armory processing output exactly once", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { pistol: 3 },
      buildingOverrides: {
        processing: { recipeId: "pistol", startedAtTick: 12, completesAtTick: 42 }
      }
    });
    const lineMigrated = migrateArmoryProductionState(state);
    const settled = migrateLegacyProductionToInstantState(lineMigrated, context);

    expect(settled.resourceStatesById["resource:1"]?.balances.pistol).toBe(5);
    expect(settled.buildingsById[building.id]?.productionLines).toEqual({});
    expect(migrateLegacyProductionToInstantState(settled, context)).toBe(settled);
  });
});
