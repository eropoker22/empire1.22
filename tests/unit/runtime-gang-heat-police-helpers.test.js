import { describe, expect, it } from "vitest";
import {
  applyPercentageLoss,
  clampGangHeat,
  clampGangInfluence,
  formatGangHeatProtectionLabel,
  normalizeGangHeatJournal,
  resolveGangHeatTier,
  resolveRandomPoliceOperationType,
  resolveWeightedRandomKey,
  summarizePenaltyEntries
} from "../../page-assets/js/app/runtime/gangHeatPoliceHelpers.js";

describe("gang heat and police helpers", () => {
  it("clamps heat and influence values", () => {
    expect(clampGangHeat(-5)).toBe(0);
    expect(clampGangHeat(20_000)).toBe(9999);
    expect(clampGangInfluence(-1)).toBe(0);
  });

  it("normalizes heat journal entries with a limit", () => {
    const entries = normalizeGangHeatJournal([
      { reason: "Akce", amount: 4, type: "rise" },
      { reason: "", amount: 1 },
      null
    ], { now: () => 1_700_000_000_000, limit: 2 });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ reason: "Akce", amount: 4, type: "rise" });
  });

  it("resolves tiers and weighted random keys deterministically", () => {
    expect(resolveGangHeatTier(0).id).toBe(1);
    expect(resolveWeightedRandomKey([{ key: "a", weight: 1 }, { key: "b", weight: 1 }], "x", () => 0.75)).toBe("b");
    expect(resolveRandomPoliceOperationType(1, "heat-dirty-bribe")).toBe("district_control");
  });

  it("formats protection and penalty summaries", () => {
    expect(formatGangHeatProtectionLabel(2_000, {
      now: () => 1_000,
      formatDurationLabel: (value) => `${value}ms`
    })).toBe("1000ms");
    expect(applyPercentageLoss(10, 30)).toEqual({ nextValue: 7, lostValue: 3 });
    expect(summarizePenaltyEntries([{ itemId: "cash", lostValue: 2 }], (itemId) => itemId.toUpperCase())).toBe("CASH -2");
  });
});
