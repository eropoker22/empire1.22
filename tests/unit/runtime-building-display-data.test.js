import { describe, expect, it } from "vitest";
import { DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME } from "../../page-assets/js/app/runtime/buildingDisplayData.js";

describe("runtime building display data", () => {
  it("keeps display variants for configured free-mode building cards", () => {
    expect(DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME.Autosalon).toContain("Neon Motors");
    expect(DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Fitness Club"]).toContain("Iron District Gym");
    expect(DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Pašovací tunel"]).toContain("Ghost Tunnel");
    expect(DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Škola"]).toContain("Street Academy");
  });

  it("does not expose removed buildings as display variants", () => {
    const sourceNames = Object.keys(DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME).join("\n").toLowerCase();

    expect(sourceNames).not.toContain("data_center");
    expect(sourceNames).not.toContain("brainwash_center");
    expect(sourceNames).not.toContain("taxi_service");
  });

  it("exports only non-empty display variant arrays", () => {
    for (const [baseName, variants] of Object.entries(DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME)) {
      expect(baseName.trim()).not.toBe("");
      expect(Array.isArray(variants)).toBe(true);
      expect(variants.length).toBeGreaterThan(0);
    }
  });
});
