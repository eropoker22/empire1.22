import { describe, expect, it } from "vitest";
import {
  GANG_HEAT_CLEAN_COST,
  GANG_HEAT_CLEAN_REDUCTION,
  GANG_HEAT_DIRTY_COST,
  GANG_HEAT_DIRTY_REDUCTION,
  GANG_HEAT_INFLUENCE_COST,
  GANG_HEAT_INFLUENCE_REDUCTION,
  GANG_HEAT_RAID_PROTECTION_MS,
  resolveGangHeatAuditRisk
} from "../../page-assets/js/app/runtime/heatData.js";

describe("local demo police raid protection", () => {
  it("matches the four-hour real-time cooldown used by the authoritative game", () => {
    expect(GANG_HEAT_RAID_PROTECTION_MS).toBe(4 * 60 * 60 * 1000);
  });

  it("uses the current player-facing heat reduction prices", () => {
    expect({
      dirty: [GANG_HEAT_DIRTY_COST, GANG_HEAT_DIRTY_REDUCTION],
      clean: [GANG_HEAT_CLEAN_COST, GANG_HEAT_CLEAN_REDUCTION],
      influence: [GANG_HEAT_INFLUENCE_COST, GANG_HEAT_INFLUENCE_REDUCTION]
    }).toEqual({
      dirty: [2_500, 5],
      clean: [10_000, 10],
      influence: [50, 15]
    });
  });

  it("raises rolling audit risk for repeated heat reductions", () => {
    const now = 2_000_000;
    expect(resolveGangHeatAuditRisk([], now)).toBe(0);
    expect(resolveGangHeatAuditRisk([now - 1], now)).toBe(10);
    expect(resolveGangHeatAuditRisk([now - 1, now - 2, now - 3], now)).toBe(30);
    expect(resolveGangHeatAuditRisk([now - (31 * 60 * 1000), now - 1], now)).toBe(10);
    expect(resolveGangHeatAuditRisk(Array.from({ length: 20 }, () => now), now)).toBe(100);
  });
});
