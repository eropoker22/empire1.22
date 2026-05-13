import { describe, expect, it } from "vitest";
import {
  ROBBERY_ZONE_CONFIG,
  createRobberySetupPreview,
  getRobberyRiskLevel,
  getRobberySuccessChance,
  resolveRobberyOrderOutcome
} from "../../../packages/game-core/src/legacy-page/combat-preview-rules.js";

describe("legacy robbery rules", () => {
  it("defines recommended member counts for every robbery zone", () => {
    expect(ROBBERY_ZONE_CONFIG.park).toMatchObject({ recommendedMin: 6, recommendedMax: 10 });
    expect(ROBBERY_ZONE_CONFIG.residential).toMatchObject({ recommendedMin: 8, recommendedMax: 14 });
    expect(ROBBERY_ZONE_CONFIG.industrial).toMatchObject({ recommendedMin: 12, recommendedMax: 20 });
    expect(ROBBERY_ZONE_CONFIG.commercial).toMatchObject({ recommendedMin: 16, recommendedMax: 26 });
    expect(ROBBERY_ZONE_CONFIG.downtown).toMatchObject({ recommendedMin: 28, recommendedMax: 45 });
  });

  it("classifies risk levels from sent member counts", () => {
    expect(getRobberyRiskLevel("industrial", 5)).toBe("critical");
    expect(getRobberyRiskLevel("industrial", 11)).toBe("high");
    expect(getRobberyRiskLevel("industrial", 20)).toBe("medium");
    expect(getRobberyRiskLevel("industrial", 30)).toBe("low");
    expect(getRobberyRiskLevel("industrial", 31)).toBe("overkill");
  });

  it("clamps success chance to 8-88 percent", () => {
    expect(getRobberySuccessChance("downtown", 0)).toBe(8);
    expect(getRobberySuccessChance("park", 100)).toBe(88);
  });

  it("makes downtown harder than the other zones for the same crew size", () => {
    const sentMembers = 20;
    const downtownChance = getRobberySuccessChance("downtown", sentMembers);

    for (const zone of ["park", "residential", "industrial", "commercial"]) {
      expect(downtownChance).toBeLessThan(getRobberySuccessChance(zone, sentMembers));
    }
  });

  it("returns survivors, zone loot and heat from a successful robbery outcome", () => {
    const rolls = [0, 0, 0.99, 0.5, 0.25];
    const outcome = resolveRobberyOrderOutcome(
      { targetDistrictType: "downtown", deployedMembers: 45 },
      { random: () => rolls.shift() ?? 0 }
    );

    expect(outcome.success).toBe(true);
    expect(outcome.memberLoss).toBe(3);
    expect(outcome.returningMembers).toBe(42);
    expect(outcome.loot["tech-core"]).toBeGreaterThanOrEqual(2);
    expect(outcome.loot.chemicals).toBeGreaterThanOrEqual(8);
    expect(outcome.loot["metal-parts"]).toBeGreaterThanOrEqual(8);
    expect(outcome.heatGain).toBe(22);
  });

  it("keeps failed robbery losses capped and grants no loot", () => {
    const outcome = resolveRobberyOrderOutcome(
      { targetDistrictType: "park", deployedMembers: 6 },
      { random: () => 0.99 }
    );

    expect(outcome.success).toBe(false);
    expect(outcome.memberLoss).toBeLessThanOrEqual(6);
    expect(outcome.returningMembers).toBeGreaterThanOrEqual(0);
    expect(outcome.loot).toEqual({});
  });

  it("builds setup preview labels for UI", () => {
    expect(createRobberySetupPreview({ districtType: "economy", sentMembers: 20 })).toMatchObject({
      zoneKey: "commercial",
      recommendationLabel: "16-26",
      riskLevel: "medium",
      heatLabel: "+13",
      scoutReportActive: true,
      scoutReportLabel: "Scout report aktivní"
    });
  });

  it("keeps robbery preview rough without scout report and precise with scout report", () => {
    const rough = createRobberySetupPreview({ districtType: "industrial", sentMembers: 16, hasScoutReport: false });
    const precise = createRobberySetupPreview({ districtType: "industrial", sentMembers: 16, hasScoutReport: true });

    expect(rough.previewRiskLabel).toBe("Neznámé / Odhad");
    expect(rough.previewLootLabel).toBe("Nejistý");
    expect(rough.previewTrapHintLabel).toBe("Neznámá");
    expect(rough.previewDescription).toContain("Spy není povinné");
    expect(precise.previewRiskLabel).toBe("Medium");
    expect(precise.previewLootLabel).toBe("Metal Parts / Tech Core");
    expect(precise.previewDescription).toContain("Scout report aktivní");
  });
});
