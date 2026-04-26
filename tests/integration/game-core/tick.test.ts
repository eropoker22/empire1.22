import { describe, expect, it } from "vitest";
import { runTick } from "../../../packages/game-core/src/engine";
import { createCoreStateFixture } from "../../fixtures/game-state-fixtures";

describe("tick engine", () => {
  it("increments tick deterministically", () => {
    const state = createCoreStateFixture();

    const result = runTick(state, {
      config: {
        mode: "free",
        tickRateMs: 5000,
        balance: {
          incomeMultiplier: 1,
          productionMultiplier: 1,
          cooldownMultiplier: 1,
          maxPlayersPerServer: 1,
          maxAllianceSize: 1,
          buildSlotLimit: 3,
          eventFrequencyMultiplier: 1,
          policePressureMultiplier: 1,
          raidIntensityMultiplier: 1,
          expansionSpeedMultiplier: 1,
          dayLengthTicks: 1,
          nightLengthTicks: 1,
          victoryConditionKey: "default-control",
          startingResources: { cash: 1000 }
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
          mode: "free",
          label: "Free",
          matchStyle: "short",
          tickRateMs: 5000,
          sessionKeyPrefix: "test"
        }
      }
    });

    expect(result.nextState.root.tick).toBe(1);
    expect(result.nextState.serverInstance.currentTick).toBe(1);
  });
});

