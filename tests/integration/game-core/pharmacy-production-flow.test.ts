import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  applyCommand,
  createPharmacyProductionBuildingView,
  migrateLegacyProductionToInstantState,
  migratePharmacyProductionState
} from "@empire/game-core";
import type { CraftItemCommand } from "@empire/shared-types";
import {
  createCraftItemCommandFixture,
  createUpgradeBuildingCommandFixture
} from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { advanceProductionUntilIdle } from "../../fixtures/timed-operation-fixtures";

const context = { config: resolveModeConfig("free") };

const produce = (buildingId: string, recipeId: string, quantity: number): CraftItemCommand =>
  createCraftItemCommandFixture({
    id: `command:pharmacy:${recipeId}:${quantity}`,
    payload: { districtId: "district:1", buildingId, recipeId, quantity }
  });

describe("timed pharmacy production", () => {
  it("keeps recipe balance values while treating historical duration and queue values as legacy metadata", () => {
    const pharmacy = context.config.balance.pharmacy!;
    expect(pharmacy.recipes.chemicals).toMatchObject({
      cleanCashCostPerUnit: 360,
      outputAmount: 1,
      inputCosts: {}
    });
    expect(pharmacy.recipes.biomass).toMatchObject({
      cleanCashCostPerUnit: 420,
      outputAmount: 1,
      inputCosts: {}
    });
    expect(pharmacy.recipes["stim-pack"]).toMatchObject({
      cleanCashCostPerUnit: 800,
      outputAmount: 1,
      inputCosts: {}
    });
  });

  it("reserves all recipes immediately and stores their outputs only after their timers", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { cash: 10_000, chemicals: 0, biomass: 0, "stim-pack": 0 }
    });
    const chemicals = applyCommand(state, produce(building.id, "chemicals", 5), context);
    const biomass = applyCommand(chemicals.nextState, produce(building.id, "biomass", 3), context);
    const stimPack = applyCommand(biomass.nextState, produce(building.id, "stim-pack", 2), context);
    let completed = stimPack.nextState;
    for (const recipeId of ["chemicals", "biomass", "stim-pack"]) {
      completed = advanceProductionUntilIdle(completed, building.id, recipeId, context);
    }

    expect(stimPack.errors).toEqual([]);
    expect(stimPack.nextState.root.tick).toBe(state.root.tick);
    expect(stimPack.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 5_340,
      chemicals: 0,
      biomass: 0,
      "stim-pack": 0
    });
    expect(completed.resourceStatesById["resource:1"]?.balances).toMatchObject({
      chemicals: 0,
      biomass: 0,
      "stim-pack": 0
    });
    expect(completed.resourceStatesById[`resource:${building.id}`]?.balances).toMatchObject({
      chemicals: 5,
      biomass: 3,
      "stim-pack": 2
    });
    expect(stimPack.nextState.buildingsById[building.id]?.processing).toBeNull();
  });

  it("projects the timed, collect-free production surface", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { cash: 2_000, chemicals: 4 }
    });
    const view = createPharmacyProductionBuildingView({
      state,
      building,
      playerId: "player:1",
      config: context.config,
      tickRateMs: context.config.tickRateMs
    })!;

    expect(view.lines).toHaveLength(3);
    expect(view.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recipeId: "chemicals",
        executionMode: "legacy-timed",
        queuedAmount: 0,
        waitingAmount: 0,
        remainingTicks: 0,
        canCollect: false
      })
    ]));
  });

  it("reserves a full-storage job without overflowing output when it becomes due", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      productionResourceKey: "chemicals",
      productionStoredAmount: 12,
      playerBalances: { cash: 360, chemicals: 0 }
    });
    const started = applyCommand(state, produce(building.id, "chemicals", 1), context);
    const dueTick = started.nextState.buildingsById[building.id]?.productionLines?.chemicals?.activeCompletesAtTick;
    const completed = advanceProductionUntilIdle(started.nextState, building.id, "chemicals", context);

    expect(started.errors).toEqual([]);
    expect(started.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({ cash: 0, chemicals: 0 });
    expect(completed.resourceStatesById[`resource:${building.id}`]?.balances.chemicals).toBe(12);
    expect(completed.buildingsById[building.id]?.productionLines?.chemicals).toMatchObject({
      queuedAmount: 1,
      activeCompletesAtTick: dueTick
    });
    expect(completed.root.tick).toBe(dueTick);
  });

  it("applies an upgrade immediately and uses it for the next timed production", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { cash: 5_000, chemicals: 0 }
    });
    const upgraded = applyCommand(state, createUpgradeBuildingCommandFixture({
      payload: { districtId: "district:1", buildingId: building.id }
    }), context);
    const produced = applyCommand(upgraded.nextState, produce(building.id, "chemicals", 1), context);
    const completed = advanceProductionUntilIdle(produced.nextState, building.id, "chemicals", context);

    expect(upgraded.errors).toEqual([]);
    expect(upgraded.nextState.root.tick).toBe(state.root.tick);
    expect(upgraded.nextState.buildingsById[building.id]?.level).toBe(2);
    expect(produced.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 1_440,
      chemicals: 0
    });
    expect(completed.resourceStatesById[`resource:${building.id}`]?.balances.chemicals).toBe(1);
  });

  it("settles a paid legacy processing job into storage exactly once", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { "stim-pack": 2 },
      buildingOverrides: {
        processing: { recipeId: "stim-pack", startedAtTick: 12, completesAtTick: 132 }
      }
    });
    const lineMigrated = migratePharmacyProductionState(state);
    const settled = migrateLegacyProductionToInstantState(lineMigrated, context);
    const repeated = migrateLegacyProductionToInstantState(settled, context);

    expect(settled.resourceStatesById["resource:1"]?.balances["stim-pack"]).toBe(3);
    expect(settled.buildingsById[building.id]?.processing).toBeNull();
    expect(settled.buildingsById[building.id]?.productionLines).toEqual({});
    expect(repeated).toBe(settled);
  });
});
