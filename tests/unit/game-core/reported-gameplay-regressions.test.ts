import type { GameCoreContext } from "../../../packages/game-core/src/engine/context";
import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, createPlayerView } from "@empire/game-core";
import { completePendingDistrictActions } from "../../../packages/game-core/src/handlers/completePendingDistrictActions";
import { resolveProductionLineDurationTicks } from "../../../packages/game-core/src/handlers/productionLineShared";
import { resolveFactoryDurationTicks } from "../../../packages/game-core/src/handlers/factoryProductionShared";
import { createCombatStateFixture, createCoreStateWithFixedBuildingFixture, createFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { createSpyDistrictCommandFixture, createCraftItemCommandFixture } from "../../fixtures/command-fixtures";
import { createTimedFactoryProductionBuildingView } from "../../../packages/game-core/src/projections/timed-production-projections";
import { completeFactoryProduction } from "../../../packages/game-core/src/rules/production/completeFactoryProduction";
import { resolvePowerStationInfrastructureMultiplier } from "../../../packages/game-core/src/handlers/powerStationBuildingActions";
import { retimeProductionSupport } from "../../../packages/game-core/src/rules/production/productionSpeedModifiers";

const config = resolveModeConfig("free");
const context = { config };

describe("reported gameplay regressions", () => {
  it("returns every non-captured spy at resolution, including the player topbar projection", () => {
    const outcomes = new Set();
    for (let seed = 1; seed <= 150; seed++) {
      const state = createCombatStateFixture();
      state.serverInstance.worldSeed = String(seed);
      state.notificationsById = {};
      state.root.notificationIds = [];
      const started = applyCommand(state, createSpyDistrictCommandFixture(), context);
      expect(started.errors).toEqual([]);
      const op = Object.values(started.nextState.pendingDistrictActionOperationsById!)[0]!;
      const due = { ...started.nextState, root: { ...started.nextState.root, tick: op.resolveAtTick } };
      const completed = completePendingDistrictActions(due, context).nextState;
      const report = completed.notificationsById["notification:command:spy:1:spy-report"]!;
      const outcome = String(report.payload.result);
      outcomes.add(outcome);
      const slots = createPlayerView(completed, "player:1", context).spySlots!;
      const assigned = slots.find((slot) => slot.slotId === op.spySlotId)!;
      expect(assigned.available).toBe(outcome !== "critical_failed");
      expect(slots.filter((slot) => slot.available)).toHaveLength(outcome === "critical_failed" ? 1 : 2);
      expect(Number(report.payload.cooldownEndsAtTick)).toBe(assigned.availableAtTick);
      if (outcome !== "critical_failed") expect(assigned.availableAtTick).toBe(op.resolveAtTick);
      if (outcomes.size === 4) break;
    }
    expect(outcomes).toEqual(new Set(["success", "partial", "failed", "critical_failed"]));
  });

  it("combines faction production speed with the upgraded level in the authoritative timer", () => {
    for (const type of ["factory", "drug_lab"] as const) {
      const { state, building } = createCoreStateWithFixedBuildingFixture(type);
      const factionContext = { config: { ...config, balance: { ...config.balance, factions: {
        ...config.balance.factions!,
        mafian: { ...config.balance.factions!.mafian!, passiveModifiers: { techProductionMultiplier: 1.25, illegalProductionMultiplier: 1.25 } }
      } } } };
      const neutralContext = { config: { ...config, balance: { ...config.balance, factions: {
        ...config.balance.factions!, mafian: { ...config.balance.factions!.mafian!, passiveModifiers: {} }
      } } } };
      const duration = (level: number, ctx: GameCoreContext) => type === "factory"
        ? resolveFactoryDurationTicks(state, { ...building, level }, config.balance.factory!.recipes["tech-core"], ctx)
        : resolveProductionLineDurationTicks(state, { ...building, level }, config.balance.drugLab!.recipes["neon-dust"], ctx);
      const base = duration(1, neutralContext);
      const faction = duration(1, factionContext);
      const upgraded = duration(2, neutralContext);
      const combined = duration(2, factionContext);
      expect(faction).toBeLessThan(base);
      expect(combined).toBeLessThan(faction);
      expect(combined).toBeLessThan(upgraded);
      expect(Math.abs(combined - upgraded / 1.25)).toBeLessThanOrEqual(1);
    }
  });

  it("uses combined faction, level, boost and power-station action speed for UI, countdown and actual output", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      buildingOverrides: { level: 3 }, playerBalances: { cash: 100_000, "metal-parts": 100 }
    });
    const station = createFixedBuildingFixture("power_station", { id: "building:power:1", metadata: {
      powerStation: { backupGridSwitchExpiresAtTick: 500 }
    } });
    state.buildingsById[station.id] = station;
    const boost = config.balance.playerBoosts!["industrial-overdrive"];
    state.playerBoostStatesByPlayerId = { "player:1": { version: 1, cooldownUntilTickByBoostId: {}, active: {
      boostId: "industrial-overdrive", activatedAtTick: 0, expiresAtTick: 500, status: "timed", effectSnapshot: boost.effect
    } } };
    const ctx: GameCoreContext = { config: { ...config, balance: { ...config.balance, factions: {
      ...config.balance.factions!, mafian: { ...config.balance.factions!.mafian, passiveModifiers: { techProductionMultiplier: 1.25 } }
    } } } };
    const recipe = config.balance.factory!.recipes["tech-core"];
    const infrastructure = resolvePowerStationInfrastructureMultiplier({ state, playerId: "player:1", config: config.balance.powerStation, tick: 0, target: "factoryProductionSpeed" });
    const expected = Math.ceil(Math.ceil(recipe.durationTicksPerUnit * config.balance.cooldownMultiplier) / 1.2 / 1.25 / boost.effect.productionSpeedMultiplier! / infrastructure / 1.1);
    const started = applyCommand(state, createCraftItemCommandFixture({ payload: {
      districtId: building.districtId, buildingId: building.id, recipeId: "tech-core", quantity: 2
    } }), ctx);
    expect(started.errors).toEqual([]);
    const activeBuilding = started.nextState.buildingsById[building.id];
    const view = createTimedFactoryProductionBuildingView({ state: started.nextState, building: activeBuilding, playerId: "player:1", config: ctx.config })!;
    const line = view.productionLines.find(entry => entry.recipeId === "tech-core")!;
    expect(line.effectiveUnitDurationTicks).toBe(expected);
    expect(line.factionSpeedMultiplier).toBe(1.25);
    expect(line.unitsPerHour).toBe(3_600_000 / (expected * config.tickRateMs));
    expect(activeBuilding.productionLines!["tech-core"].activeCompletesAtTick).toBe(expected);
    const before = completeFactoryProduction({ ...started.nextState, root: { ...state.root, tick: expected - 1 } }, ctx);
    expect(before.resourceStatesById[`resource:${building.id}`]?.balances["tech-core"] ?? 0).toBe(0);
    const complete = completeFactoryProduction({ ...before, root: { ...state.root, tick: expected } }, ctx);
    expect(complete.resourceStatesById[`resource:${building.id}`].balances["tech-core"]).toBe(1);
    expect(complete.buildingsById[building.id].productionLines!["tech-core"].activeCompletesAtTick).toBe(expected * 2);
  });

  it("retimes unfinished units when a power-station action starts and expires without losing work", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory");
    const station = createFixedBuildingFixture("power_station", { id: "building:power:1" });
    state.buildingsById[station.id] = station;
    state.buildingsById[building.id] = { ...building, productionLines: { "tech-core": {
      recipeId: "tech-core", queuedAmount: 1, activeStartedAtTick: 0, activeCompletesAtTick: 100,
      reservedCleanCash: 900, unitCleanCashCost: 900, version: 1
    } } };
    state.root.tick = 10;
    const activated = { ...state, buildingsById: { ...state.buildingsById, [station.id]: { ...station, metadata: { powerStation: { backupGridSwitchExpiresAtTick: 20 } } } } };
    const faster = retimeProductionSupport(state, activated, context);
    const end = faster.buildingsById[building.id].productionLines!["tech-core"].activeCompletesAtTick!;
    expect(end).toBeLessThan(100);
    const beforeExpiry = { ...faster, root: { ...state.root, tick: 19 } };
    const expired = retimeProductionSupport(beforeExpiry, { ...beforeExpiry, root: { ...state.root, tick: 20 } }, context);
    expect(expired.buildingsById[building.id].productionLines!["tech-core"].activeCompletesAtTick).toBeGreaterThan(end);
    expect(expired.buildingsById[building.id].productionLines!["tech-core"].queuedAmount).toBe(1);
  });
});
