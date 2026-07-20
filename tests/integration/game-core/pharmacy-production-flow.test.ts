import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  applyCommand,
  createPharmacyProductionBuildingView,
  migratePharmacyProductionState,
  runTick
} from "@empire/game-core";
import type { CancelPharmacyProductionCommand, CraftItemCommand } from "@empire/shared-types";
import {
  createCollectProductionCommandFixture,
  createCraftItemCommandFixture,
  createUpgradeBuildingCommandFixture
} from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };
const CHEMICAL_DURATION_TICKS = Math.ceil(
  context.config.balance.pharmacy!.recipes.chemicals.durationTicksPerUnit * context.config.balance.cooldownMultiplier
);
const STIM_PACK_DURATION_TICKS = Math.ceil(
  context.config.balance.pharmacy!.recipes["stim-pack"].durationTicksPerUnit * context.config.balance.cooldownMultiplier
);

const start = (buildingId: string, recipeId: string, quantity: number): CraftItemCommand =>
  createCraftItemCommandFixture({
    id: "command:pharmacy:" + recipeId + ":" + quantity,
    payload: { districtId: "district:1", buildingId, recipeId, quantity }
  });

const cancel = (buildingId: string, recipeId: string): CancelPharmacyProductionCommand => ({
  id: "command:pharmacy:cancel:" + recipeId,
  type: "cancel-pharmacy-production",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  clientRequestId: null,
  payload: { districtId: "district:1", buildingId, recipeId }
});

const ticks = (state: ReturnType<typeof createCoreStateWithFixedBuildingFixture>["state"], count: number) => {
  let next = state;
  for (let index = 0; index < count; index += 1) next = runTick(next, context).nextState;
  return next;
};

describe("pharmacy production", () => {
  it("uses the canonical clean-cash-only recipes", () => {
    const pharmacy = context.config.balance.pharmacy!;
    expect(pharmacy.independentProductionLines).toBe(true);
    expect(pharmacy.recipes.chemicals).toMatchObject({ cleanCashCostPerUnit: 360, outputAmount: 1, localOutputCap: 12, queueCap: 15, inputCosts: {} });
    expect(pharmacy.recipes.biomass).toMatchObject({ cleanCashCostPerUnit: 420, outputAmount: 1, localOutputCap: 8, queueCap: 11, inputCosts: {} });
    expect(pharmacy.recipes["stim-pack"]).toMatchObject({ cleanCashCostPerUnit: 800, outputAmount: 1, localOutputCap: 4, queueCap: 7, inputCosts: {} });
    expect(CHEMICAL_DURATION_TICKS).toBe(2 * Math.ceil(60_000 / context.config.tickRateMs));
    expect(Math.ceil(pharmacy.recipes.biomass.durationTicksPerUnit * context.config.balance.cooldownMultiplier)).toBe(4 * Math.ceil(60_000 / context.config.tickRateMs));
    expect(STIM_PACK_DURATION_TICKS).toBe(10 * Math.ceil(60_000 / context.config.tickRateMs));
  });

  it("runs three independent lines and charges the complete clean-cash reservation once", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { cash: 10_000, chemicals: 0, biomass: 0, "stim-pack": 0 }
    });
    const chemicals = applyCommand(state, start(building.id, "chemicals", 5), context);
    const biomass = applyCommand(chemicals.nextState, start(building.id, "biomass", 3), context);
    const stimPack = applyCommand(biomass.nextState, start(building.id, "stim-pack", 2), context);
    const lines = stimPack.nextState.buildingsById[building.id]!.productionLines!;

    expect(stimPack.errors).toEqual([]);
    expect(stimPack.nextState.resourceStatesById["resource:1"]?.balances.cash).toBe(5340);
    expect(lines.chemicals).toMatchObject({ queuedAmount: 5, activeStartedAtTick: 0, reservedCleanCash: 1800 });
    expect(lines.biomass).toMatchObject({ queuedAmount: 3, activeStartedAtTick: 0, reservedCleanCash: 1260 });
    expect(lines["stim-pack"]).toMatchObject({ queuedAmount: 2, activeStartedAtTick: 0, reservedCleanCash: 1600 });
  });

  it("completes one piece, starts the next one, and pauses instead of overflowing the local output", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { cash: 5000 },
      productionResourceKey: "chemicals",
      productionStoredAmount: 11
    });
    const started = applyCommand(state, start(building.id, "chemicals", 5), context);
    const completed = ticks(started.nextState, CHEMICAL_DURATION_TICKS);
    const line = completed.buildingsById[building.id]!.productionLines!.chemicals!;

    expect(completed.resourceStatesById["resource:" + building.id]?.balances.chemicals).toBe(12);
    expect(line.queuedAmount).toBe(4);
    expect(line.activeCompletesAtTick).toBeNull();
  });

  it("cancels only waiting pieces and refunds their reserved clean cash exactly once", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { cash: 5000 }
    });
    const started = applyCommand(state, start(building.id, "stim-pack", 3), context);
    const canceled = applyCommand(started.nextState, cancel(building.id, "stim-pack"), context);
    const line = canceled.nextState.buildingsById[building.id]!.productionLines!["stim-pack"]!;
    const duplicate = applyCommand(canceled.nextState, cancel(building.id, "stim-pack"), context);

    expect(canceled.nextState.resourceStatesById["resource:1"]?.balances.cash).toBe(4200);
    expect(line).toMatchObject({ queuedAmount: 1, reservedCleanCash: 800, activeStartedAtTick: 0 });
    expect(duplicate.errors.map((error) => error.code)).toEqual(["pharmacy_no_waiting_items"]);
    expect(duplicate.nextState).toBe(canceled.nextState);
  });

  it("collects only the available global storage and resumes a paused line", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { cash: 0, chemicals: 58 },
      buildingOverrides: {
        productionLines: {
          chemicals: {
            recipeId: "chemicals",
            queuedAmount: 3,
            activeStartedAtTick: null,
            activeCompletesAtTick: null,
            reservedCleanCash: 1080,
            unitCleanCashCost: 360,
            version: 1
          }
        }
      },
      productionResourceKey: "chemicals",
      productionStoredAmount: 12
    });
    const collected = applyCommand(state, createCollectProductionCommandFixture({
      payload: { districtId: "district:1", buildingId: building.id, resourceKey: "chemicals" }
    }), context);
    const line = collected.nextState.buildingsById[building.id]!.productionLines!.chemicals!;

    expect(collected.errors).toEqual([]);
    expect(collected.nextState.resourceStatesById["resource:1"]?.balances.chemicals).toBe(60);
    expect(collected.nextState.resourceStatesById["resource:" + building.id]?.balances.chemicals).toBe(10);
    expect(line.queuedAmount).toBe(3);
    expect(line.activeStartedAtTick).toBe(0);
    expect(line.activeCompletesAtTick).toBe(CHEMICAL_DURATION_TICKS);
  });

  it("projects server-authored local amounts, queue limits, durations, and disabled states", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { cash: 360 },
      productionResourceKey: "chemicals",
      productionStoredAmount: 12
    });
    const view = createPharmacyProductionBuildingView({
      state,
      building,
      playerId: "player:1",
      config: context.config,
      tickRateMs: context.config.tickRateMs
    });
    const chemicals = view!.lines.find((line) => line.recipeId === "chemicals")!;
    const stimPack = view!.lines.find((line) => line.recipeId === "stim-pack")!;

    expect(chemicals).toMatchObject({
      producedAmount: 12,
      producedCapacity: 12,
      queueCapacity: 15,
      status: "full",
      canStart: false,
      maxStartQuantity: 0
    });
    expect(stimPack).toMatchObject({
      unitCleanCashCost: 800,
      effectiveUnitDurationTicks: STIM_PACK_DURATION_TICKS,
      queueCapacity: 7,
      status: "ready",
      canStart: false
    });
  });

  it("keeps the existing server upgrade cost and applies its speed modifier to each line", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      playerBalances: { cash: 5000 }
    });
    const upgraded = applyCommand(state, createUpgradeBuildingCommandFixture({
      payload: { districtId: "district:1", buildingId: building.id }
    }), context);
    const started = applyCommand(upgraded.nextState, start(building.id, "chemicals", 1), context);

    expect(upgraded.errors).toEqual([]);
    expect(upgraded.nextState.buildingsById[building.id]?.level).toBe(2);
    expect(upgraded.nextState.resourceStatesById["resource:1"]?.balances.cash).toBe(1800);
    expect(started.nextState.buildingsById[building.id]?.productionLines?.chemicals?.activeCompletesAtTick).toBe(
      Math.ceil(CHEMICAL_DURATION_TICKS / 1.1)
    );
  });

  it("rejects invalid quantities and full queues without changing cash or line state", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", { playerBalances: { cash: 5000 } });
    const zero = applyCommand(state, start(building.id, "chemicals", 0), context);
    const tooMany = applyCommand(state, start(building.id, "chemicals", 16), context);

    expect(zero.errors.map((error) => error.code)).toEqual(["pharmacy_invalid_quantity"]);
    expect(tooMany.errors.map((error) => error.code)).toEqual(["pharmacy_queue_full"]);
    expect(tooMany.nextState.resourceStatesById["resource:1"]?.balances.cash).toBe(5000);
  });

  it("migrates an old pharmacy processing job once without charging or duplicating it", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("pharmacy", {
      buildingOverrides: {
        processing: {
          recipeId: "stim-pack",
          startedAtTick: 12,
          completesAtTick: 132
        }
      }
    });
    const migrated = migratePharmacyProductionState(state);
    const repeated = migratePharmacyProductionState(migrated);

    expect(migrated.buildingsById[building.id]).toMatchObject({
      processing: null,
      productionLines: {
        "stim-pack": {
          queuedAmount: 1,
          activeStartedAtTick: 12,
          activeCompletesAtTick: 132,
          reservedCleanCash: 0
        }
      }
    });
    expect(repeated).toBe(migrated);
  });
});
