import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  applyCommand,
  createFactoryProductionBuildingView,
  createPlayerView,
  migrateFactoryProductionState,
  resolveActiveFactoryCount,
  resolveFactoryNetworkSpeedMultiplier,
  runTick
} from "@empire/game-core";
import type { CancelProductionLineCommand, CraftItemCommand } from "@empire/shared-types";
import { createCollectProductionCommandFixture, createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };
const factory = context.config.balance.factory!;
const metalDuration = Math.ceil(factory.recipes["metal-parts"].durationTicksPerUnit * context.config.balance.cooldownMultiplier);

const start = (buildingId: string, recipeId: string, quantity: number): CraftItemCommand =>
  createCraftItemCommandFixture({
    id: "command:factory:" + recipeId + ":" + quantity,
    payload: { districtId: "district:1", buildingId, recipeId, quantity }
  });

const cancel = (buildingId: string, recipeId: string): CancelProductionLineCommand => ({
  id: "command:factory:cancel:" + recipeId,
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

describe("factory production", () => {
  it("uses the canonical one-piece recipes, costs, timings and caps", () => {
    expect(factory.recipes["metal-parts"]).toMatchObject({ cleanCashCostPerUnit: 300, inputCosts: {}, outputAmount: 1, localOutputCap: 10, queueCap: 13 });
    expect(factory.recipes["tech-core"]).toMatchObject({ cleanCashCostPerUnit: 900, inputCosts: { "metal-parts": 4 }, outputAmount: 1, localOutputCap: 5, queueCap: 8 });
    expect(factory.recipes["combat-module"]).toMatchObject({ cleanCashCostPerUnit: 2500, inputCosts: { "metal-parts": 4, "tech-core": 2 }, outputAmount: 1, localOutputCap: 2, queueCap: 5 });
    expect(metalDuration).toBe(4 * Math.ceil(60_000 / context.config.tickRateMs));
  });

  it("exposes an owned active Factory through the player read model for the global Factory shortcut", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory");
    const playerView = createPlayerView(state, "player:1", context);

    expect(playerView.factoryProduction).toMatchObject({
      buildingId: building.id,
      districtId: building.districtId,
      buildingTypeId: "factory"
    });
    expect(playerView.factoryProduction?.productionLines).toHaveLength(3);
    expect(playerView.factoryProduction?.productionLines.find((line) => line.recipeId === "metal-parts")).toMatchObject({
      canStart: true,
      maxStartQuantity: 3
    });
  });

  it("keeps a legacy neutral Factory in an owned district usable and repairs its owner on start", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory");
    const legacyState = {
      ...state,
      buildingsById: {
        ...state.buildingsById,
        [building.id]: { ...building, ownerPlayerId: "player:neutral" }
      }
    };
    const playerView = createPlayerView(legacyState, "player:1", context);
    const started = applyCommand(legacyState, start(building.id, "metal-parts", 1), context);

    expect(playerView.factoryProduction?.productionLines.find((line) => line.recipeId === "metal-parts")?.canStart).toBe(true);
    expect(started.errors).toEqual([]);
    expect(started.nextState.buildingsById[building.id]?.ownerPlayerId).toBe("player:1");
  });

  it("starts all three independent lines and reserves exact clean cash plus materials", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 12_000, "metal-parts": 20, "tech-core": 10 }
    });
    const metal = applyCommand(state, start(building.id, "metal-parts", 5), context);
    const tech = applyCommand(metal.nextState, start(building.id, "tech-core", 3), context);
    const combat = applyCommand(tech.nextState, start(building.id, "combat-module", 2), context);

    expect(combat.errors).toEqual([]);
    expect(combat.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({
      cash: 2800,
      "metal-parts": 0,
      "tech-core": 6
    });
    expect(Object.values(combat.nextState.buildingsById[building.id]!.productionLines!).filter((line) => line.activeCompletesAtTick !== null)).toHaveLength(3);
  });

  it("rejects invalid, overflowing, and unaffordable starts atomically", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 100, "metal-parts": 3 }
    });
    expect(applyCommand(state, start(building.id, "metal-parts", 0), context).errors[0]?.code).toBe("factory_invalid_quantity");
    expect(applyCommand(state, start(building.id, "metal-parts", 14), context).errors[0]?.code).toBe("factory_queue_full");
    const missing = applyCommand(state, start(building.id, "tech-core", 1), context);
    expect(missing.errors[0]?.code).toBe("factory_insufficient_clean_cash");
    expect(missing.nextState).toBe(state);
  });

  it("completes one piece at a time, pauses at cap, and resumes after collect", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 5000 },
      productionResourceKey: "metal-parts",
      productionStoredAmount: 9
    });
    const started = applyCommand(state, start(building.id, "metal-parts", 4), context);
    const completed = ticks(started.nextState, metalDuration);
    expect(completed.resourceStatesById["resource:" + building.id]?.balances["metal-parts"]).toBe(10);
    expect(completed.buildingsById[building.id]?.productionLines?.["metal-parts"]).toMatchObject({ queuedAmount: 3, activeCompletesAtTick: null });
    const collected = applyCommand(completed, createCollectProductionCommandFixture({
      payload: { districtId: "district:1", buildingId: building.id, resourceKey: "metal-parts" }
    }), context);
    expect(collected.nextState.buildingsById[building.id]?.productionLines?.["metal-parts"]).toMatchObject({ queuedAmount: 3, activeCompletesAtTick: expect.any(Number) });
  });

  it("catches up elapsed Factory time deterministically without exceeding paid queue", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 5000 }
    });
    const started = applyCommand(state, start(building.id, "metal-parts", 4), context).nextState;
    const delayed = {
      ...started,
      root: { ...started.root, tick: started.root.tick + metalDuration * 3 - 1 },
      serverInstance: { ...started.serverInstance, currentTick: started.serverInstance.currentTick + metalDuration * 3 - 1 }
    };
    const caughtUp = runTick(delayed, context).nextState;
    expect(caughtUp.resourceStatesById["resource:" + building.id]?.balances["metal-parts"]).toBe(3);
    expect(caughtUp.buildingsById[building.id]?.productionLines?.["metal-parts"]).toMatchObject({ queuedAmount: 1, activeCompletesAtTick: expect.any(Number) });
  });

  it("refunds only waiting reservations and does not duplicate a cancel refund", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 10_000, "metal-parts": 20 }
    });
    const started = applyCommand(state, start(building.id, "tech-core", 3), context);
    const canceled = applyCommand(started.nextState, cancel(building.id, "tech-core"), context);
    const duplicate = applyCommand(canceled.nextState, cancel(building.id, "tech-core"), context);

    expect(canceled.nextState.resourceStatesById["resource:1"]?.balances).toMatchObject({ cash: 9100, "metal-parts": 16 });
    expect(canceled.nextState.buildingsById[building.id]?.productionLines?.["tech-core"]).toMatchObject({ queuedAmount: 1, reservedCleanCash: 900, reservedResourceCosts: { "metal-parts": 4 } });
    expect(duplicate.errors[0]?.code).toBe("factory_no_waiting_items");
  });

  it("uses canonical storage groups for partial collect and network speed bands", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 0, "combat-module": 7 },
      productionResourceKey: "combat-module",
      productionStoredAmount: 2
    });
    const collected = applyCommand(state, createCollectProductionCommandFixture({
      payload: { districtId: "district:1", buildingId: building.id, resourceKey: "combat-module" }
    }), context);
    expect(collected.nextState.resourceStatesById["resource:1"]?.balances["combat-module"]).toBe(8);
    expect(collected.nextState.resourceStatesById["resource:" + building.id]?.balances["combat-module"]).toBe(1);
    expect([1, 2, 3, 4, 5, 9].map((count) => resolveFactoryNetworkSpeedMultiplier(count, factory))).toEqual([1, 1.1, 1.2, 1.3, 1.3, 1.3]);
  });

  it("counts only active owned Factories for network speed", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory");
    const activeSecond = { ...building, id: building.id + ":second", status: "active" as const };
    const disabled = { ...building, id: building.id + ":disabled", status: "disabled" as const };
    const foreign = { ...building, id: building.id + ":foreign", ownerPlayerId: "player:other", status: "active" as const };
    const networkState = {
      ...state,
      buildingsById: {
        ...state.buildingsById,
        [activeSecond.id]: activeSecond,
        [disabled.id]: disabled,
        [foreign.id]: foreign
      }
    };
    expect(resolveActiveFactoryCount(networkState, "player:1")).toBe(2);
  });

  it("projects local caps, network values, and server start limits", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 1800, "metal-parts": 8 },
      productionResourceKey: "tech-core",
      productionStoredAmount: 5
    });
    const view = createFactoryProductionBuildingView({
      state,
      building,
      playerId: "player:1",
      config: context.config,
      tickRateMs: context.config.tickRateMs
    })!;
    expect(view.network).toMatchObject({ activeFactoryCount: 1, networkSpeedMultiplier: 1 });
    expect(view.producedSummary).toContainEqual(expect.objectContaining({ resourceKey: "tech-core", currentAmount: 5, capacity: 5, isFull: true }));
    expect(view.productionLines.find((line) => line.recipeId === "metal-parts")).toMatchObject({ maxStartQuantity: 6, queueCapacity: 13 });
    expect(view.productionLines.find((line) => line.recipeId === "tech-core")).toMatchObject({ status: "full", canStart: false });
  });

  it("migrates one legacy Factory processing job exactly once", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      buildingOverrides: { processing: { recipeId: "tech-core", startedAtTick: 12, completesAtTick: 42 } }
    });
    const migrated = migrateFactoryProductionState(state);
    expect(migrated.buildingsById[building.id]).toMatchObject({
      processing: null,
      productionLines: { "tech-core": { queuedAmount: 1, activeStartedAtTick: 12, reservedCleanCash: 0 } }
    });
    expect(migrateFactoryProductionState(migrated)).toBe(migrated);
  });

  it("keeps legacy queues above the new cap intact while blocking new starts", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      playerBalances: { cash: 5000 },
      buildingOverrides: {
        productionLines: {
          "metal-parts": {
            recipeId: "metal-parts",
            queuedAmount: 14,
            activeStartedAtTick: null,
            activeCompletesAtTick: null,
            reservedCleanCash: 4200,
            reservedResourceCosts: {},
            unitCleanCashCost: 300,
            unitResourceCosts: {},
            version: 1
          }
        }
      }
    });
    const rejected = applyCommand(state, start(building.id, "metal-parts", 1), context);
    expect(rejected.errors[0]?.code).toBe("factory_queue_full");
    expect(rejected.nextState.buildingsById[building.id]?.productionLines?.["metal-parts"]?.queuedAmount).toBe(14);
  });
});
