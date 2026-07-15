import { describe, expect, it } from "vitest";
import type { AttackDistrictCommand, RelocateTrapCommand } from "@empire/shared-types";
import { resolveModeConfig } from "../../../packages/game-config/src";
import { applyCommand } from "../../../packages/game-core/src/engine";
import { calculateIncomeByPlayerId } from "../../../packages/game-core/src/rules";
import { applyDistrictStabilizationToProductionDuration } from "../../../packages/game-core/src/rules/production/productionRules";
import {
  createAttackDistrictCommandFixture,
  createPlaceTrapCommandFixture
} from "../../fixtures/command-fixtures";
import {
  createCombatStateFixture,
  createDistrictFixture,
  createFixedBuildingFixture,
  seedSuccessfulSpyIntel
} from "../../fixtures/game-state-fixtures";

const context = {
  config: resolveModeConfig("free"),
  clock: {
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    nowIso: () => "2026-01-01T00:00:00.000Z"
  }
};

describe("conflict pacing hardening", () => {
  it("rejects a missing attack loadout instead of using the whole inventory", () => {
    const command = createAttackDistrictCommandFixture() as AttackDistrictCommand;
    delete (command.payload as Partial<AttackDistrictCommand["payload"]>).weapons;

    const result = applyCommand(createCombatStateFixture(), command, context);

    expect(result.errors).toMatchObject([{ code: "attack_loadout_required" }]);
  });

  it("sets a player-global attack cooldown that blocks a second target", () => {
    const state = createCombatStateFixture();
    const third = createDistrictFixture({
      id: "district:3",
      serverInstanceId: state.serverInstance.id,
      ownerPlayerId: "player:2",
      adjacentDistrictIds: ["district:1"],
      defenseLoadout: {}
    });
    state.districtsById["district:1"].adjacentDistrictIds.push(third.id);
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      defenseLoadout: {}
    };
    state.districtsById[third.id] = third;
    state.root.districtIds.push(third.id);
    seedSuccessfulSpyIntel(state, "player:1", "district:1", third.id, "player:2");

    const first = applyCommand(state, createAttackDistrictCommandFixture(), context);
    const second = applyCommand(first.nextState, createAttackDistrictCommandFixture({
      id: "command:attack:second-target",
      payload: {
        districtId: third.id,
        sourceDistrictId: "district:1",
        weapons: { "baseball-bat": 1 }
      }
    }), context);

    expect(first.errors).toEqual([]);
    expect(first.nextState.cooldownStatesById["cooldown:1"].cooldowns["attack:global"])
      .toBeGreaterThan(state.root.tick);
    expect(second.errors).toMatchObject([{ code: "attack_cooldown_active" }]);
  });

  it("applies clean-capture attrition, stabilization and abandons surviving defense", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      defenseLoadout: { vest: 7 }
    };
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      population: 500,
      attackLoadout: { bazooka: 10 }
    };
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: { ...state.resourceStatesById["resource:1"].balances, population: 500, bazooka: 10 }
    };
    state.playersById["player:2"] = { ...state.playersById["player:2"], population: 100 };
    const defenderResourceStateId = state.playersById["player:2"].resourceStateId;
    state.resourceStatesById[defenderResourceStateId] = {
      ...state.resourceStatesById[defenderResourceStateId],
      balances: { ...state.resourceStatesById[defenderResourceStateId].balances, population: 100 }
    };
    const command = createAttackDistrictCommandFixture({
      payload: { districtId: "district:2", sourceDistrictId: "district:1", weapons: { bazooka: 10 } }
    });

    const result = applyCommand(state, command, context);
    const report = result.events.find((event) => event.type === "district-attacked")?.payload as
      | Record<string, unknown>
      | undefined;

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"]).toMatchObject({
      ownerPlayerId: "player:1",
      defenseLoadout: {}
    });
    expect(result.nextState.districtsById["district:2"].stabilizingUntilTick).toBeGreaterThan(state.root.tick);
    expect(result.nextState.resourceStatesById["resource:1"].balances.population).toBeLessThan(500);
    expect(report).toMatchObject({
      survivingDefenseAbandoned: true,
      catastropheBaseChance: 0.02,
      bazookaCatastropheBonus: 0.12
    });
    expect(Number(report?.catastropheFinalChance)).toBeCloseTo(0.14);
    expect(Number(report?.occupationPopulationLoss)).toBeGreaterThanOrEqual(1);
    expect(Number(report?.vestPopulationSaved)).toBeGreaterThanOrEqual(1);
  });

  it("halves district income while stabilization is active", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      resourceModifiers: { cash: 10 },
      buildingIds: [],
      stabilizingUntilTick: state.root.tick + 10
    };
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      resourceModifiers: {}
    };

    const stabilizedIncome = calculateIncomeByPlayerId(state, context)["player:1"].cash;
    state.root.tick += 10;
    const fullIncome = calculateIncomeByPlayerId(state, context)["player:1"].cash;
    expect(stabilizedIncome).toBeCloseTo(fullIncome * 0.5);
  });

  it("halves production speed while stabilization is active", () => {
    const state = createCombatStateFixture();
    const district = state.districtsById["district:1"];
    district.stabilizingUntilTick = state.root.tick + 10;
    const building = createFixedBuildingFixture("factory", { districtId: district.id });

    expect(applyDistrictStabilizationToProductionDuration(10, state, building, context)).toBe(20);
    state.root.tick += 10;
    expect(applyDistrictStabilizationToProductionDuration(10, state, building, context)).toBe(10);
  });

  it("relocates one active trap atomically and bumps both security revisions", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      ownerPlayerId: "player:1",
      controllerAllianceId: null
    };
    const placed = applyCommand(state, createPlaceTrapCommandFixture({
      playerId: "player:1",
      serverInstanceId: state.serverInstance.id,
      payload: { districtId: "district:1" }
    }), context);
    expect(placed.errors).toEqual([]);
    const trap = Object.values(placed.nextState.trapsById)[0];
    const source = placed.nextState.districtsById["district:1"];
    const target = placed.nextState.districtsById["district:2"];
    const command: RelocateTrapCommand = {
      id: "command:trap:relocate",
      type: "relocate-trap",
      mode: "free",
      playerId: "player:1",
      serverInstanceId: state.serverInstance.id,
      issuedAt: context.clock.nowIso(),
      payload: {
        trapId: trap.id,
        sourceDistrictId: source.id,
        targetDistrictId: target.id,
        expectedSourceVersion: source.version,
        expectedTargetVersion: target.version,
        expectedTrapVersion: trap.version
      },
      clientRequestId: null
    };

    const result = applyCommand(placed.nextState, command, context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.trapsById[trap.id]).toMatchObject({ districtId: target.id, version: trap.version + 1 });
    expect(result.nextState.districtsById[source.id].securityRevision).toBe(source.securityRevision + 1);
    expect(result.nextState.districtsById[target.id].securityRevision).toBe(target.securityRevision + 1);
    expect(result.nextState.cooldownStatesById["cooldown:1"].cooldowns["trap:relocate"])
      .toBeGreaterThan(state.root.tick);
  });
});
