import { describe, expect, it } from "vitest";
import { freeModeConvenienceStoreConfig } from "@empire/game-config";
import { validateConvenienceStoreConfig } from "@empire/game-core";

describe("Convenience Store config", () => {
  it("validates the canonical rumor cadence and one player-level check per interval", () => {
    expect(() => validateConvenienceStoreConfig(freeModeConvenienceStoreConfig)).not.toThrow();
    expect(freeModeConvenienceStoreConfig.passiveRumorIntervalMinutes).toBe(10);
    expect(freeModeConvenienceStoreConfig.maxRumorChecksPerPlayerPerInterval).toBe(1);
  });

  it("rejects invalid rumor cadence, duplicate types, and broken truth tiers", () => {
    expect(() => validateConvenienceStoreConfig({
      ...freeModeConvenienceStoreConfig,
      passiveRumorIntervalMinutes: 0
    })).toThrow(/rumor interval/u);
    expect(() => validateConvenienceStoreConfig({
      ...freeModeConvenienceStoreConfig,
      rumorTypes: ["fake", "fake"]
    })).toThrow(/unique rumor types/u);
    expect(() => validateConvenienceStoreConfig({
      ...freeModeConvenienceStoreConfig,
      truthChanceByOwnedCount: [
        { minOwned: 1, maxOwned: 2, truthChancePct: 42 },
        { minOwned: 4, maxOwned: null, truthChancePct: 58 }
      ]
    })).toThrow(/contiguous/u);
  });
});
