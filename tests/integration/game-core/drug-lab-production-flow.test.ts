import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  applyCommand,
  createDrugLabProductionBuildingView,
  migrateDrugLabProductionState,
  runTick
} from "@empire/game-core";
import type { CancelDrugLabProductionCommand, CraftItemCommand } from "@empire/shared-types";
import {
  createCollectProductionCommandFixture,
  createCraftItemCommandFixture
} from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };
const NEON_DURATION_TICKS = Math.ceil(
  context.config.balance.drugLab!.recipes["neon-dust"].durationTicksPerUnit * context.config.balance.cooldownMultiplier
);

const start = (buildingId: string, recipeId: string, quantity: number): CraftItemCommand =>
  createCraftItemCommandFixture({
    id: "command:drug-lab:" + recipeId + ":" + quantity,
    payload: { districtId: "district:1", buildingId, recipeId, quantity }
  });

const cancel = (buildingId: string, recipeId: string): CancelDrugLabProductionCommand => ({
  id: "command:drug-lab:cancel:" + recipeId,
  type: "cancel-drug-lab-production",
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

describe("drug lab production", () => {
  it("uses the canonical five one-piece recipes and strategic component roles", () => {
    const recipes = context.config.balance.drugLab!.recipes;
    expect(recipes["neon-dust"]).toMatchObject({ cleanCashCostPerUnit: 500, inputCosts: { chemicals: 2 }, outputAmount: 1, localOutputCap: 10, queueCap: 8 });
    expect(recipes["pulse-shot"]).toMatchObject({ cleanCashCostPerUnit: 800, inputCosts: { chemicals: 2, biomass: 1 }, outputAmount: 1, localOutputCap: 6, queueCap: 5 });
    expect(recipes["velvet-smoke"]).toMatchObject({ cleanCashCostPerUnit: 900, inputCosts: { chemicals: 1, biomass: 2 }, outputAmount: 1, localOutputCap: 5, queueCap: 4 });
    expect(recipes["ghost-serum"]).toMatchObject({ cleanCashCostPerUnit: 2500, inputCosts: { "neon-dust": 2, "pulse-shot": 1 }, itemRole: "boost-component", directlyUsable: false, outputAmount: 1, localOutputCap: 2, queueCap: 2 });
    expect(recipes["overdrive-x"]).toMatchObject({ cleanCashCostPerUnit: 4500, inputCosts: { "pulse-shot": 1, "velvet-smoke": 2 }, itemRole: "boost-component", directlyUsable: false, outputAmount: 1, localOutputCap: 1, queueCap: 1 });
    expect(NEON_DURATION_TICKS).toBe(5 * Math.ceil(60_000 / context.config.tickRateMs));
    expect(Math.ceil(recipes["overdrive-x"].durationTicksPerUnit * context.config.balance.cooldownMultiplier)).toBe(30 * Math.ceil(60_000 / context.config.tickRateMs));
  });

  it("starts all five independent lines and reserves cash plus materials atomically", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("drug_lab", {
      playerBalances: { cash: 10_000, chemicals: 20, biomass: 20, "neon-dust": 20, "pulse-shot": 20, "velvet-smoke": 20 }
    });
    const neon = applyCommand(state, start(building.id, "neon-dust", 2), context);
    const pulse = applyCommand(neon.nextState, start(building.id, "pulse-shot", 1), context);
    const velvet = applyCommand(pulse.nextState, start(building.id, "velvet-smoke", 1), context);
    const ghost = applyCommand(velvet.nextState, start(building.id, "ghost-serum", 1), context);
    const overdrive = applyCommand(ghost.nextState, start(building.id, "overdrive-x", 1), context);
    const balances = overdrive.nextState.resourceStatesById["resource:1"]!.balances;
    const lines = overdrive.nextState.buildingsById[building.id]!.productionLines!;

    expect(overdrive.errors).toEqual([]);
    expect(balances).toMatchObject({ cash: 300, chemicals: 13, biomass: 17, "neon-dust": 18, "pulse-shot": 18, "velvet-smoke": 18 });
    expect(Object.values(lines).filter((line) => line.activeCompletesAtTick !== null)).toHaveLength(5);
    expect(lines["ghost-serum"]).toMatchObject({ reservedCleanCash: 2500, reservedResourceCosts: { "neon-dust": 2, "pulse-shot": 1 } });
  });

  it("rejects invalid quantities, missing inputs, and queue overflow without mutations", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("drug_lab", {
      playerBalances: { cash: 1000, chemicals: 1 }
    });
    const invalid = applyCommand(state, start(building.id, "neon-dust", 0), context);
    const missing = applyCommand(state, start(building.id, "neon-dust", 1), context);
    const queue = applyCommand(state, start(building.id, "neon-dust", 9), context);

    expect(invalid.errors.map((error) => error.code)).toEqual(["drug_lab_invalid_quantity"]);
    expect(missing.errors.map((error) => error.code)).toEqual(["drug_lab_missing_inputs"]);
    expect(queue.errors.map((error) => error.code)).toEqual(["drug_lab_queue_full"]);
    expect(queue.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({ cash: 1000, chemicals: 1 });
  });

  it("completes exactly one piece and pauses at the local output cap", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("drug_lab", {
      playerBalances: { cash: 5000, chemicals: 20 },
      productionResourceKey: "neon-dust",
      productionStoredAmount: 9
    });
    const started = applyCommand(state, start(building.id, "neon-dust", 3), context);
    const completed = ticks(started.nextState, NEON_DURATION_TICKS);
    const line = completed.buildingsById[building.id]!.productionLines!["neon-dust"]!;

    expect(completed.resourceStatesById["resource:" + building.id]?.balances["neon-dust"]).toBe(10);
    expect(line).toMatchObject({ queuedAmount: 2, activeCompletesAtTick: null });
  });

  it("refunds only waiting costs and keeps the active reservation", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("drug_lab", {
      playerBalances: { cash: 10_000, chemicals: 20, biomass: 20 }
    });
    const started = applyCommand(state, start(building.id, "pulse-shot", 3), context);
    const canceled = applyCommand(started.nextState, cancel(building.id, "pulse-shot"), context);
    const duplicate = applyCommand(canceled.nextState, cancel(building.id, "pulse-shot"), context);

    expect(canceled.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({ cash: 9200, chemicals: 18, biomass: 19 });
    expect(canceled.nextState.buildingsById[building.id]?.productionLines?.["pulse-shot"]).toMatchObject({
      queuedAmount: 1,
      reservedCleanCash: 800,
      reservedResourceCosts: { chemicals: 2, biomass: 1 }
    });
    expect(duplicate.errors.map((error) => error.code)).toEqual(["drug_lab_no_waiting_items"]);
  });

  it("collects only free strategic storage space and resumes a paused line", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("drug_lab", {
      playerBalances: { cash: 0, "ghost-serum": 7 },
      buildingOverrides: {
        productionLines: {
          "ghost-serum": {
            recipeId: "ghost-serum",
            queuedAmount: 1,
            activeStartedAtTick: null,
            activeCompletesAtTick: null,
            reservedCleanCash: 2500,
            reservedResourceCosts: { "neon-dust": 2, "pulse-shot": 1 },
            unitCleanCashCost: 2500,
            unitResourceCosts: { "neon-dust": 2, "pulse-shot": 1 },
            version: 1
          }
        }
      },
      productionResourceKey: "ghost-serum",
      productionStoredAmount: 2
    });
    const collected = applyCommand(state, createCollectProductionCommandFixture({
      payload: { districtId: "district:1", buildingId: building.id, resourceKey: "ghost-serum" }
    }), context);
    const line = collected.nextState.buildingsById[building.id]!.productionLines!["ghost-serum"]!;

    expect(collected.errors).toEqual([]);
    expect(collected.nextState.resourceStatesById["resource:1"]?.balances["ghost-serum"]).toBe(8);
    expect(collected.nextState.resourceStatesById["resource:" + building.id]?.balances["ghost-serum"]).toBe(1);
    expect(line.activeCompletesAtTick).toBeGreaterThan(0);
  });

  it("projects server storage, inputs, roles, and disabled reasons", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("drug_lab", {
      playerBalances: { cash: 2500, "neon-dust": 2, "pulse-shot": 1, "ghost-serum": 7 },
      productionResourceKey: "ghost-serum",
      productionStoredAmount: 2
    });
    const view = createDrugLabProductionBuildingView({
      state,
      building,
      playerId: "player:1",
      config: context.config,
      tickRateMs: context.config.tickRateMs
    });
    const ghost = view!.lines.find((line) => line.recipeId === "ghost-serum")!;
    const overdrive = view!.lines.find((line) => line.recipeId === "overdrive-x")!;

    expect(ghost).toMatchObject({
      itemRole: "boost-component",
      playerStoredAmount: 7,
      playerStoredCapacity: 8,
      producedAmount: 2,
      status: "full",
      canStart: false
    });
    expect(ghost.inputAvailability).toEqual([
      expect.objectContaining({ resourceKey: "neon-dust", requiredAmount: 2, availableAmount: 2 }),
      expect.objectContaining({ resourceKey: "pulse-shot", requiredAmount: 1, availableAmount: 1 })
    ]);
    expect(overdrive).not.toHaveProperty("canUse");
  });

  it("keeps two Labs isolated and migrates a legacy processing job once", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("drug_lab", {
      buildingOverrides: {
        processing: { recipeId: "neon-dust", startedAtTick: 12, completesAtTick: 42 }
      }
    });
    const secondId = building.id + ":second";
    const twoLabs = {
      ...state,
      buildingsById: {
        ...state.buildingsById,
        [secondId]: { ...building, id: secondId, processing: null, productionLines: {} }
      }
    };
    const migrated = migrateDrugLabProductionState(twoLabs);
    const repeated = migrateDrugLabProductionState(migrated);

    expect(migrated.buildingsById[building.id]).toMatchObject({
      processing: null,
      productionLines: {
        "neon-dust": { queuedAmount: 1, activeStartedAtTick: 12, legacyOutputAmount: 2 }
      }
    });
    expect(migrated.buildingsById[secondId]?.productionLines).toEqual({});
    expect(repeated).toBe(migrated);
  });
});
