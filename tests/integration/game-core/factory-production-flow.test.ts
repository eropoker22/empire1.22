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

const context = { config: resolveModeConfig("free") };

const produce = (buildingId: string, recipeId: string, quantity = 1): CraftItemCommand =>
  createCraftItemCommandFixture({
    id: `command:factory:${recipeId}:${quantity}`,
    payload: { districtId: "district:1", buildingId, recipeId, quantity }
  });

describe("instant factory production", () => {
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

  it("produces the material chain into canonical player storage without a tick or collect", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 10_000, "metal-parts": 20, "tech-core": 10, "combat-module": 0 }
    });
    const metal = applyCommand(state, produce(building.id, "metal-parts"), context);
    const tech = applyCommand(metal.nextState, produce(building.id, "tech-core"), context);
    const combat = applyCommand(tech.nextState, produce(building.id, "combat-module"), context);

    expect(combat.errors).toEqual([]);
    expect(combat.nextState.root.tick).toBe(state.root.tick);
    expect(combat.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 6_300,
      "metal-parts": 13,
      "tech-core": 9,
      "combat-module": 1
    });
    expect(combat.nextState.buildingsById[building.id]?.productionLines).toBeUndefined();
  });

  it("repairs a legacy neutral Factory owner in the same instant production transition", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 300, "metal-parts": 0 },
      buildingOverrides: { ownerPlayerId: "player:neutral" }
    });
    const result = applyCommand(state, produce(building.id, "metal-parts"), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.buildingsById[building.id]?.ownerPlayerId).toBe("player:1");
    expect(result.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 0,
      "metal-parts": 1
    });
  });

  it("projects player storage as the output destination and disables collect", () => {
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
    expect(view.productionLines.every((line) => line.executionMode === "instant")).toBe(true);
    expect(view.productionLines.every((line) => line.queuedAmount === 0 && line.remainingTicks === 0)).toBe(true);
    expect(view.producedSummary).toContainEqual(expect.objectContaining({
      resourceKey: "metal-parts",
      currentAmount: 8
    }));
  });

  it("rejects insufficient resources and full storage without any partial transition", () => {
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
      playerBalances: { cash: 900, "metal-parts": 4, "tech-core": 24 }
    });
    const full = applyCommand(fullFixture.state, produce(fullFixture.building.id, "tech-core"), context);
    expect(full.errors[0]?.code).toBe("storage_capacity_full");
    expect(full.nextState).toBe(fullFixture.state);
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
