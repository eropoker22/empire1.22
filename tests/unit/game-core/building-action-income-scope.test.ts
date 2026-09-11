import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand, calculateIncomeByPlayerId } from "@empire/game-core";
import { calculateFixedBuildingPassivePressureByDistrictId } from "../../../packages/game-core/src/rules/economy/collectIncome";
import { createCoreStateWithFixedBuildingFixture, createFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { createRunBuildingActionCommandFixture } from "../../fixtures/command-fixtures";

const context = { config: structuredClone(resolveModeConfig("free")) };
context.config.balance.stripClub!.privateParty.scandalChancePct = 0;
const cases = [
  ["casino", "vip_night", 1.7, 1.55, 1.25, 1.6],
  ["arcade", "night_machines", 1.35, 1.65, 1.15, 1.45],
  ["strip_club", "vip_lounge", 1.45, 1.35, 1.55, 1.5],
  ["strip_club", "private_party", 1, 1, 1.7, 1],
  ["lobby_club", "backroom_pressure", 1, 1, 1.18, 1],
  ["restaurant", "restaurant_cover_meetings", 1.18, 1.18, 1, 1],
  ["restaurant", "restaurant_local_network", 1, 1, 1.5, 1]
] as const;

describe("special action income scope", () => {
  it.each(cases)("applies %s / %s exactly once to money, influence and heat", (type, action, clean, dirty, influence, heat) => {
    const { state, building } = createCoreStateWithFixedBuildingFixture(type, { playerBalances: { cash: 50_000 } });
    state.root.tick = context.config.balance.dayNight!.phases.day.durationTicks;
    state.districtsById[building.districtId].influence = 100;
    const before = calculateIncomeByPlayerId(state, context)["player:1"];
    const pressureBefore = calculateFixedBuildingPassivePressureByDistrictId(state, context)[building.districtId];
    const result = applyCommand(state, createRunBuildingActionCommandFixture({ payload: { districtId: building.districtId, buildingId: building.id, actionId: action } }), context);
    expect(result.errors).toEqual([]);
    // Keep the emitted marker in state: this also covers old persisted district markers.
    expect(Object.values(result.nextState.effectStatesById).flatMap(e => e.effects).some(e => e.payload.actionId === action)).toBe(true);
    const after = calculateIncomeByPlayerId(result.nextState, context)["player:1"];
    const pressureAfter = calculateFixedBuildingPassivePressureByDistrictId(result.nextState, context)[building.districtId];
    // Per-hour phase profiles round down before conversion to a 10-second tick.
    expect(after.cash ?? 0).toBeCloseTo((before.cash ?? 0) * clean, 2);
    expect(after["dirty-cash"] ?? 0).toBeCloseTo((before["dirty-cash"] ?? 0) * dirty, 2);
    expect(pressureAfter.influencePerTick).toBeCloseTo(pressureBefore.influencePerTick * influence, 3);
    expect(pressureAfter.heatPerTick).toBeCloseTo(pressureBefore.heatPerTick * heat, 3);
  });

  it("keeps a restaurant bonus local and stops it at expiry", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("restaurant");
    const neighbor = createFixedBuildingFixture("clinic", { id: "building:neighbor", districtId: building.districtId });
    const restaurantIncome = calculateIncomeByPlayerId(state, context)["player:1"].cash;
    state.buildingsById[neighbor.id] = neighbor;
    state.districtsById[building.districtId].buildingIds.push(neighbor.id);
    const baseline = calculateIncomeByPlayerId(state, context)["player:1"].cash;
    const result = applyCommand(state, createRunBuildingActionCommandFixture({ payload: { districtId: building.districtId, buildingId: building.id, actionId: "restaurant_cover_meetings" } }), context);
    expect(result.errors).toEqual([]);
    expect(calculateIncomeByPlayerId(result.nextState, context)["player:1"].cash).toBeCloseTo(baseline + restaurantIncome * 0.18, 5);
    const effect = Object.values(result.nextState.effectStatesById).flatMap(e => e.effects)[0];
    result.nextState.root.tick = effect.expiresAtTick!;
    const expiredBaseline = structuredClone(result.nextState);
    expiredBaseline.effectStatesById = {};
    expect(calculateIncomeByPlayerId(result.nextState, context)).toEqual(calculateIncomeByPlayerId(expiredBaseline, context));
  });
});
