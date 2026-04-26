import { describe, expect, it } from "vitest";
import { applyCommand } from "../../../packages/game-core/src/engine";
import { createAttackDistrictCommandFixture } from "../../fixtures/command-fixtures";
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
});
