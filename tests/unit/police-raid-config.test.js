import { describe, expect, it } from "vitest";
import {
  resolvePoliceOperationImpact
} from "../../page-assets/js/app/police-raid-config.js";
import {
  resolveRandomPoliceOperationType
} from "../../page-assets/js/app/runtime/gangHeatPoliceHelpers.js";

describe("police raid runtime config", () => {
  it("keeps warning notices informational without confiscation", () => {
    const impact = resolvePoliceOperationImpact(3, "warning_notice", "total", () => 0);

    expect(impact.cleanPct).toBe(0);
    expect(impact.dirtyPct).toBe(0);
    expect(impact.drugPct).toBe(0);
    expect(impact.materialPct).toBe(0);
    expect(impact.membersPct).toBe(0);
  });

  it("matches empire2-style operation-specific confiscation categories", () => {
    const cash = resolvePoliceOperationImpact(4, "cash_seizure", "financial", () => 0);
    const dirty = resolvePoliceOperationImpact(4, "dirty_cash_seizure", "financial", () => 0);
    const drugs = resolvePoliceOperationImpact(4, "drug_seizure", "drug", () => 0);
    const warehouse = resolvePoliceOperationImpact(4, "warehouse_raid", "drug", () => 0);
    const coordinated = resolvePoliceOperationImpact(6, "coordinated_operation", "total", () => 0);

    expect(cash.cleanPct).toBeGreaterThan(0);
    expect(cash.dirtyPct).toBe(0);
    expect(dirty.dirtyPct).toBeGreaterThan(0);
    expect(dirty.cleanPct).toBe(0);
    expect(drugs.drugPct).toBeGreaterThan(0);
    expect(drugs.cleanPct).toBe(0);
    expect(warehouse.drugPct).toBeGreaterThan(0);
    expect(warehouse.dirtyPct).toBeGreaterThan(0);
    expect(coordinated.cleanPct).toBeGreaterThan(0);
    expect(coordinated.dirtyPct).toBeGreaterThan(0);
    expect(coordinated.drugPct).toBeGreaterThan(0);
  });

  it("selects raid operations from the same specialty buckets as empire2", () => {
    expect(resolveRandomPoliceOperationType(5, "", () => 0, "financial")).toBe("cash_seizure");
    expect(resolveRandomPoliceOperationType(5, "", () => 0, "drug")).toBe("drug_seizure");
    expect(resolveRandomPoliceOperationType(5, "", () => 0, "weapons")).toBe("building_shutdown");
    expect(resolveRandomPoliceOperationType(5, "", () => 0, "arrests")).toBe("apartment_search");
    expect(resolveRandomPoliceOperationType(4, "heat-dirty-bribe", () => 0, "financial")).toBe("dirty_cash_seizure");
  });
});
