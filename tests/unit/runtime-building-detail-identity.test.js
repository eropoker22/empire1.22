import { describe, expect, it } from "vitest";
import {
  getDistrictBuildingDetailProfile,
  resolveBuildingPopupTarget,
  resolveDistrictBuildingCanonicalLookupKey,
  resolveDistrictBuildingDetailMechanicsType,
  shouldOpenGenericDistrictBuildingDetail
} from "../../page-assets/js/app/runtime.js";

describe("runtime building detail identity", () => {
  it("treats named apartment block variants as apartment blocks", () => {
    expect(resolveDistrictBuildingCanonicalLookupKey("Bytový blok")).toBe("bytovy blok");
    expect(resolveDistrictBuildingCanonicalLookupKey("Blok 1")).toBe("bytovy blok");
    expect(resolveDistrictBuildingDetailMechanicsType("Blok 1")).toBe("apartment-block");
    expect(getDistrictBuildingDetailProfile("Blok 1").role).toBe("Členové gangu");
    expect(getDistrictBuildingDetailProfile("Blok 1").info).toBe("Bytový blok negeneruje cash ani heat. Jen lidi. A v tomhle městě jsou lidi palivo každé války.");
  });

  it("canonicalizes other named building variants for detail mechanics", () => {
    expect(resolveDistrictBuildingCanonicalLookupKey("BlackCross Medical")).toBe("klinika");
    expect(resolveDistrictBuildingDetailMechanicsType("BlackCross Medical")).toBe("clinic");
    expect(resolveDistrictBuildingDetailMechanicsType("Garáž")).toBe("garage");
    expect(getDistrictBuildingDetailProfile("Garáž").role).toBe("Logistika");
    expect(getDistrictBuildingDetailProfile("Garáž").info).toContain("ani upgrade");
    expect(resolveDistrictBuildingDetailMechanicsType("Neznámá budova")).toBe("district-asset");
  });

  it("keeps production buildings routed to their dedicated production popup", () => {
    const productionBuildings = [
      ["Lékárna", "Lékárna"],
      ["Neon Medics", "Lékárna"],
      ["Drug lab", "Drug lab"],
      ["Neon Chem Lab", "Drug lab"],
      ["Továrna", "Továrna"],
      ["IronWorks Factory", "Továrna"],
      ["Zbrojovka", "Zbrojovka"],
      ["Iron Arsenal", "Zbrojovka"]
    ];

    productionBuildings.forEach(([buildingName, expectedPopupLabel]) => {
      expect(resolveBuildingPopupTarget(buildingName)?.label).toBe(expectedPopupLabel);
      expect(shouldOpenGenericDistrictBuildingDetail(buildingName, { preferGenericDetail: true })).toBe(false);
    });

    expect(shouldOpenGenericDistrictBuildingDetail("Klinika", { preferGenericDetail: true })).toBe(true);
  });
});
