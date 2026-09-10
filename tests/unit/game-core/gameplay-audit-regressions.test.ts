import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, resolveImmediateHeist, resolveNeutralRobbery, seedNeutralDistrictLootPool } from "@empire/game-core";
import { createCombatStateFixture, createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { createCraftItemCommandFixture, createHeistDistrictCommandFixture, createRobDistrictCommandFixture, createUpgradeBuildingCommandFixture } from "../../fixtures/command-fixtures";
import { resolvePendingDistrictAction } from "../../fixtures/timed-operation-fixtures";
import { resolveArmoryDurationTicks } from "../../../packages/game-core/src/handlers/armoryProductionShared";
import { createDistrictHeistTargetViews } from "../../../packages/game-core/src/projections/district-basic-action-projection";
import { retimeProductionSupport } from "../../../packages/game-core/src/rules/production/productionSpeedModifiers";
import { getFactionPassiveModifiers } from "../../../packages/game-core/src/rules/factions/factionRules";

const context = { config: resolveModeConfig("free") };

describe("gameplay audit: authoritative rules and advertised effects", () => {
  it("charges the warehouse cash and materials, and rejects an upgrade missing metal", () => {
    for (const metal of [1, 2]) {
      const { state, building } = createCoreStateWithFixedBuildingFixture("warehouse", {
        playerBalances: { cash: 4000, "metal-parts": metal }
      });
      const result = applyCommand(state, createUpgradeBuildingCommandFixture({ payload: {
        districtId: building.districtId, buildingId: building.id
      } }), context);
      if (metal === 1) {
        expect(result.errors.map(error => error.code)).toContain("insufficient_upgrade_resources");
        expect(result.nextState).toBe(state);
      } else {
        expect(result.errors).toEqual([]);
        expect(result.nextState.buildingsById[building.id].level).toBe(2);
        expect(result.nextState.resourceStatesById["resource:1"].balances).toMatchObject({ cash: 0, "metal-parts": 0 });
      }
    }
  });

  it("charges the armory production price and accelerates both existing work and the next recipe", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("armory", {
      playerBalances: { cash: 5200, "metal-parts": 10 }
    });
    const recipe = context.config.balance.armory!.recipes["baseball-bat"];
    const beforeDuration = resolveArmoryDurationTicks(state, building, recipe, context);
    const started = applyCommand(state, createCraftItemCommandFixture({ payload: {
      districtId: building.districtId, buildingId: building.id, recipeId: "baseball-bat", quantity: 2
    } }), context);
    expect(started.errors).toEqual([]);
    const upgraded = applyCommand(started.nextState, createUpgradeBuildingCommandFixture({ payload: {
      districtId: building.districtId, buildingId: building.id
    } }), context);
    expect(upgraded.errors).toEqual([]);
    const nextBuilding = upgraded.nextState.buildingsById[building.id];
    expect(upgraded.nextState.resourceStatesById["resource:1"].balances.cash).toBe(0);
    expect(resolveArmoryDurationTicks(upgraded.nextState, nextBuilding, recipe, context)).toBeLessThan(beforeDuration);
    expect(nextBuilding.productionLines!["baseball-bat"].activeCompletesAtTick)
      .toBeLessThan(started.nextState.buildingsById[building.id].productionLines!["baseball-bat"].activeCompletesAtTick!);
  });

  it("applies faction robbery loot without creating resources beyond the finite target pool", () => {
    const state = createCombatStateFixture();
    const pool = seedNeutralDistrictLootPool(state.serverInstance.worldSeed, state.districtsById["district:2"], 0, context.config.balance.conflict!.robbery!);
    pool.cash = 0;
    pool.dirtyCash = 1200;
    for (const factionId of ["motorkarsky-gang", "korporace"] as const) {
      state.playersById["player:1"].factionId = factionId;
      const modifiers = getFactionPassiveModifiers(state, "player:1", context);
      let positiveResults = 0;
      for (let index = 0; index < 40; index++) {
        const args = [state.serverInstance.worldSeed, `audit:rob:${index}`, "district:2", pool] as const;
        const base = resolveNeutralRobbery(...args);
        const result = resolveNeutralRobbery(...args, modifiers);
        if (base.loot["dirty-cash"] > 0) {
          positiveResults++;
          expect(result.loot["dirty-cash"]).toBe(Math.min(1200, Math.floor(base.loot["dirty-cash"] * (factionId === "motorkarsky-gang" ? 1.1 : 0.9))));
        }
        expect(result.nextPool.dirtyCash + result.loot["dirty-cash"]).toBe(1200);
        for (const [key, amount] of Object.entries(pool.resources)) {
          expect(Number(result.nextPool.resources[key]) + Number(result.loot[key] ?? 0)).toBe(amount);
          expect(result.nextPool.resources[key]).toBeGreaterThanOrEqual(0);
        }
      }
      expect(positiveResults).toBeGreaterThan(0);
    }
  });

  it("uses the biker reduction for departure and the cooldown after the actual robbery", () => {
    const state = createCombatStateFixture();
    state.playersById["player:1"].factionId = "motorkarsky-gang";
    Object.assign(state.districtsById["district:2"], { ownerPlayerId: null, controllerAllianceId: null, status: "neutral", defenseLoadout: {} });
    const started = applyCommand(state, createRobDistrictCommandFixture(), context);
    expect(started.errors).toEqual([]);
    const operation = Object.values(started.nextState.pendingDistrictActionOperationsById!)[0];
    const expectedTicks = Math.ceil(context.config.balance.conflict!.robCooldownTicks! * 0.85);
    expect(operation.resolveAtTick - state.root.tick).toBe(expectedTicks);
    const completed = resolvePendingDistrictAction(started.nextState, context);
    const report = completed.events.find(event => event.type === "district-robbed")!;
    expect(report.payload).toMatchObject({ cooldownTicks: expectedTicks });
  });

  it("shows the same day/night heist chances that the server resolves", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:2"].defenseLoadout = {};
    const config = context.config.balance.conflict!.heist!;
    const results = [];
    for (const tick of [0, context.config.balance.dayLengthTicks]) {
      state.root.tick = tick;
      const command = createHeistDistrictCommandFixture({ payload: {
        sourceDistrictId: "district:1", targetDistrictId: "district:2", style: "balanced", populationSent: config.styles.balanced.minMembers
      } });
      const result = resolveImmediateHeist(state, command, "district:1", config, context);
      const target = createDistrictHeistTargetViews(state, "player:1", "district:1", context.config.balance.conflict, undefined, context)
        .find(view => view.districtId === "district:2")!;
      const style = target.styles.find(view => view.style === "balanced")!;
      expect(style.successChance).toBe(result.successChance);
      expect(style.detectionChance).toBe(result.detectionChance);
      results.push(result);
    }
    expect(results[1].successChance - results[0].successChance).toBeCloseTo(0.25);
    expect(results[0].detectionChance - results[1].detectionChance).toBeCloseTo(0.25);
  });

  it("retimes remaining production work when day changes to night without resetting progress", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", { playerBalances: { cash: 10000 } });
    state.root.tick = context.config.balance.dayLengthTicks - 1;
    const started = applyCommand(state, createCraftItemCommandFixture({ payload: {
      districtId: building.districtId, buildingId: building.id, recipeId: "metal-parts", quantity: 1
    } }), context);
    expect(started.errors).toEqual([]);
    const next = { ...started.nextState, root: { ...started.nextState.root, tick: state.root.tick + 1 } };
    const beforeEnd = started.nextState.buildingsById[building.id].productionLines!["metal-parts"].activeCompletesAtTick!;
    const retimed = retimeProductionSupport(started.nextState, next, context);
    const line = retimed.buildingsById[building.id].productionLines!["metal-parts"];
    expect(line.activeCompletesAtTick).toBe(next.root.tick + Math.ceil((beforeEnd - next.root.tick) * 1.1 / 0.98));
    expect(line.activeStartedAtTick).toBe(state.root.tick);
  });
});
