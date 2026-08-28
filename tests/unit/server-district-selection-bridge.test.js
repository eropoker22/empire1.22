import { describe, expect, it, vi } from "vitest";
import {
  activateServerDistrictSelectionCoordinator,
  cacheServerDistrictSelectionReadModel,
  deactivateServerDistrictSelectionCoordinator
} from "../../page-assets/js/app/runtime/serverDistrictSelectionBridge.js";

function createCoordinator() {
  return {
    cacheReadModel: vi.fn(() => true),
    cancel: vi.fn(),
    clearCache: vi.fn()
  };
}

describe("server district selection bridge", () => {
  it("forwards authoritative read models only to the mounted coordinator", () => {
    const coordinator = createCoordinator();
    const readModel = { district: { districtId: "district:21" } };
    const renderState = { districtPanel: { districtId: "district:21" } };

    expect(activateServerDistrictSelectionCoordinator(coordinator)).toBe(true);
    expect(cacheServerDistrictSelectionReadModel(readModel, renderState)).toBe(true);
    expect(coordinator.cacheReadModel).toHaveBeenCalledWith(readModel, renderState);

    expect(deactivateServerDistrictSelectionCoordinator(coordinator)).toBe(true);
    expect(coordinator.cancel).toHaveBeenCalledOnce();
    expect(coordinator.clearCache).toHaveBeenCalledOnce();
    expect(cacheServerDistrictSelectionReadModel(readModel, renderState)).toBe(false);
  });

  it("replaces a stale mount without allowing its cleanup to detach the new one", () => {
    const staleCoordinator = createCoordinator();
    const activeCoordinator = createCoordinator();
    const readModel = { district: { districtId: "district:66" } };

    activateServerDistrictSelectionCoordinator(staleCoordinator);
    activateServerDistrictSelectionCoordinator(activeCoordinator);

    expect(staleCoordinator.cancel).toHaveBeenCalledOnce();
    expect(staleCoordinator.clearCache).toHaveBeenCalledOnce();
    expect(deactivateServerDistrictSelectionCoordinator(staleCoordinator)).toBe(false);
    expect(cacheServerDistrictSelectionReadModel(readModel)).toBe(true);
    expect(activeCoordinator.cacheReadModel).toHaveBeenCalledWith(readModel, null);
    expect(deactivateServerDistrictSelectionCoordinator(activeCoordinator)).toBe(true);
  });

  it("rejects values that cannot cache a read model", () => {
    expect(activateServerDistrictSelectionCoordinator(null)).toBe(false);
    expect(activateServerDistrictSelectionCoordinator({ cancel() {} })).toBe(false);
  });
});
