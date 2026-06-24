import { describe, expect, it } from "vitest";
import type { SpyReport } from "@empire/shared-types";
import { createReportViewModels } from "../../../apps/client/src/selectors/report-view-model";

const createSpyReport = (overrides: Partial<SpyReport> = {}): SpyReport => ({
  reportId: "report:spy:1",
  reportType: "spy",
  actionType: "spy-district",
  playerId: "player:1",
  attackerPlayerId: "player:1",
  sourceDistrictId: "district:1",
  targetDistrictId: "district:2",
  result: "success",
  detectedDefense: {},
  trapDetected: false,
  occupyUnlocked: true,
  revealedType: true,
  revealedDefense: true,
  heatGained: 0,
  blockedUntilTick: null,
  tick: 0,
  createdAt: new Date(0).toISOString(),
  eventId: null,
  ...overrides
});

describe("report view models", () => {
  it.each([
    ["success", "Obsazení odemčeno", "normal"],
    ["partial", "Obsazení zůstává zamčené", "normal"],
    ["failed", "Špehování selhalo", "normal"],
    ["critical_failed", "Kritické selhání", "critical"]
  ] as const)("renders %s spy reports without inventing occupy unlocks", (result, expectedSummary, severity) => {
    const [view] = createReportViewModels([
      createSpyReport({
        result,
        occupyUnlocked: result === "success",
        revealedDefense: result === "success",
        heatGained: result === "critical_failed" ? 7 : 0,
        blockedUntilTick: result === "failed" || result === "critical_failed" ? 8 : null
      })
    ]);

    expect(view?.summary).toContain(expectedSummary);
    expect(view?.severity).toBe(severity);
    expect(view?.details).toContain(result === "success" ? "Obsazení odemčeno" : "Obsazení neodemčeno");
  });
});
