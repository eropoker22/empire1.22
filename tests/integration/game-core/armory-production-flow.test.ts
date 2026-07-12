import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  applyCommand,
  createArmoryProductionBuildingView,
  migrateArmoryProductionState,
  resolveActiveArmoryCount,
  resolveArmoryNetworkSpeedMultiplier,
  runTick
} from "@empire/game-core";
import type { CancelProductionLineCommand, CraftItemCommand } from "@empire/shared-types";
import { createCollectProductionCommandFixture, createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };
const armory = context.config.balance.armory!;
const batDuration = Math.ceil(armory.recipes["baseball-bat"].durationTicksPerUnit * context.config.balance.cooldownMultiplier);

const start = (buildingId: string, recipeId: string, quantity: number): CraftItemCommand =>
  createCraftItemCommandFixture({
    id: "command:armory:" + recipeId + ":" + quantity,
    payload: { districtId: "district:1", buildingId, recipeId, quantity }
  });

const cancel = (buildingId: string, recipeId: string): CancelProductionLineCommand => ({
  id: "command:armory:cancel:" + recipeId,
  type: "cancel-production-line",
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

describe("armory production", () => {
  it("uses ten canonical one-piece recipes with only Metal Parts and Tech Core", () => {
    expect(Object.keys(armory.recipes)).toHaveLength(10);
    expect(armory.recipes["baseball-bat"]).toMatchObject({ category: "attack", cleanCashCostPerUnit: 0, inputCosts: { "metal-parts": 2 }, outputAmount: 1, localOutputCap: 8, queueCap: 6 });
    expect(armory.recipes.pistol).toMatchObject({ inputCosts: { "metal-parts": 3, "tech-core": 1 }, durationTicksPerUnit: 75, localOutputCap: 5, queueCap: 4 });
    expect(armory.recipes.grenade).toMatchObject({ inputCosts: { "metal-parts": 2, "tech-core": 1 }, localOutputCap: 4, queueCap: 4 });
    expect(armory.recipes.smg).toMatchObject({ inputCosts: { "metal-parts": 5, "tech-core": 2 }, localOutputCap: 3, queueCap: 3 });
    expect(armory.recipes.bazooka).toMatchObject({ inputCosts: { "metal-parts": 7, "tech-core": 3 }, localOutputCap: 2, queueCap: 2 });
    expect(armory.recipes.vest).toMatchObject({ category: "defense", inputCosts: { "metal-parts": 3, "tech-core": 1 }, localOutputCap: 5, queueCap: 4 });
    expect(armory.recipes.barricades).toMatchObject({ inputCosts: { "metal-parts": 4 }, localOutputCap: 6, queueCap: 5 });
    expect(armory.recipes.cameras).toMatchObject({ inputCosts: { "metal-parts": 2, "tech-core": 2 }, durationTicksPerUnit: 90, localOutputCap: 4, queueCap: 4 });
    expect(armory.recipes["defense-tower"]).toMatchObject({ inputCosts: { "metal-parts": 8, "tech-core": 3 }, durationTicksPerUnit: 225, localOutputCap: 2, queueCap: 2 });
    expect(armory.recipes.alarm).toMatchObject({ inputCosts: { "metal-parts": 2, "tech-core": 1 }, localOutputCap: 4, queueCap: 4 });
  });

  it("starts all ten independent lines and reserves only exact materials", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { cash: 5000, "metal-parts": 50, "tech-core": 20 }
    });
    const queued = Object.keys(armory.recipes).reduce(
      (current, recipeId) => applyCommand(current, start(building.id, recipeId, 1), context).nextState,
      state
    );
    expect(queued.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 5000,
      "metal-parts": 12,
      "tech-core": 6
    });
    expect(Object.values(queued.buildingsById[building.id]!.productionLines!).filter((line) => line.activeCompletesAtTick !== null)).toHaveLength(10);
  });

  it("rejects invalid, overflowing and underfunded material starts atomically", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { "metal-parts": 2, "tech-core": 0 }
    });
    expect(applyCommand(state, start(building.id, "baseball-bat", 0), context).errors[0]?.code).toBe("armory_invalid_quantity");
    expect(applyCommand(state, start(building.id, "baseball-bat", 7), context).errors[0]?.code).toBe("armory_queue_full");
    const missing = applyCommand(state, start(building.id, "pistol", 1), context);
    expect(missing.errors[0]?.code).toBe("armory_missing_inputs");
    expect(missing.nextState).toBe(state);
  });

  it("completes one piece at a time, pauses at cap, and resumes after partial collect", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { "metal-parts": 20 },
      productionResourceKey: "baseball-bat",
      productionStoredAmount: 7
    });
    const started = applyCommand(state, start(building.id, "baseball-bat", 3), context);
    const completed = ticks(started.nextState, batDuration);
    expect(completed.resourceStatesById["resource:" + building.id]?.balances["baseball-bat"]).toBe(8);
    expect(completed.buildingsById[building.id]?.productionLines?.["baseball-bat"]).toMatchObject({ queuedAmount: 2, activeCompletesAtTick: null });
    const collected = applyCommand(completed, createCollectProductionCommandFixture({
      payload: { districtId: "district:1", buildingId: building.id, resourceKey: "baseball-bat" }
    }), context);
    expect(collected.nextState.buildingsById[building.id]?.productionLines?.["baseball-bat"]?.activeCompletesAtTick).toBeGreaterThan(0);
  });

  it("refunds exactly the waiting material reservation and never twice", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { "metal-parts": 20, "tech-core": 10 }
    });
    const started = applyCommand(state, start(building.id, "pistol", 4), context);
    const canceled = applyCommand(started.nextState, cancel(building.id, "pistol"), context);
    const duplicate = applyCommand(canceled.nextState, cancel(building.id, "pistol"), context);
    expect(canceled.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({ "metal-parts": 17, "tech-core": 9 });
    expect(canceled.nextState.buildingsById[building.id]?.productionLines?.pistol).toMatchObject({
      queuedAmount: 1,
      reservedResourceCosts: { "metal-parts": 3, "tech-core": 1 }
    });
    expect(duplicate.errors[0]?.code).toBe("armory_no_waiting_items");
  });

  it("uses canonical storage groups and preserves the local remainder on partial collect", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { bazooka: 7 },
      productionResourceKey: "bazooka",
      productionStoredAmount: 2
    });
    const collected = applyCommand(state, createCollectProductionCommandFixture({
      payload: { districtId: "district:1", buildingId: building.id, resourceKey: "bazooka" }
    }), context);
    expect(collected.nextState.resourceStatesById["resource:1"]?.balances.bazooka).toBe(8);
    expect(collected.nextState.resourceStatesById["resource:" + building.id]?.balances.bazooka).toBe(1);
  });

  it("counts only active owned Armories, projects server limits, and keeps caps fixed", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { "metal-parts": 12, "tech-core": 3 },
      productionResourceKey: "pistol",
      productionStoredAmount: 5
    });
    const activeSecond = { ...building, id: building.id + ":second", status: "active" as const };
    const disabled = { ...building, id: building.id + ":disabled", status: "disabled" as const };
    const foreign = { ...building, id: building.id + ":foreign", ownerPlayerId: "player:other", status: "active" as const };
    const networkState = { ...state, buildingsById: { ...state.buildingsById, [activeSecond.id]: activeSecond, [disabled.id]: disabled, [foreign.id]: foreign } };
    expect(resolveActiveArmoryCount(networkState, "player:1")).toBe(2);
    expect([1, 2, 3, 4, 5].map((count) => resolveArmoryNetworkSpeedMultiplier(count, armory))).toEqual([1, 1.1, 1.2, 1.3, 1.3]);
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
      producedAmount: 5,
      producedCapacity: 5,
      playerStoredCapacity: 24,
      status: "full",
      canStart: false
    });
  });

  it("migrates an old generic processing job exactly once and retains legacy output only for that job", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      buildingOverrides: { processing: { recipeId: "pistol", startedAtTick: 12, completesAtTick: 42 } }
    });
    const migrated = migrateArmoryProductionState(state);
    expect(migrated.buildingsById[building.id]).toMatchObject({
      processing: null,
      productionLines: { pistol: { queuedAmount: 1, activeStartedAtTick: 12, legacyOutputAmount: 2 } }
    });
    expect(migrateArmoryProductionState(migrated)).toBe(migrated);
  });
});
