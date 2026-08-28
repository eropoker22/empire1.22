import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  applyCommand,
  createDrugLabProductionBuildingView,
  migrateDrugLabProductionState,
  migrateLegacyProductionToInstantState
} from "@empire/game-core";
import type { CraftItemCommand } from "@empire/shared-types";
import { createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };

const produce = (buildingId: string, recipeId: string, quantity = 1): CraftItemCommand =>
  createCraftItemCommandFixture({
    id: `command:drug-lab:${recipeId}:${quantity}`,
    payload: { districtId: "district:1", buildingId, recipeId, quantity }
  });

describe("instant drug lab production", () => {
  it("keeps the five canonical recipes and their existing economy values", () => {
    const recipes = context.config.balance.drugLab!.recipes;
    expect(Object.keys(recipes)).toEqual([
      "neon-dust",
      "pulse-shot",
      "velvet-smoke",
      "ghost-serum",
      "overdrive-x"
    ]);
    expect(recipes["neon-dust"]).toMatchObject({
      cleanCashCostPerUnit: 500,
      inputCosts: { chemicals: 2 },
      outputAmount: 1
    });
    expect(recipes["overdrive-x"]).toMatchObject({
      cleanCashCostPerUnit: 4_500,
      inputCosts: { "pulse-shot": 1, "velvet-smoke": 2 },
      outputAmount: 1
    });
  });

  it("debits every dependency and stores each finished drug immediately", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("drug_lab", {
      playerBalances: {
        cash: 20_000,
        chemicals: 20,
        biomass: 20,
        "neon-dust": 4,
        "pulse-shot": 4,
        "velvet-smoke": 4,
        "ghost-serum": 0,
        "overdrive-x": 0
      }
    });
    const recipeIds = [
      "neon-dust",
      "pulse-shot",
      "velvet-smoke",
      "ghost-serum",
      "overdrive-x"
    ];
    const finished = recipeIds.reduce((current, recipeId) => {
      const result = applyCommand(current, produce(building.id, recipeId), context);
      expect(result.errors).toEqual([]);
      return result.nextState;
    }, state);

    expect(finished.root.tick).toBe(state.root.tick);
    expect(finished.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 10_800,
      chemicals: 15,
      biomass: 17,
      "neon-dust": 3,
      "pulse-shot": 3,
      "velvet-smoke": 3,
      "ghost-serum": 1,
      "overdrive-x": 1
    });
    expect(finished.buildingsById[building.id]?.productionLines).toBeUndefined();
  });

  it("projects no active timer, queue or collect step", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("drug_lab", {
      playerBalances: { cash: 2_000, chemicals: 10, biomass: 10 }
    });
    const view = createDrugLabProductionBuildingView({
      state,
      building,
      playerId: "player:1",
      config: context.config,
      tickRateMs: context.config.tickRateMs
    })!;

    expect(view.lines.every((line) => line.executionMode === "instant")).toBe(true);
    expect(view.lines.every((line) => line.remainingTicks === 0 && line.queuedAmount === 0)).toBe(true);
    expect(view.lines.every((line) => line.canCollect === false)).toBe(true);
  });

  it("rejects invalid quantity and missing inputs without partial debit", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("drug_lab", {
      playerBalances: { cash: 10_000, chemicals: 1, biomass: 0 }
    });
    const invalid = applyCommand(state, produce(building.id, "neon-dust", 0), context);
    const missing = applyCommand(state, produce(building.id, "pulse-shot", 1), context);

    expect(invalid.errors[0]?.code).toBe("drug_lab_invalid_quantity");
    expect(invalid.nextState).toBe(state);
    expect(missing.errors[0]?.code).toBe("drug_lab_missing_inputs");
    expect(missing.nextState).toBe(state);
  });

  it("settles a paid legacy drug-lab job once and removes the old line", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("drug_lab", {
      playerBalances: { "ghost-serum": 1 },
      buildingOverrides: {
        processing: { recipeId: "ghost-serum", startedAtTick: 3, completesAtTick: 30 }
      }
    });
    const lineMigrated = migrateDrugLabProductionState(state);
    const settled = migrateLegacyProductionToInstantState(lineMigrated, context);

    expect(settled.resourceStatesById["resource:1"]?.balances["ghost-serum"]).toBe(2);
    expect(settled.buildingsById[building.id]?.productionLines).toEqual({});
    expect(migrateLegacyProductionToInstantState(settled, context)).toBe(settled);
  });
});
