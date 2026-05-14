import { describe, expect, it } from "vitest";
import { runFreeModePacingSimulation, runFreeModePacingVariantSuite } from "@empire/tools-debug";

describe("free mode pacing simulation tool", () => {
  it("runs a 24h deterministic free-mode simulation without crashing", () => {
    const result = runFreeModePacingSimulation({
      seed: "test:24h",
      checkpointHours: [24],
      maxHours: 24,
      botCount: 10,
      districtCount: 40,
      tickStride: 720,
      quiet: true
    });

    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0]).toMatchObject({
      simulatedHours: 24,
      currentTick: 17280,
      activeDistricts: expect.any(Number),
      totalAttacks: expect.any(Number),
      victoryReached: false
    });
    expect(result.config).toMatchObject({
      tickRateMs: 5000,
      ticksPerHour: 720,
      tickStride: 720,
      victoryThreshold: 0.75,
      allowDurationVictoryFallback: false
    });
  });

  it("runs all elimination experiment variants for at least 24h without crashing", () => {
    const suite = runFreeModePacingVariantSuite({
      seed: "test:variants:24h",
      checkpointHours: [24],
      maxHours: 24,
      botCount: 10,
      districtCount: 40,
      tickStride: 720,
      quiet: true
    });

    expect(suite.results).toHaveLength(5);
    expect(suite.results.map((result) => result.variantName)).toEqual([
      "baseline",
      "lower-catastrophe",
      "elimination-4h",
      "elimination-8h-grace",
      "elimination-plus-faster-attacks"
    ]);
    for (const result of suite.results) {
      expect(result.snapshots[0]).toMatchObject({
        simulatedHours: 24,
        currentTick: 17280,
        activeDistricts: expect.any(Number)
      });
    }
  });
});
