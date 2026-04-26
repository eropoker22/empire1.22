import { describe, expect, it } from "vitest";
import { validateBuildStructure } from "../../../../packages/game-core/src/validation";
import { createBuildStructureCommandFixture } from "../../../fixtures/command-fixtures";
import { createCoreStateFixture } from "../../../fixtures/game-state-fixtures";

describe("validateBuildStructure", () => {
  it("returns no errors for a valid build request", () => {
    const state = createCoreStateFixture();
    const command = createBuildStructureCommandFixture();

    const result = validateBuildStructure(state, command, {
      config: {
        mode: "free",
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
          mode: "free",
          label: "Free",
          matchStyle: "short",
          tickRateMs: 5000,
          sessionKeyPrefix: "test"
        }
      }
    });

    expect(result).toEqual([]);
  });
});

