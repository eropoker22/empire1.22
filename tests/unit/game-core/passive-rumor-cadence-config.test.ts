import { describe, expect, it } from "vitest";
import {
  freeModeConvenienceStoreConfig,
  freeModeRestaurantConfig,
  freeModeStripClubConfig,
  freeModeVipLoungeConfig
} from "@empire/game-config";

describe("passive rumor cadence config", () => {
  it("uses the extended cadence for every automatic rumor building", () => {
    expect(freeModeConvenienceStoreConfig.passiveRumorIntervalMinutes).toBe(40);
    expect(freeModeRestaurantConfig.passiveRumorIntervalMinutes).toBe(40);
    expect(freeModeStripClubConfig.passiveRumorIntervalMinutes).toBe(120);
    expect(freeModeVipLoungeConfig.network.tiers.map(({ rumorIntervalMinutes }) => rumorIntervalMinutes)).toEqual([
      24,
      20,
      16
    ]);
  });
});
