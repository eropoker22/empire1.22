import { describe, expect, it } from "vitest";
import { applyCommand } from "../../../packages/game-core/src/engine";
import {
  createAttackDistrictCommandFixture,
  createPlaceTrapCommandFixture,
  createSpyDistrictCommandFixture
} from "../../fixtures/command-fixtures";
import { createCombatStateFixture } from "../../fixtures/game-state-fixtures";

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
      },
      conflict: {
        spyCooldownTicks: 2,
        attackCooldownTicks: 2,
        spyBaseSuccessChance: 0.72,
        spyTrapRevealChance: 0.22,
        trapAttackLosses: 1,
        reportsLimit: 6
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

describe("conflict command flow", () => {
  it("spy returns a server-authored report notification", () => {
    const state = createCombatStateFixture();
    state.serverInstance.worldSeed = "spy-seed-1";
    const command = createSpyDistrictCommandFixture();

    const result = applyCommand(state, command, context);

    expect(result.errors).toEqual([]);
    const notification = result.nextState.notificationsById["notification:command:spy:1:spy-report"];

    expect(notification?.category).toBe("report.spy");
    expect(notification?.payload).toMatchObject({
      actionType: "spy-district",
      attackerPlayerId: "player:1",
      targetDistrictId: "district:2"
    });
  });

  it("place trap stores hidden trap state on the target district", () => {
    const state = createCombatStateFixture();
    const command = createPlaceTrapCommandFixture();

    const result = applyCommand(state, command, context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.trapsById["trap:district:2"]).toMatchObject({
      districtId: "district:2",
      ownerPlayerId: "player:2",
      status: "active"
    });
    expect(result.nextState.root.trapIds).toContain("trap:district:2");
  });

  it("spy can deterministically reveal an active trap from the server seed", () => {
    const state = createCombatStateFixture();
    state.serverInstance.worldSeed = "spy-seed-10";
    const trappedState = applyCommand(state, createPlaceTrapCommandFixture(), context).nextState;

    const result = applyCommand(trappedState, createSpyDistrictCommandFixture(), context);
    const notification = result.nextState.notificationsById["notification:command:spy:1:spy-report"];

    expect(result.errors).toEqual([]);
    expect(notification?.payload).toMatchObject({
      result: "success",
      trapDetected: true
    });
  });

  it("attack triggers an active trap and applies attacker losses", () => {
    const state = createCombatStateFixture();
    const trappedState = applyCommand(state, createPlaceTrapCommandFixture(), context).nextState;

    const result = applyCommand(trappedState, createAttackDistrictCommandFixture(), context);
    const notification = result.nextState.notificationsById["notification:command:attack:1:battle:player:1"];

    expect(result.errors).toEqual([]);
    expect(result.nextState.trapsById["trap:district:2"]?.status).toBe("triggered");
    expect(result.nextState.playersById["player:1"]?.attackLoadout["baseball-bat"]).toBe(0);
    expect(notification?.payload).toMatchObject({
      trapTriggered: true,
      attackerLosses: {
        "baseball-bat": 1
      }
    });
  });

  it("attack without trap computes the basic battle outcome and can capture the district", () => {
    const state = createCombatStateFixture();
    state.districtsById["district:2"] = {
      ...state.districtsById["district:2"],
      defenseLoadout: {}
    };

    const result = applyCommand(state, createAttackDistrictCommandFixture(), context);
    const notification = result.nextState.notificationsById["notification:command:attack:1:battle:player:1"];

    expect(result.errors).toEqual([]);
    expect(result.nextState.districtsById["district:2"].ownerPlayerId).toBe("player:1");
    expect(notification?.payload).toMatchObject({
      result: "success",
      districtCaptured: true,
      trapTriggered: false
    });
  });
});
