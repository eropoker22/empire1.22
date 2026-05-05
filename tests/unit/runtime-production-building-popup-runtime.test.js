import { describe, expect, it, vi } from "vitest";
import { createProductionBuildingPopupRuntime } from "../../page-assets/js/app/runtime/productionBuildingPopupRuntime.js";

function createRoot(elements = {}) {
  return {
    querySelector: vi.fn((selector) => elements[selector] || null),
    querySelectorAll: vi.fn((selector) => elements[selector] || [])
  };
}

describe("production building popup runtime", () => {
  it("keeps production slot labels stable", () => {
    const runtime = createProductionBuildingPopupRuntime();

    expect(runtime.getProductionSlotState(null)).toEqual({ label: "Připraveno", isActive: false });
    expect(runtime.getProductionSlotState({ status: "running" })).toEqual({ label: "Výroba", isActive: true });
    expect(runtime.getProductionSlotState({ status: "ready" })).toEqual({ label: "Hotovo", isActive: true });
  });

  it("renders a production panel through UI callbacks without owning gameplay state", () => {
    const recipeCallbacks = {};
    const persistProductionJob = vi.fn();
    const setStoredEconomyState = vi.fn();
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      Object.assign(recipeCallbacks, callbacks);
      return { viewModel };
    });
    const renderProductionPanelUi = vi.fn(() => true);
    const runtime = createProductionBuildingPopupRuntime({
      getInventoryAmount: () => 10,
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => null,
      getResolvedEconomyState: () => ({ cleanMoney: 100 }),
      getScaledProductionInputs: () => ({}),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      persistProductionJob,
      renderProductionPanelUi,
      renderRecipeCard,
      setStoredEconomyState,
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({
      '[data-production-panel="pharmacy"]': {}
    });
    expect(runtime.renderProductionPanel(root, "pharmacy", {
      tonic: {
        cleanMoneyCost: 5,
        durationMs: 1000,
        inputs: {},
        output: { inventory: "drugs", itemId: "meds", amount: 1 }
      }
    })).toBe(true);

    recipeCallbacks.onStart({ batchCount: 2 });

    expect(renderProductionPanelUi).toHaveBeenCalledTimes(2);
    expect(setStoredEconomyState).toHaveBeenCalledWith({ cleanMoney: 90 });
    expect(persistProductionJob).toHaveBeenCalledWith("pharmacy:tonic", expect.objectContaining({
      status: "running",
      quantity: 2
    }));
  });

  it("handles missing popup DOM without crashing", () => {
    const runtime = createProductionBuildingPopupRuntime({
      ARMORY_POPUP_CLOSE_SELECTOR: ".close",
      ARMORY_POPUP_OPEN_SELECTOR: ".open",
      ARMORY_POPUP_SELECTOR: ".popup"
    });

    expect(runtime.bindProductionBuildingPopup(createRoot(), {
      buildingName: "armory",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(false);
    expect(runtime.bindArmoryPopup(createRoot())).toBe(false);
  });
});
