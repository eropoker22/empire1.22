import { describe, expect, it } from "vitest";
import type { HeistReport, RobReport, SpyReport } from "@empire/shared-types";
import { createReportViewModels } from "../../../apps/client/src/selectors/report-view-model";

const createSpyReport = (overrides: Partial<SpyReport> = {}): SpyReport => ({
  reportId: "report:spy:1",
  reportType: "spy",
  actionType: "spy-district",
  playerId: "player:1",
  attackerPlayerId: "player:1",
  sourceDistrictId: "district:1",
  targetDistrictId: "district:2",
  targetOwnerPlayerId: "player:2",
  targetSecurityRevision: 1,
  authorizationScope: "attack_owned_district",
  issuedAtTick: 0,
  authorizationExpiresAtTick: 120,
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

  it("renders canonical heist and robbery outcomes from server report fields", () => {
    const heist: HeistReport = {
      reportId: "report:heist:1",
      reportType: "heist",
      actionType: "heist-district",
      playerId: "player:1",
      sourceDistrictId: "district:1",
      targetDistrictId: "district:2",
      targetOwnerPlayerId: "player:2",
      style: "balanced",
      result: "detected",
      loot: { cash: 120 },
      gangLosses: 3,
      heatGained: 5,
      successChance: 0.7,
      detectionChance: 0.4,
      attackerIdentified: true,
      tick: 10,
      createdAt: new Date(0).toISOString(),
      eventId: null
    };
    const rob: RobReport = {
      reportId: "report:rob:1",
      reportType: "rob",
      actionType: "rob-district",
      playerId: "player:1",
      sourceDistrictId: "district:1",
      targetDistrictId: "district:3",
      result: "partial",
      loot: { "dirty-cash": 80 },
      playerHeat: 2,
      districtHeat: 1,
      cooldownTicks: 4,
      poolChangedBeforeResolution: false,
      expectedLootPoolRevision: 1,
      resolvedLootPoolRevision: 1,
      tick: 11,
      createdAt: new Date(0).toISOString(),
      eventId: null
    };

    expect(createReportViewModels([heist, rob])).toEqual([
      expect.objectContaining({
        reportType: "heist",
        title: "Heist detected v district:2",
        summary: expect.stringContaining("120 Cash")
      }),
      expect.objectContaining({
        reportType: "rob",
        title: "Vykradení partial v district:3",
        summary: expect.stringContaining("80 Dirty Cash")
      })
    ]);
  });
});
