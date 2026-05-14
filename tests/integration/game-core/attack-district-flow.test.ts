import { describe, expect, it } from "vitest";
import { applyCommand } from "../../../packages/game-core/src/engine";
import { resolveModeConfig } from "../../../packages/game-config/src";
import { createAttackDistrictCommandFixture } from "../../fixtures/command-fixtures";
import { createCombatStateFixture, createFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

const context = {
  config: {
    mode: "free" as const,
    tickRateMs: 5000,
    balance: {
      incomeMultiplier: 1,
      productionMultiplier: 1,
      cooldownMultiplier: 1,
      maxPlayersPerServer: 100,
      maxAllianceSize: 10,
      buildSlotLimit: 3,
      eventFrequencyMultiplier: 1,
      policePressureMultiplier: 1,
      raidIntensityMultiplier: 1,
      expansionSpeedMultiplier: 1,
      dayLengthTicks: 12,
      nightLengthTicks: 12,
      victoryConditionKey: "default-control",
      startingResources: {
        cash: 1000
      }
    },
    technical: {
      sessionTtlMs: 1,
      gameDurationMs: 1,
      storageKeyPrefix: "test",
      snapshotIntervalTicks: 1,
      notificationBatchWindowMs: 1,
      debug: {
        allowDebugTools: false,
        enableDeterministicSeeds: true
      }
    },
    publicMeta: {
      mode: "free" as const,
      label: "Free",
      matchStyle: "short" as const,
      tickRateMs: 5000,
      sessionKeyPrefix: "test"
    }
  }
};

describe("attack-district command flow", () => {
  it("uses attack loadout and district defense loadout in combat resolution", () => {
    const state = createCombatStateFixture();
    const command = createAttackDistrictCommandFixture();

    const result = applyCommand(state, command, context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBe("player:2");
    expect(result.nextState.districtsById["district:2"].status).toBe("contested");
    expect(result.events.some((event) => event.type === "district-attacked")).toBe(true);
    expect(result.events.find((event) => event.type === "district-attacked")?.payload).toMatchObject({
      districtId: "district:2",
      attackSucceeded: false,
      towerAttackReductionPercent: 0.3,
      grenadeDefenseIgnorePercent: 0.3,
      bazookaTotalDestructionBonusPercent: 0.5
    });
  });

  it("rejects attack when target district does not border the selected source district", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:1"].adjacentDistrictIds = ["district:3"];
    const command = createAttackDistrictCommandFixture();

    const result = applyCommand(state, command, context);

    expect(result.errors).toEqual([
      {
        code: "target_not_adjacent",
        message: "Player can only attack a district that borders the selected source district."
      }
    ]);
  });

  it("reduces attack preparation cooldown with owned garages", () => {
    const state = createCombatStateFixture();
    const resolvedConfig = resolveModeConfig("free");
    const baseConflict = resolvedConfig.balance.conflict ?? {
      spyCooldownTicks: 2,
      attackCooldownTicks: 2,
      spyBaseSuccessChance: 0.72,
      spyTrapRevealChance: 0.22,
      trapAttackLosses: 1,
      reportsLimit: 20
    };
    const garageContext = {
      config: {
        ...resolvedConfig,
        balance: {
          ...resolvedConfig.balance,
          conflict: {
            ...baseConflict,
            attackCooldownTicks: 100,
            minAttackDurationTicks: 0
          }
        }
      }
    };
    const garageBuildings = Array.from({ length: 8 }, (_value, index) =>
      createFixedBuildingFixture("garage", {
        id: `building:district-1:garage:${index + 1}`,
        districtId: "district:1",
        ownerPlayerId: "player:1"
      })
    );
    for (const garage of garageBuildings) {
      state.buildingsById[garage.id] = garage;
    }
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: garageBuildings.map((garage) => garage.id),
      slotCount: 8
    };

    const result = applyCommand(state, createAttackDistrictCommandFixture(), garageContext);
    const attackEvent = result.events.find((event) => event.type === "district-attacked");

    expect(result.errors).toEqual([]);
    expect(attackEvent?.payload).toMatchObject({
      attackDurationTicks: 89
    });
    expect(result.nextState.cooldownStatesById["cooldown:1"].cooldowns["attack:district:2"]).toBe(89);
  });

  it("reduces attack preparation cooldown with car dealers and respects garage combined cap", () => {
    const state = createCombatStateFixture();
    const resolvedConfig = resolveModeConfig("free");
    const baseConflict = resolvedConfig.balance.conflict ?? {
      spyCooldownTicks: 2,
      attackCooldownTicks: 2,
      spyBaseSuccessChance: 0.72,
      spyTrapRevealChance: 0.22,
      trapAttackLosses: 1,
      reportsLimit: 20
    };
    const carDealerContext = {
      config: {
        ...resolvedConfig,
        balance: {
          ...resolvedConfig.balance,
          conflict: {
            ...baseConflict,
            attackCooldownTicks: 100,
            minAttackDurationTicks: 0
          }
        }
      }
    };
    const garageBuildings = Array.from({ length: 8 }, (_value, index) =>
      createFixedBuildingFixture("garage", {
        id: `building:district-1:garage:${index + 1}`,
        districtId: "district:1",
        ownerPlayerId: "player:1"
      })
    );
    const carDealerBuildings = Array.from({ length: 7 }, (_value, index) =>
      createFixedBuildingFixture("car_dealer", {
        id: `building:district-1:car_dealer:${index + 1}`,
        districtId: "district:1",
        ownerPlayerId: "player:1"
      })
    );
    const buildings = [...garageBuildings, ...carDealerBuildings];
    for (const building of buildings) {
      state.buildingsById[building.id] = building;
    }
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: buildings.map((building) => building.id),
      slotCount: buildings.length
    };

    const result = applyCommand(state, createAttackDistrictCommandFixture(), carDealerContext);
    const attackEvent = result.events.find((event) => event.type === "district-attacked");

    expect(result.errors).toEqual([]);
    expect(attackEvent?.payload).toMatchObject({
      attackDurationTicks: 82
    });
    expect(result.nextState.cooldownStatesById["cooldown:1"].cooldowns["attack:district:2"]).toBe(82);
  });

  it("does not store non-material combat losses in recovery or salvage pools", () => {
    const state = createCombatStateFixture();
    const resolvedConfig = resolveModeConfig("free");

    const result = applyCommand(state, createAttackDistrictCommandFixture(), { config: resolvedConfig });

    expect(result.errors).toEqual([]);
    expect(result.nextState.playersById["player:1"].salvagePool ?? []).toEqual([]);
    expect(result.nextState.playersById["player:2"].salvagePool ?? []).toEqual([]);
    expect(result.nextState.playersById["player:1"].recoveryPool ?? []).toEqual([]);
    expect(result.nextState.playersById["player:2"].recoveryPool ?? []).toEqual([]);
  });
});
