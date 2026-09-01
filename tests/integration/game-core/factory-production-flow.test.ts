import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  applyCommand,
  createFactoryProductionBuildingView,
  migrateFactoryProductionState,
  migrateLegacyProductionToInstantState
} from "@empire/game-core";
import type { CraftItemCommand } from "@empire/shared-types";
import { createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { advanceProductionUntilIdle } from "../../fixtures/timed-operation-fixtures";

const context = { config: resolveModeConfig("free") };

const produce = (buildingId: string, recipeId: string, quantity = 1): CraftItemCommand =>
  createCraftItemCommandFixture({
    id: `command:factory:${recipeId}:${quantity}`,
    payload: { districtId: "district:1", buildingId, recipeId, quantity }
  });

describe("timed factory production", () => {
  it("keeps the existing three-recipe economy contract", () => {
    const recipes = context.config.balance.factory!.recipes;
    expect(recipes["metal-parts"]).toMatchObject({
      outputAmount: 1,
      cleanCashCostPerUnit: 300,
      inputCosts: {}
    });
    expect(recipes["tech-core"]).toMatchObject({
      outputAmount: 1,
      cleanCashCostPerUnit: 900,
      inputCosts: { "metal-parts": 4 }
    });
    expect(recipes["combat-module"]).toMatchObject({
      outputAmount: 1,
      cleanCashCostPerUnit: 2_500,
      inputCosts: { "metal-parts": 4, "tech-core": 2 }
    });
  });

  it("reserves the material chain at start and stores output after each timer", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 10_000, "metal-parts": 20, "tech-core": 10, "combat-module": 0 }
    });
    const metal = applyCommand(state, produce(building.id, "metal-parts"), context);
    const tech = applyCommand(metal.nextState, produce(building.id, "tech-core"), context);
    const combat = applyCommand(tech.nextState, produce(building.id, "combat-module"), context);
    let completed = combat.nextState;
    for (const recipeId of ["metal-parts", "tech-core", "combat-module"]) {
      completed = advanceProductionUntilIdle(completed, building.id, recipeId, context);
    }

    expect(combat.errors).toEqual([]);
    expect(combat.nextState.root.tick).toBe(state.root.tick);
    expect(combat.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 6_300,
      "metal-parts": 12,
      "tech-core": 8,
      "combat-module": 0
    });
    expect(completed.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 6_300,
      "metal-parts": 12,
      "tech-core": 8,
      "combat-module": 0
    });
    expect(completed.resourceStatesById[`resource:${building.id}`]?.balances).toMatchObject({
      "metal-parts": 1,
      "tech-core": 1,
      "combat-module": 1
    });
  });

  it("repairs a legacy neutral Factory owner at start and defers its output", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 300, "metal-parts": 0 },
      buildingOverrides: { ownerPlayerId: "player:neutral" }
    });
    const result = applyCommand(state, produce(building.id, "metal-parts"), context);
    const completed = advanceProductionUntilIdle(result.nextState, building.id, "metal-parts", context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.buildingsById[building.id]?.ownerPlayerId).toBe("player:1");
    expect(result.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 0,
      "metal-parts": 0
    });
    expect(completed.resourceStatesById[`resource:${building.id}`]?.balances["metal-parts"]).toBe(1);
  });

  it("projects timed player-storage production and disables collect", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 5_000, "metal-parts": 8, "tech-core": 3 }
    });
    const view = createFactoryProductionBuildingView({
      state,
      building,
      playerId: "player:1",
      config: context.config,
      tickRateMs: context.config.tickRateMs
    })!;

    expect(view.canCollect).toBe(false);
    expect(view.collectableAmount).toBe(0);
    expect(view.productionLines.every((line) => line.executionMode === "legacy-timed")).toBe(true);
    expect(view.productionLines.every((line) => line.queuedAmount === 0 && line.remainingTicks === 0)).toBe(true);
    expect(view.producedSummary).toContainEqual(expect.objectContaining({
      resourceKey: "metal-parts",
      currentAmount: 0
    }));
  });

  it("rejects insufficient resources and safely waits when completed storage is full", () => {
    const missingFixture = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 900, "metal-parts": 3 }
    });
    const missing = applyCommand(
      missingFixture.state,
      produce(missingFixture.building.id, "tech-core"),
      context
    );
    expect(missing.errors[0]?.code).toBe("factory_missing_inputs");
    expect(missing.nextState).toBe(missingFixture.state);

    const fullFixture = createCoreStateWithFixedBuildingFixture("factory", {
      productionResourceKey: "tech-core",
      productionStoredAmount: 5,
      playerBalances: { cash: 900, "metal-parts": 4, "tech-core": 0 }
    });
    const full = applyCommand(fullFixture.state, produce(fullFixture.building.id, "tech-core"), context);
    const dueTick = full.nextState.buildingsById[fullFixture.building.id]?.productionLines?.["tech-core"]?.activeCompletesAtTick;
    const completed = advanceProductionUntilIdle(full.nextState, fullFixture.building.id, "tech-core", context);
    expect(full.errors).toEqual([]);
    expect(full.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 0,
      "metal-parts": 0,
      "tech-core": 0
    });
    expect(completed.resourceStatesById[`resource:${fullFixture.building.id}`]?.balances["tech-core"]).toBe(5);
    expect(completed.buildingsById[fullFixture.building.id]?.productionLines?.["tech-core"]).toMatchObject({
      queuedAmount: 1,
      activeCompletesAtTick: dueTick
    });
    expect(completed.root.tick).toBe(dueTick);
  });

  it("settles a paid legacy Factory job once without duplicating its output", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { "tech-core": 2 },
      buildingOverrides: {
        processing: { recipeId: "tech-core", startedAtTick: 12, completesAtTick: 42 }
      }
    });
    const lineMigrated = migrateFactoryProductionState(state);
    const settled = migrateLegacyProductionToInstantState(lineMigrated, context);

    expect(settled.resourceStatesById["resource:1"]?.balances["tech-core"]).toBe(3);
    expect(settled.buildingsById[building.id]?.productionLines).toEqual({});
    expect(migrateLegacyProductionToInstantState(settled, context)).toBe(settled);
  });
});
