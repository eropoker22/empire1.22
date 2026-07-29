import { describe, expect, it, vi } from "vitest";
import {
  createServerDistrictSelectionCoordinator,
  resolveServerDistrictBuilding,
  toCanonicalServerDistrictId
} from "../../page-assets/js/app/runtime/serverDistrictSelectionCoordinator.js";

const readModel = (districtId, buildings = []) => ({
  server: { stateVersion: 7 },
  district: { districtId, buildings }
});

describe("server district selection coordinator", () => {
  it("normalizes legacy map identifiers", () => {
    expect(toCanonicalServerDistrictId(21)).toBe("district:21");
    expect(toCanonicalServerDistrictId({ id: 66 })).toBe("district:66");
    expect(toCanonicalServerDistrictId("district:68")).toBe("district:68");
  });

  it("requires the exact requested district before presenting it", async () => {
    const onReady = vi.fn();
    const onError = vi.fn();
    const coordinator = createServerDistrictSelectionCoordinator({
      selectDistrict: async () => ({
        accepted: true,
        readModel: readModel("district:22")
      }),
      onReady,
      onError
    });

    const result = await coordinator.open({ district: { id: 21 } });

    expect(result.accepted).toBe(false);
    expect(onReady).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("ignores a late A response after B was requested", async () => {
    let resolveA;
    let resolveB;
    const onReady = vi.fn();
    const coordinator = createServerDistrictSelectionCoordinator({
      selectDistrict: (districtId) => new Promise((resolve) => {
        if (districtId === "district:21") resolveA = resolve;
        if (districtId === "district:66") resolveB = resolve;
      }),
      onReady
    });

    const requestA = coordinator.open({ district: { id: 21 } });
    const requestB = coordinator.open({ district: { id: 66 } });
    resolveB({ accepted: true, readModel: readModel("district:66") });
    expect((await requestB).accepted).toBe(true);
    resolveA({ accepted: true, readModel: readModel("district:21") });
    expect((await requestA).stale).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady.mock.calls[0][0].canonicalDistrictId).toBe("district:66");
  });

  it("requires the exact physical building when a building ID is supplied", async () => {
    const pharmacy = {
      buildingId: "building:district-21:pharmacy:1",
      buildingTypeId: "pharmacy",
      label: "Lékárna",
      displayName: "Pulse Pharmacy"
    };
    const coordinator = createServerDistrictSelectionCoordinator({
      selectDistrict: async () => ({
        accepted: true,
        readModel: readModel("district:21", [pharmacy])
      })
    });

    const exact = await coordinator.open({
      district: { id: 21 },
      buildingId: pharmacy.buildingId
    });
    const missing = await coordinator.open({
      district: { id: 21 },
      buildingId: "building:district-21:pharmacy:2"
    });

    expect(exact.building).toBe(pharmacy);
    expect(missing.accepted).toBe(false);
  });

  it("maps shared Czech production labels without guessing a different district", () => {
    const buildings = [
      { buildingId: "p", buildingTypeId: "pharmacy", label: "Lékárna" },
      { buildingId: "d", buildingTypeId: "drug_lab", label: "Drug Lab" },
      { buildingId: "f", buildingTypeId: "factory", label: "Továrna" },
      { buildingId: "a", buildingTypeId: "armory", label: "Zbrojovka" }
    ];
    const model = readModel("district:21", buildings);

    expect(resolveServerDistrictBuilding(model, { buildingName: "Lékárna" })?.buildingId).toBe("p");
    expect(resolveServerDistrictBuilding(model, { buildingName: "Lab" })?.buildingId).toBe("d");
    expect(resolveServerDistrictBuilding(model, { buildingName: "Factory" })?.buildingId).toBe("f");
    expect(resolveServerDistrictBuilding(model, { buildingName: "Armory" })?.buildingId).toBe("a");
  });
});
