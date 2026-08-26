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
    expect(toCanonicalServerDistrictId({ id: 1, canonicalId: "district:20" })).toBe("district:20");
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

  it("opens an exact building from the current authoritative district without a redundant load", async () => {
    const factory = {
      buildingId: "building:district-21:factory:1",
      buildingTypeId: "factory",
      label: "Továrna"
    };
    const selectDistrict = vi.fn();
    const onLoading = vi.fn();
    const onReady = vi.fn();
    const coordinator = createServerDistrictSelectionCoordinator({
      getReadModel: () => readModel("district:21", [factory]),
      selectDistrict,
      onLoading,
      onReady
    });

    const result = await coordinator.open({
      district: { id: 21 },
      buildingId: factory.buildingId
    });

    expect(result).toMatchObject({
      accepted: true,
      building: factory,
      canonicalDistrictId: "district:21",
      response: null,
      stale: false
    });
    expect(selectDistrict).not.toHaveBeenCalled();
    expect(onLoading).not.toHaveBeenCalled();
    expect(onReady).toHaveBeenCalledOnce();
  });

  it("hydrates a compact indexed building before exposing it to the detail presenter", async () => {
    const compactBuilding = {
      buildingId: "building:district-22:pharmacy:1",
      buildingTypeId: "pharmacy",
      label: "Lékárna",
      level: 2,
      status: "active"
    };
    const fullBuilding = {
      ...compactBuilding,
      actions: [{ actionId: "collect_pharmacy", enabled: true }],
      presentation: { title: "Lékárna L2" },
      slots: [{ slotId: "slot:1", status: "ready" }]
    };
    const selectionOrder = [];
    const selectDistrict = vi.fn(async (districtId) => {
      selectionOrder.push(`select:${districtId}`);
      return {
        accepted: true,
        readModel: readModel("district:22", [fullBuilding])
      };
    });
    const onReady = vi.fn(() => selectionOrder.push("ready"));
    const coordinator = createServerDistrictSelectionCoordinator({
      getReadModel: () => ({
        ...readModel("district:9", []),
        ownedDistricts: [{
          districtId: "district:22",
          buildings: [compactBuilding]
        }]
      }),
      selectDistrict,
      onReady
    });

    const result = await coordinator.open({
      district: { id: 22 },
      buildingId: compactBuilding.buildingId,
      buildingTypeId: compactBuilding.buildingTypeId,
      buildingName: compactBuilding.label
    });

    expect(selectDistrict).toHaveBeenCalledOnce();
    expect(selectDistrict).toHaveBeenCalledWith("district:22");
    expect(selectionOrder).toEqual(["select:district:22", "ready"]);
    expect(compactBuilding).not.toHaveProperty("actions");
    expect(result).toMatchObject({
      accepted: true,
      canonicalDistrictId: "district:22",
      stale: false,
      building: {
        buildingId: compactBuilding.buildingId,
        actions: fullBuilding.actions,
        presentation: fullBuilding.presentation,
        slots: fullBuilding.slots
      }
    });
    expect(result.building).toBe(fullBuilding);
  });

  it("reopens the current authoritative district without a redundant load", async () => {
    const selectDistrict = vi.fn();
    const onLoading = vi.fn();
    const onReady = vi.fn();
    const coordinator = createServerDistrictSelectionCoordinator({
      getReadModel: () => readModel("district:24"),
      selectDistrict,
      onLoading,
      onReady
    });

    const result = await coordinator.open({ district: { id: 24 } });

    expect(result).toMatchObject({
      accepted: true,
      building: null,
      canonicalDistrictId: "district:24",
      response: null,
      stale: false
    });
    expect(selectDistrict).not.toHaveBeenCalled();
    expect(onLoading).not.toHaveBeenCalled();
    expect(onReady).toHaveBeenCalledOnce();
  });

  it("reopens a recently visited district from its authoritative detail cache", async () => {
    let currentReadModel = readModel("district:21");
    let currentRenderState = { districtPanel: { districtId: "district:21" } };
    const selectDistrict = vi.fn(async (districtId) => {
      currentReadModel = readModel(districtId);
      currentRenderState = { districtPanel: { districtId } };
      return {
        accepted: true,
        readModel: currentReadModel,
        renderState: currentRenderState
      };
    });
    const coordinator = createServerDistrictSelectionCoordinator({
      getReadModel: () => currentReadModel,
      getRenderState: () => currentRenderState,
      selectDistrict,
      cacheTtlMs: 20_000,
      now: () => 1_000
    });

    await coordinator.open({ district: { id: 22 } });
    await coordinator.open({ district: { id: 66 } });
    const reopened = await coordinator.open({ district: { id: 22 } });

    expect(reopened).toMatchObject({
      accepted: true,
      canonicalDistrictId: "district:22",
      cached: true,
      renderState: {
        districtPanel: { districtId: "district:22" }
      }
    });
    expect(selectDistrict).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight server load when the same district is tapped twice", async () => {
    let resolveSelection;
    const selectDistrict = vi.fn(() => new Promise((resolve) => {
      resolveSelection = resolve;
    }));
    const onLoading = vi.fn();
    const coordinator = createServerDistrictSelectionCoordinator({
      selectDistrict,
      onLoading
    });

    const firstOpen = coordinator.open({ district: { id: 22 } });
    const secondOpen = coordinator.open({ district: { id: 22 } });

    expect(selectDistrict).toHaveBeenCalledOnce();
    expect(onLoading).toHaveBeenCalledOnce();

    resolveSelection({
      accepted: true,
      readModel: readModel("district:22")
    });

    const [firstResult, secondResult] = await Promise.all([firstOpen, secondOpen]);
    expect(firstResult).toMatchObject({ accepted: true, canonicalDistrictId: "district:22" });
    expect(secondResult).toBe(firstResult);
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
