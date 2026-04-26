import { describe, expect, it } from "vitest";
import { applyCommand } from "../../../packages/game-core/src/engine";
import { createBuildStructureCommandFixture } from "../../fixtures/command-fixtures";
import { createCoreStateFixture } from "../../fixtures/game-state-fixtures";

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

describe("build-structure command flow", () => {
  it("updates state and emits a building event", () => {
    const state = createCoreStateFixture();
    const command = createBuildStructureCommandFixture();

    const result = applyCommand(state, command, context);

    expect(result.errors).toEqual([]);
    expect(Object.keys(result.nextState.buildingsById)).toHaveLength(1);
    expect(result.nextState.districtsById["district:1"].buildingIds).toHaveLength(1);
    expect(result.events).toHaveLength(1);
  });
});

