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
    const getScaledProductionInputs = vi.fn((inputs, count) => Object.fromEntries(
      Object.entries(inputs || {}).map(([itemId, amount]) => [itemId, Number(amount || 0) * count])
    ));
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
      getScaledProductionInputs,
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
        inputs: { chemicals: 1 },
        output: { inventory: "drugs", itemId: "meds", amount: 20 }
      }
    })).toBe(true);

    recipeCallbacks.onStart({ batchCount: 2 });

    expect(renderProductionPanelUi).toHaveBeenCalledTimes(2);
    expect(setStoredEconomyState).toHaveBeenCalledWith({ cleanMoney: 90 });
    expect(persistProductionJob).toHaveBeenCalledWith("pharmacy:tonic", expect.objectContaining({
      status: "running",
      quantity: 2,
      inputs: { chemicals: 2 },
      cleanMoneyCost: 10,
      output: expect.objectContaining({ amount: 2 })
    }));
  });

  it("cancels pharmacy production and refunds queued costs", () => {
    const recipeCallbacks = {};
    const clearProductionJob = vi.fn();
    const setInventoryAmount = vi.fn();
    const setStoredEconomyState = vi.fn();
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      Object.assign(recipeCallbacks, callbacks);
      return { viewModel };
    });
    const runtime = createProductionBuildingPopupRuntime({
      applyTopbarEconomy: vi.fn(),
      clearProductionJob,
      getInventoryAmount: vi.fn((inventory, itemId) => itemId === "chemicals" ? 6 : 0),
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => ({
        status: "running",
        quantity: 2,
        inputs: { chemicals: 4 },
        cleanMoneyCost: 10,
        output: { inventory: "drugs", itemId: "meds", amount: 2 },
        durationMs: 2000
      }),
      getResolvedEconomyState: () => ({ cleanMoney: 90 }),
      getScaledProductionInputs: vi.fn((inputs, count) => Object.fromEntries(
        Object.entries(inputs || {}).map(([itemId, amount]) => [itemId, Number(amount || 0) * count])
      )),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard,
      setInventoryAmount,
      setStoredEconomyState,
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({
      '[data-production-panel="pharmacy"]': {}
    });
    runtime.renderProductionPanel(root, "pharmacy", {
      tonic: {
        cleanMoneyCost: 5,
        durationMs: 1000,
        inputs: { chemicals: 2 },
        output: { inventory: "drugs", itemId: "meds", amount: 1 }
      }
    });

    recipeCallbacks.onStop();

    expect(setInventoryAmount).toHaveBeenCalledWith("materials", "chemicals", 10);
    expect(setStoredEconomyState).toHaveBeenCalledWith({ cleanMoney: 100 });
    expect(clearProductionJob).toHaveBeenCalledWith("pharmacy:tonic");
  });

  it("collects a ready slot before starting a new production batch", () => {
    const recipeCallbacks = {};
    const applyInventoryOutput = vi.fn();
    const clearProductionJob = vi.fn();
    const persistProductionJob = vi.fn();
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      Object.assign(recipeCallbacks, callbacks);
      return { viewModel };
    });
    const runtime = createProductionBuildingPopupRuntime({
      applyInventoryOutput,
      clearProductionJob,
      consumeMaterials: vi.fn(),
      getInventoryAmount: () => 20,
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => ({
        status: "ready",
        quantity: 2,
        output: { inventory: "materials", itemId: "chemicals", amount: 2 },
        durationMs: 2000
      }),
      getResolvedEconomyState: () => ({ cleanMoney: 100 }),
      getScaledProductionInputs: (inputs, count) => Object.fromEntries(
        Object.entries(inputs || {}).map(([itemId, amount]) => [itemId, Number(amount || 0) * count])
      ),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      persistProductionJob,
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard,
      scheduleProductionJob: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({
      '[data-production-panel="pharmacy"]': {}
    });
    runtime.renderProductionPanel(root, "pharmacy", {
      chemicals: {
        durationMs: 1000,
        inputs: { biomass: 1 },
        output: { inventory: "materials", itemId: "chemicals", amount: 20 }
      }
    });

    recipeCallbacks.onStart({ batchCount: 1 });

    expect(applyInventoryOutput).toHaveBeenCalledWith({ inventory: "materials", itemId: "chemicals", amount: 2 });
    expect(clearProductionJob).toHaveBeenCalledWith("pharmacy:chemicals");
    expect(persistProductionJob).toHaveBeenCalledWith("pharmacy:chemicals", expect.objectContaining({
      status: "running",
      quantity: 1,
      output: expect.objectContaining({ amount: 1 })
    }));
  });

  it("adds selected batches into an already running production queue", () => {
    const recipeCallbacks = {};
    const persistProductionJob = vi.fn();
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      Object.assign(recipeCallbacks, callbacks);
      return { viewModel };
    });
    const runtime = createProductionBuildingPopupRuntime({
      consumeMaterials: vi.fn(),
      getInventoryAmount: () => 20,
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => ({
        status: "running",
        readyAt: new Date(Date.now() + 5000).toISOString(),
        quantity: 1,
        inputs: { chemicals: 3, biomass: 2 },
        output: { inventory: "drugs", itemId: "neon-dust", amount: 6 },
        cleanMoneyCost: 0,
        durationMs: 1000
      }),
      getResolvedEconomyState: () => ({ cleanMoney: 100 }),
      getScaledProductionInputs: (inputs, count) => Object.fromEntries(
        Object.entries(inputs || {}).map(([itemId, amount]) => [itemId, Number(amount || 0) * count])
      ),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      persistProductionJob,
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard,
      scheduleProductionJob: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({
      '[data-production-panel="druglab"]': {}
    });
    runtime.renderProductionPanel(root, "druglab", {
      dust: {
        durationMs: 1000,
        inputs: { chemicals: 3, biomass: 2 },
        output: { inventory: "drugs", itemId: "neon-dust", amount: 6 }
      }
    });

    recipeCallbacks.onStart({ batchCount: 2 });

    expect(persistProductionJob).toHaveBeenCalledWith("druglab:dust", expect.objectContaining({
      status: "running",
      quantity: 3,
      inputs: { chemicals: 9, biomass: 6 },
      output: expect.objectContaining({ amount: 18 }),
      durationMs: 3000
    }));
  });

  it("keeps each drug lab recipe wired to its own production key", () => {
    const recipeCallbacks = {};
    const persistProductionJob = vi.fn();
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      recipeCallbacks[viewModel.recipeId] = callbacks;
      return { viewModel };
    });
    const runtime = createProductionBuildingPopupRuntime({
      consumeMaterials: vi.fn(),
      getInventoryAmount: () => 100,
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => null,
      getResolvedEconomyState: () => ({ cleanMoney: 1000 }),
      getScaledProductionInputs: (inputs, count) => Object.fromEntries(
        Object.entries(inputs || {}).map(([itemId, amount]) => [itemId, Number(amount || 0) * count])
      ),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      persistProductionJob,
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard,
      scheduleProductionJob: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({
      '[data-production-panel="druglab"]': {}
    });
    runtime.renderProductionPanel(root, "druglab", {
      "neon-dust": {
        durationMs: 1000,
        inputs: { chemicals: 3, biomass: 2 },
        output: { inventory: "drugs", itemId: "neon-dust", amount: 6 }
      },
      "pulse-shot": {
        durationMs: 1000,
        inputs: { chemicals: 2, "stim-pack": 1 },
        output: { inventory: "drugs", itemId: "pulse-shot", amount: 5 }
      },
      "velvet-smoke": {
        durationMs: 1000,
        inputs: { biomass: 3, chemicals: 1 },
        output: { inventory: "drugs", itemId: "velvet-smoke", amount: 4 }
      }
    });

    recipeCallbacks["pulse-shot"].onStart({ batchCount: 2 });
    recipeCallbacks["velvet-smoke"].onStart({ batchCount: 1 });

    expect(persistProductionJob).toHaveBeenNthCalledWith(1, "druglab:pulse-shot", expect.objectContaining({
      inputs: { chemicals: 4, "stim-pack": 2 },
      output: expect.objectContaining({ itemId: "pulse-shot", amount: 10 })
    }));
    expect(persistProductionJob).toHaveBeenNthCalledWith(2, "druglab:velvet-smoke", expect.objectContaining({
      inputs: { biomass: 3, chemicals: 1 },
      output: expect.objectContaining({ itemId: "velvet-smoke", amount: 4 })
    }));
  });

  it("reports missing drug lab materials instead of leaving non-neon controls dead", () => {
    const recipeCallbacks = {};
    const persistProductionJob = vi.fn();
    const setBuildingActionFeedback = vi.fn();
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      recipeCallbacks[viewModel.recipeId] = callbacks;
      return { viewModel };
    });
    const runtime = createProductionBuildingPopupRuntime({
      getInventoryAmount: () => 0,
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => null,
      getResolvedEconomyState: () => ({ cleanMoney: 1000 }),
      getScaledProductionInputs: (inputs, count) => Object.fromEntries(
        Object.entries(inputs || {}).map(([itemId, amount]) => [itemId, Number(amount || 0) * count])
      ),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => false,
      persistProductionJob,
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard,
      setBuildingActionFeedback,
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({
      '[data-production-panel="druglab"]': {}
    });
    runtime.renderProductionPanel(root, "druglab", {
      "pulse-shot": {
        durationMs: 1000,
        inputs: { chemicals: 2, "stim-pack": 1 },
        output: { inventory: "drugs", itemId: "pulse-shot", amount: 5 }
      }
    });

    recipeCallbacks["pulse-shot"].onStart({ batchCount: 1 });

    expect(persistProductionJob).not.toHaveBeenCalled();
    expect(setBuildingActionFeedback).toHaveBeenCalledWith(
      root,
      "warning",
      "Budova",
      "Chybí materiál pro spuštění výroby."
    );
  });

  it("queues armory output by selected pieces and caps at 15", () => {
    const recipeCallbacks = {};
    const persistProductionJob = vi.fn();
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      Object.assign(recipeCallbacks, callbacks);
      return { viewModel };
    });
    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { armory: { outputCap: 15 } },
      consumeMaterials: vi.fn(),
      getInventoryAmount: () => 100,
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => null,
      getResolvedEconomyState: () => ({ cleanMoney: 1000 }),
      getScaledProductionInputs: (inputs, count) => Object.fromEntries(
        Object.entries(inputs || {}).map(([itemId, amount]) => [itemId, Number(amount || 0) * count])
      ),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      persistProductionJob,
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard,
      scheduleProductionJob: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({
      '[data-production-panel="armory"]': {}
    });
    runtime.renderProductionPanel(root, "armory", {
      bat: {
        durationMs: 1000,
        inputs: { "metal-parts": 2 },
        output: { inventory: "weapons", itemId: "baseball-bat", amount: 5 }
      }
    });

    recipeCallbacks.onStart({ batchCount: 1 });

    expect(persistProductionJob).toHaveBeenCalledWith("armory:bat", expect.objectContaining({
      status: "running",
      quantity: 1,
      inputs: { "metal-parts": 2 },
      output: expect.objectContaining({ amount: 1 }),
      durationMs: 1000
    }));

    persistProductionJob.mockClear();
    recipeCallbacks.onStart({ batchCount: 20 });

    expect(persistProductionJob).toHaveBeenCalledWith("armory:bat", expect.objectContaining({
      status: "running",
      quantity: 15,
      inputs: { "metal-parts": 30 },
      output: expect.objectContaining({ amount: 15 }),
      durationMs: 15000
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
