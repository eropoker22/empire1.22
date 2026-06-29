import { describe, expect, it } from "vitest";
import {
  createBuildingSpecialActionAuditRows,
  hasLegacyBuildingSpecialActionHandler,
  resolveBuildingSpecialActionDefinition
} from "../../page-assets/js/app/runtime/buildingSpecialActionRegistry.js";

describe("building special action registry", () => {
  it("assigns every audited card/profile action a stable action id", () => {
    const rows = createBuildingSpecialActionAuditRows();

    expect(rows.length).toBeGreaterThan(20);
    expect(rows.every((row) => typeof row.actionId === "string" && row.actionId.length > 0)).toBe(true);
  });

  it("marks stock exchange server-only actions as coming soon instead of legacy handled", () => {
    const definition = resolveBuildingSpecialActionDefinition({
      buildingName: "Burza",
      actionLabel: "Spekulativní nákup",
      actionIndex: 0,
      actionProfile: { stockSpeculativeBuy: true, cleanCost: 2500, heat: 5 }
    });

    expect(definition.actionId).toBe("speculative_buy");
    expect(definition.status).toBe("coming-soon");
    expect(definition.disabledReason).toContain("serverový handler");
    expect(hasLegacyBuildingSpecialActionHandler({ stockSpeculativeBuy: true, heat: 5 })).toBe(false);
  });

  it("keeps generic legacy output actions executable", () => {
    const definition = resolveBuildingSpecialActionDefinition({
      buildingName: "Přístav",
      actionLabel: "Container Cut",
      actionIndex: 0,
      actionProfile: { dirty: 160, materials: { "metal-parts": 3 }, influence: 1, heat: 6 }
    });

    expect(definition.actionId).toBe("port_container_cut");
    expect(definition.status).toBe("implemented");
    expect(hasLegacyBuildingSpecialActionHandler({ dirty: 160, materials: { "metal-parts": 3 }, influence: 1, heat: 6 })).toBe(true);
  });

  it("adds concrete effect numbers to confirm summaries for boost actions", () => {
    const definition = resolveBuildingSpecialActionDefinition({
      buildingName: "Kasino",
      actionLabel: "VIP noc",
      actionIndex: 1,
      actionProfile: {
        casinoVipNight: true,
        durationMs: 10 * 60 * 1000,
        cooldownMs: 26 * 60 * 1000,
        cleanIncomeBoostPct: 70,
        dirtyIncomeBoostPct: 55,
        influenceBoostPct: 25,
        heatMultiplier: 1.6,
        auditRiskBoostPct: 8,
        summary: "VIP noc masivně zvedá income, vliv, heat a audit risk."
      }
    });

    expect(definition.rewardSummary).toContain("Clean income +70%");
    expect(definition.rewardSummary).toContain("Dirty income +55%");
    expect(definition.rewardSummary).toContain("Vliv +25%");
    expect(definition.rewardSummary).toContain("Efekt 10m 00s");
    expect(definition.riskSummary).toContain("Heat +60%");
    expect(definition.riskSummary).toContain("Audit +8%");
  });

  it("adds concrete risk numbers to confirm summaries for failure-based actions", () => {
    const definition = resolveBuildingSpecialActionDefinition({
      buildingName: "Kasino",
      actionLabel: "Podplacený inspektor",
      actionIndex: 2,
      actionProfile: {
        casinoBribedInspector: true,
        cleanCost: 5500,
        failureChancePct: 14,
        durationMs: 12 * 60 * 1000,
        cooldownMs: 32 * 60 * 1000,
        heatSuccess: -16,
        heatFailure: 12,
        influenceSuccess: 4,
        auditRiskReductionPct: 35,
        auditRiskFailurePct: 10,
        summary: "Podplacený inspektor je drahá ochrana s rizikem selhání."
      }
    });

    expect(definition.rewardSummary).toContain("Heat -16");
    expect(definition.rewardSummary).toContain("Vliv +4");
    expect(definition.rewardSummary).toContain("Audit -35%");
    expect(definition.rewardSummary).toContain("Efekt 12m 00s");
    expect(definition.riskSummary).toContain("Selhání 14%");
    expect(definition.riskSummary).toContain("Fail heat +12");
    expect(definition.riskSummary).toContain("Audit fail +10%");
  });
});
