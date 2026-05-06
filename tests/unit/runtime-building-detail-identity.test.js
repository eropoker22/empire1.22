import { describe, expect, it } from "vitest";
import {
  getDistrictBuildingDetailProfile,
  resolveDistrictBuildingCanonicalLookupKey,
  resolveDistrictBuildingDetailMechanicsType
} from "../../page-assets/js/app/runtime.js";

describe("runtime building detail identity", () => {
  it("treats named apartment block variants as apartment blocks", () => {
    expect(resolveDistrictBuildingCanonicalLookupKey("Bytový blok")).toBe("bytovy blok");
    expect(resolveDistrictBuildingCanonicalLookupKey("Blok 1")).toBe("bytovy blok");
    expect(resolveDistrictBuildingDetailMechanicsType("Blok 1")).toBe("apartment-block");
    expect(getDistrictBuildingDetailProfile("Blok 1").role).toBe("Population / gang members");
  });

  it("canonicalizes other named building variants for detail mechanics", () => {
    expect(resolveDistrictBuildingCanonicalLookupKey("BlackCross Medical")).toBe("klinika");
    expect(resolveDistrictBuildingDetailMechanicsType("BlackCross Medical")).toBe("clinic");
    expect(resolveDistrictBuildingDetailMechanicsType("Neznámá budova")).toBe("district-asset");
  });
});
