import { describe, expect, it } from "vitest";
import { applyCommand, resolveCarDealerEscapeChanceBonusPct, type CoreGameState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createAttackDistrictCommandFixture,
  createOccupyDistrictCommandFixture,
  createRobDistrictCommandFixture,
  createRunBuildingActionCommandFixture,
  createSpyDistrictCommandFixture
} from "../../fixtures/command-fixtures";
import {
  createCombatStateFixture,
  createCoreStateWithFixedBuildingFixture,
  createFixedBuildingFixture
} from "../../fixtures/game-state-fixtures";

const freeConfig = resolveModeConfig("free");
const context = { config: freeConfig };
const TICKS_PER_MINUTE = Math.ceil(60_000 / freeConfig.tickRateMs);

describe("Free BR strategic cooldowns", () => {
  it("uses minute-scale conflict baselines", () => {
    expect(freeConfig.balance.conflict).toMatchObject({
      spyCooldownTicks: 6 * TICKS_PER_MINUTE,
      attackCooldownTicks: 22 * TICKS_PER_MINUTE,
      robCooldownTicks: 10 * TICKS_PER_MINUTE,
      heistCooldownTicks: 8 * TICKS_PER_MINUTE,
      minAttackDurationTicks: 22 * TICKS_PER_MINUTE,
      occupyCooldownTicks: 12 * TICKS_PER_MINUTE
    });
  });

  it("applies day and night attack modifiers without breaking the Free guardrail", () => {
    const dayState = createCombatStateFixture();
    seedSuccessfulSpyIntel(dayState, "player:1", "district:1", "district:2", "attack_owned_district");
    const dayResult = applyCommand(dayState, createAttackDistrictCommandFixture(), context);
    expect(dayResult.errors).toEqual([]);
    expect(dayResult.events.find((event) => event.type === "district-attacked")?.payload).toMatchObject({
      attackDurationTicks: Math.ceil(22 * TICKS_PER_MINUTE * 1.05)
    });

    const nightState = createCombatStateFixture();
    nightState.root.tick = freeConfig.balance.dayLengthTicks;
    seedSuccessfulSpyIntel(nightState, "player:1", "district:1", "district:2", "attack_owned_district");
    const nightResult = applyCommand(nightState, createAttackDistrictCommandFixture(), context);
    expect(nightResult.errors).toEqual([]);
    expect(nightResult.events.find((event) => event.type === "district-attacked")?.payload).toMatchObject({
      attackDurationTicks: Math.ceil(22 * TICKS_PER_MINUTE * 0.95)
    });

    const maxReductionState = createCombatStateFixture();
    maxReductionState.root.tick = freeConfig.balance.dayLengthTicks;
    addOwnedBuildings(maxReductionState, "garage", 8);
    addOwnedBuildings(maxReductionState, "car_dealer", 7);
    seedSuccessfulSpyIntel(maxReductionState, "player:1", "district:1", "district:2", "attack_owned_district");
    const reducedResult = applyCommand(maxReductionState, createAttackDistrictCommandFixture(), context);
    const reducedPayload = reducedResult.events.find((event) => event.type === "district-attacked")?.payload as
      | { attackDurationTicks?: number }
      | undefined;
    const reducedTicks = reducedPayload?.attackDurationTicks;

    expect(reducedResult.errors).toEqual([]);
    expect(reducedTicks).toBe(196);
    expect(Number(reducedTicks)).toBeGreaterThanOrEqual(15 * TICKS_PER_MINUTE);
  });

  it("keeps spy, rob and occupy cooldown reductions above Free guardrails", () => {
    const spyState = createCombatStateFixture();
    addOwnedBuildings(spyState, "garage", 8);
    const spyResult = applyCommand(spyState, createSpyDistrictCommandFixture(), context);
    expect(spyResult.errors).toEqual([]);
    expect(spyResult.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["spy:district:2"]).toBe(67);
    expect(spyResult.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["spy:district:2"]).toBeGreaterThanOrEqual(4 * TICKS_PER_MINUTE);

    const occupyState = createNeutralOccupyState();
    addOwnedBuildings(occupyState, "garage", 8);
    addOwnedBuildings(occupyState, "car_dealer", 7);
    seedSuccessfulSpyIntel(occupyState, "player:1", "district:1", "district:2", "occupy_empty_district");
    const occupyResult = applyCommand(occupyState, createOccupyDistrictCommandFixture(), context);

    expect(occupyResult.errors).toEqual([]);
    expect(occupyResult.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["occupy:district:2"]).toBe(113);
    expect(occupyResult.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["occupy:district:2"]).toBeGreaterThanOrEqual(8 * TICKS_PER_MINUTE);

    const robState = createNeutralRobState();
    addOwnedBuildings(robState, "garage", 8);
    const robResult = applyCommand(robState, createRobDistrictCommandFixture(), context);

    expect(robResult.errors).toEqual([]);
    expect(robResult.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["rob:district:2"]).toBe(101);
    expect(robResult.nextState.cooldownStatesById["cooldown:1"]?.cooldowns["rob-source:district:1"]).toBe(101);
  });

  it("applies car dealer escape chance bonus from owned autosalons with cap", () => {
    const noDealerState = createCombatStateFixture();
    expect(resolveCarDealerEscapeChanceBonusPct({
      state: noDealerState,
      playerId: "player:1",
      config: freeConfig.balance.carDealer
    })).toBe(0);

    const threeDealerState = createCombatStateFixture();
    addOwnedBuildings(threeDealerState, "car_dealer", 3);
    expect(resolveCarDealerEscapeChanceBonusPct({
      state: threeDealerState,
      playerId: "player:1",
      config: freeConfig.balance.carDealer
    })).toBe(6);

    const cappedDealerState = createCombatStateFixture();
    addOwnedBuildings(cappedDealerState, "car_dealer", 9);
    expect(resolveCarDealerEscapeChanceBonusPct({
      state: cappedDealerState,
      playerId: "player:1",
      config: freeConfig.balance.carDealer
    })).toBe(12);
  });

  it("keeps canonical craft durations in strategic minute ranges after cooldownMultiplier", () => {
    const pharmacy = freeConfig.balance.pharmacy!;
    const drugLab = freeConfig.balance.drugLab!;
    const factory = freeConfig.balance.factory!;
    const armory = freeConfig.balance.armory!;
    const finalDurationTicks = (durationTicks: number): number =>
      Math.ceil(durationTicks * freeConfig.balance.cooldownMultiplier);

    expect(finalDurationTicks(pharmacy.recipes.chemicals.durationTicksPerUnit)).toBe(2 * TICKS_PER_MINUTE);
    expect(finalDurationTicks(pharmacy.recipes.biomass.durationTicksPerUnit)).toBe(4 * TICKS_PER_MINUTE);
    expect(finalDurationTicks(pharmacy.recipes["stim-pack"].durationTicksPerUnit)).toBe(10 * TICKS_PER_MINUTE);
    expect(finalDurationTicks(drugLab.recipes["neon-dust"].durationTicksPerUnit)).toBe(5 * TICKS_PER_MINUTE);
    expect(finalDurationTicks(drugLab.recipes["pulse-shot"].durationTicksPerUnit)).toBe(8 * TICKS_PER_MINUTE);
    expect(finalDurationTicks(drugLab.recipes["velvet-smoke"].durationTicksPerUnit)).toBe(15 * TICKS_PER_MINUTE);
    expect(finalDurationTicks(drugLab.recipes["ghost-serum"].durationTicksPerUnit)).toBe(20 * TICKS_PER_MINUTE);
    expect(finalDurationTicks(drugLab.recipes["overdrive-x"].durationTicksPerUnit)).toBe(30 * TICKS_PER_MINUTE);
    expect(finalDurationTicks(factory.recipes["tech-core"].durationTicksPerUnit)).toBe(8 * TICKS_PER_MINUTE);
    expect(finalDurationTicks(factory.recipes["combat-module"].durationTicksPerUnit)).toBe(15 * TICKS_PER_MINUTE);
    expect(finalDurationTicks(armory.recipes.bazooka.durationTicksPerUnit)).toBe(14 * TICKS_PER_MINUTE);
    expect(finalDurationTicks(armory.recipes["defense-tower"].durationTicksPerUnit)).toBe(15 * TICKS_PER_MINUTE);
  });

  it("removes legacy production actions and preserves Black Charter phase gating", () => {
    expect(freeConfig.balance.buildingActions!.produce_chemicals).toBeUndefined();
    expect(freeConfig.balance.buildingActions!.produce_biomass).toBeUndefined();
    expect(freeConfig.balance.buildingActions!.produce_neon_dust).toBeUndefined();
    expect(freeConfig.balance.buildingActions!.produce_stim_pack).toBeUndefined();
    expect(freeConfig.balance.buildingActions!.produce_metal_parts).toBeUndefined();
    expect(freeConfig.balance.buildingActions!.produce_tech_core).toBeUndefined();
    expect(freeConfig.balance.buildingActions!.produce_combat_module).toBeUndefined();
    expect(freeConfig.balance.buildingActions!.armory_craft_weapons).toBeUndefined();
    expect(freeConfig.balance.buildingActions!.black_charter.durationMs).toBe(8 * 60_000);

    const { state, building } = createCoreStateWithFixedBuildingFixture("airport", {
      playerBalances: {
        cash: 10_000,
        "dirty-cash": 5_000
      }
    });
    const charter = applyCommand(
      state,
      createRunBuildingActionCommandFixture({
        payload: {
          districtId: "district:1",
          buildingId: building.id,
          actionId: "black_charter"
        }
      }),
      context
    );

    expect(charter.errors.map((error) => error.code)).toEqual(["building_action_phase_blocked"]);
    expect(charter.nextState).toBe(state);
  });
});

const addOwnedBuildings = (state: CoreGameState, buildingTypeId: string, count: number): void => {
  const district = state.districtsById["district:1"];
  const buildingIds = [...district.buildingIds];
  for (let index = 1; index <= count; index += 1) {
    const id = `building:district-1:${buildingTypeId}:${index}`;
    state.buildingsById[id] = createFixedBuildingFixture(buildingTypeId, {
      id,
      districtId: "district:1",
      ownerPlayerId: "player:1"
    });
    buildingIds.push(id);
  }
  state.districtsById["district:1"] = {
    ...district,
    buildingIds,
    slotCount: Math.max(district.slotCount, buildingIds.length)
  };
};

const createNeutralOccupyState = (): CoreGameState => {
  const state = createCombatStateFixture();
  const building = createFixedBuildingFixture("warehouse", {
    id: "building:district-2:warehouse:1",
    districtId: "district:2",
    ownerPlayerId: "player:neutral"
  });

  state.districtsById["district:2"] = {
    ...state.districtsById["district:2"],
    ownerPlayerId: null,
    controllerAllianceId: null,
    status: "neutral",
    buildingIds: [building.id],
    defenseLoadout: {}
  };
  state.districtsById["district:1"] = {
    ...state.districtsById["district:1"],
    influence: 10
  };
  state.resourceStatesById["resource:1"] = {
    ...state.resourceStatesById["resource:1"],
    balances: {
      ...state.resourceStatesById["resource:1"]?.balances,
      population: 1_000
    }
  };
  state.buildingsById[building.id] = building;

  return state;
};

const createNeutralRobState = (): CoreGameState => {
  const state = createCombatStateFixture();
  state.playersById["player:1"] = {
    ...state.playersById["player:1"],
    population: 2
  };
  state.districtsById["district:2"] = {
    ...state.districtsById["district:2"],
    ownerPlayerId: null,
    controllerAllianceId: null,
    status: "neutral",
    defenseLoadout: {}
  };
  return state;
};

const seedSuccessfulSpyIntel = (
  state: CoreGameState,
  playerId: string,
  sourceDistrictId: string,
  targetDistrictId: string,
  purpose: "attack_owned_district" | "occupy_empty_district"
): void => {
  const targetDistrict = state.districtsById[targetDistrictId];
  const notificationId = `notification:spy-success:${playerId}:${targetDistrictId}`;
  state.notificationsById[notificationId] = {
    id: notificationId,
    recipientType: "player",
    recipientId: playerId,
    category: "report.spy",
    title: `Spy report: ${targetDistrictId}`,
    bodyKey: "report.spy",
    payload: {
      reportId: `report:spy-success:${playerId}:${targetDistrictId}`,
      reportType: "spy",
      actionType: "spy-district",
      playerId,
      attackerPlayerId: playerId,
      sourceDistrictId,
      targetDistrictId,
      result: "success",
      purpose,
      attackAuthorizationExpiresAtTick: state.root.tick + 120,
      targetOwnerPlayerId: targetDistrict?.ownerPlayerId ?? null,
      targetStateAtSpy: targetDistrict?.ownerPlayerId ? "owned" : "empty",
      targetVersionAtSpy: targetDistrict?.version,
      detectedDefense: {},
      trapDetected: false,
      tick: state.root.tick,
      createdAt: new Date(0).toISOString(),
      eventId: null
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  };
  state.root.notificationIds.push(notificationId);
};
