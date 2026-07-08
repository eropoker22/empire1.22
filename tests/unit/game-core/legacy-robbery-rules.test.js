import { describe, expect, it } from "vitest";
import { ROBBERY_COOLDOWN_MS } from "../../../packages/game-config/src/legacy-page/combat-config.js";
import {
  ROBBERY_ZONE_CONFIG,
  calculateAttackDeployment,
  calculateTotalDefensePower,
  createRobberySetupPreview,
  getRobberyDistrictLootLabel,
  getRobberyDistrictLootTable,
  getRobberyRiskLevel,
  getRobberySuccessChance,
  resolveRobberyOrderOutcome
} from "../../../packages/game-core/src/legacy-page/combat-preview-rules.js";

describe("legacy robbery rules", () => {
  it("keeps empty district robbery duration at 10 minutes", () => {
    expect(ROBBERY_COOLDOWN_MS).toBe(10 * 60 * 1000);
  });

  it("applies optional combat strength multipliers for preview UI", () => {
    expect(calculateAttackDeployment({ pistol: 2 })).toEqual({ totalResidents: 2, totalPower: 20 });
    expect(calculateAttackDeployment({ pistol: 2 }, { pistol: 1.08 })).toEqual({ totalResidents: 2, totalPower: 21.6 });
    expect(calculateTotalDefensePower({ loadout: { vest: 2 }, residents: 3 })).toBe(15);
    expect(calculateTotalDefensePower({ loadout: { vest: 2 }, residents: 3, modifiers: { vest: 1.075 } })).toBeCloseTo(15.9);
  });

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
    const lootTable = getRobberyDistrictLootTable("downtown", 24);
    const outcome = resolveRobberyOrderOutcome(
      { targetDistrictId: "district:24", targetDistrictType: "downtown", deployedMembers: 45 },
      { random: () => rolls.shift() ?? 0 }
    );

    expect(outcome.success).toBe(true);
    expect(outcome.memberLoss).toBe(3);
    expect(outcome.returningMembers).toBe(42);
    expect(Object.keys(outcome.loot).sort()).toEqual(Object.keys(lootTable).sort());
    for (const [itemId, amount] of Object.entries(outcome.loot)) {
      const [minAmount, maxAmount] = lootTable[itemId];
      expect(amount).toBeGreaterThanOrEqual(minAmount);
      expect(amount).toBeLessThanOrEqual(maxAmount);
    }
    expect(outcome.heatGain).toBe(22);
  });

  it("creates stable 2-3 item loot stashes per district", () => {
    const districtTwoLoot = getRobberyDistrictLootTable("industrial", 2);
    const districtThreeLoot = getRobberyDistrictLootTable("industrial", 3);

    expect(Object.keys(districtTwoLoot).length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(districtTwoLoot).length).toBeLessThanOrEqual(3);
    expect(Object.keys(districtThreeLoot).length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(districtThreeLoot).length).toBeLessThanOrEqual(3);
    expect(districtTwoLoot).toEqual(getRobberyDistrictLootTable("industrial", 2));
    expect(districtTwoLoot).not.toEqual(districtThreeLoot);
    expect(getRobberyDistrictLootLabel("industrial", 2)).not.toBe("District stash: 2-3 položky");
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
    expect(rough.zoneLabel).toBe("Neznámý sektor");
    expect(rough.previewLootLabel).toBe("Nejistý");
    expect(rough.previewTrapHintLabel).toBe("Neznámá");
    expect(rough.previewDescription).toContain("Spy není povinné");
    expect(precise.previewRiskLabel).toBe("Medium");
    expect(precise.zoneLabel).toBe("Industrial");
    expect(precise.previewLootLabel).not.toBe("Nejistý");
    expect(precise.previewLootLabel.split(" / ").length).toBeGreaterThanOrEqual(2);
    expect(precise.previewDescription).toContain("Scout report aktivní");
  });
});
