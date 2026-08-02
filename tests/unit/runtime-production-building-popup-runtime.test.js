import { describe, expect, it, vi } from "vitest";
import { createProductionBuildingPopupRuntime } from "../../page-assets/js/app/runtime/productionBuildingPopupRuntime.js";
import {
  ARMORY_RECIPES,
  DRUGLAB_RECIPES,
  PHARMACY_RECIPES
} from "../../packages/game-config/src/legacy-page/economy-config.js";

function createElement(dataset = {}) {
  const listeners = new Map();

  return {
    dataset,
    disabled: false,
    hidden: false,
    style: {},
    textContent: "",
    title: "",
    addEventListener: vi.fn((type, listener) => {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    }),
    async dispatch(type) {
      for (const listener of listeners.get(type) || []) {
        await listener({ key: "Escape", type });
      }
    },
    classList: {
      toggle: vi.fn()
    },
    setAttribute: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => [])
  };
}

function createRoot(elements = {}) {
  return {
    querySelector: vi.fn((selector) => elements[selector] || null),
    querySelectorAll: vi.fn((selector) => elements[selector] || [])
  };
}

describe("production building popup runtime", () => {
  it.each([
    ["pharmacy", "Lékárna"],
    ["druglab", "Lab"],
    ["armory", "Zbrojovka"]
  ])("opens %s through the shared direct handoff", async (buildingName, label) => {
    const openButton = createElement();
    const popup = createElement();
    popup.hidden = true;
    popup.querySelectorAll = vi.fn(() => []);
    const closeButton = createElement();
    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { [buildingName]: { label } }
    });
    const root = createRoot({
      ".open": openButton,
      ".popup": popup,
      ".close": [closeButton]
    });

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName,
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    await expect(runtime.openProductionBuildingPopup(root, buildingName)).resolves.toBe(true);
    expect(popup.hidden).toBe(false);
    expect(popup.dataset.executionMode).toBe("local-demo");
  });

  it("evaluates the local production policy when the direct opener runs", async () => {
    let localDemo = false;
    const openButton = createElement();
    const popup = createElement();
    popup.hidden = true;
    popup.querySelectorAll = vi.fn(() => []);
    const prepareServerProductionBuilding = vi.fn(async () => ({
      accepted: true,
      building: { buildingId: "building:district-67:pharmacy:1" },
      districtId: "district:67",
      errors: []
    }));
    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { pharmacy: { label: "Lékárna" } },
      allowLegacyLocalProduction: () => localDemo,
      prepareServerProductionBuilding
    });
    const root = createRoot({
      ".open": openButton,
      ".popup": popup,
      ".close": [createElement()]
    });

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName: "pharmacy",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    localDemo = true;
    await expect(runtime.openProductionBuildingPopup(root, "pharmacy")).resolves.toBe(true);

    expect(prepareServerProductionBuilding).not.toHaveBeenCalled();
    expect(popup.dataset.executionMode).toBe("local-demo");
  });

  it("forwards the exact hosted district-chip target to production preparation", async () => {
    const openButton = createElement();
    const popup = createElement();
    popup.hidden = true;
    popup.querySelectorAll = vi.fn(() => []);
    const prepareServerProductionBuilding = vi.fn(async () => ({
      accepted: true,
      building: { buildingId: "building:district-67:pharmacy:1" },
      districtId: "district:67",
      errors: []
    }));
    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { pharmacy: { label: "Lékárna" } },
      allowLegacyLocalProduction: false,
      prepareServerProductionBuilding
    });
    const root = createRoot({
      ".open": openButton,
      ".popup": popup,
      ".close": [createElement()]
    });
    const request = {
      serverTarget: {
        districtId: "district:67",
        buildingId: "building:district-67:pharmacy:1",
        buildingTypeId: "pharmacy"
      }
    };

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName: "pharmacy",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    await expect(runtime.openProductionBuildingPopup(root, "pharmacy", request)).resolves.toBe(true);
    expect(prepareServerProductionBuilding).toHaveBeenCalledWith("pharmacy", request);
    expect(popup.hidden).toBe(false);
  });

  it("keeps the direct opener scoped to the bound game root", async () => {
    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { pharmacy: { label: "Lékárna" } }
    });
    const popup = createElement();
    popup.hidden = true;
    popup.querySelectorAll = vi.fn(() => []);
    const root = createRoot({
      ".open": createElement(),
      ".popup": popup,
      ".close": [createElement()]
    });
    const unrelatedRoot = createRoot();

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName: "pharmacy",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    expect(runtime.openProductionBuildingPopup(unrelatedRoot, "pharmacy")).toBeNull();
    await expect(runtime.openProductionBuildingPopup(root, "pharmacy")).resolves.toBe(true);
    expect(runtime.clearProductionBuildingPopupOpeners(root)).toBe(true);
    expect(runtime.openProductionBuildingPopup(root, "pharmacy")).toBeNull();
  });

  it("keeps all browser Armory queue caps synchronized with the canonical typed config", () => {
    expect(Object.fromEntries(
      Object.entries(ARMORY_RECIPES).map(([recipeId, recipe]) => [recipeId, recipe.queueCap])
    )).toEqual({
      "baseball-bat": 11,
      pistol: 8,
      grenade: 7,
      smg: 6,
      bazooka: 5,
      vest: 8,
      barricades: 9,
      cameras: 7,
      "defense-tower": 5,
      alarm: 7
    });
  });

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
      getArmoryRecipeStrengthPreview: vi.fn(() => ({ label: "Síla útoku", basePower: 10, bonusLabel: "+0.8" })),
      getResolvedEconomyState: () => ({ cleanMoney: 1000 }),
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
      chemicals: {
        cleanMoneyCost: 360,
        durationMs: 1000,
        inputs: {},
        output: { inventory: "materials", itemId: "chemicals", amount: 1 }
      }
    })).toBe(true);

    recipeCallbacks.onStart({ batchCount: 2 });

    expect(renderProductionPanelUi).toHaveBeenCalledTimes(2);
    expect(setStoredEconomyState).toHaveBeenCalledWith({ cleanMoney: 280 });
    expect(persistProductionJob).toHaveBeenCalledWith("pharmacy:chemicals", expect.objectContaining({
      status: "running",
      quantity: 2,
      queuedAmount: 2,
      producedAmount: 0,
      inputs: {},
      cleanMoneyCost: 720,
      output: expect.objectContaining({ amount: 0 })
    }));
  });

  it("adds the active production boost reduction to recipe timing", () => {
    const renderedCards = [];
    const runtime = createProductionBuildingPopupRuntime({
      getInventoryAmount: () => 10,
      getPlayerProductionBoostSnapshot: () => ({ multiplier: 1.25 }),
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => null,
      getResolvedEconomyState: () => ({ cleanMoney: 1000 }),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard: vi.fn((viewModel) => {
        renderedCards.push(viewModel);
        return {};
      }),
      syncCompletedProductionJobs: vi.fn()
    });
    const root = createRoot({
      '[data-production-panel="pharmacy"]': {}
    });

    runtime.renderProductionPanel(root, "pharmacy", {
      chemicals: {
        durationMs: 10_000,
        inputs: {},
        output: { inventory: "materials", itemId: "chemicals", amount: 1 }
      }
    });

    expect(renderedCards[0]).toMatchObject({
      effectiveDurationMs: 8_000,
      durationBonusLabel: "−20 %"
    });
  });

  it("renders no legacy recipe callbacks while the server building is loading", () => {
    const persistProductionJob = vi.fn();
    const renderRecipeCard = vi.fn();
    const renderProductionPanelUi = vi.fn(() => true);
    const syncCompletedProductionJobs = vi.fn();
    const runtime = createProductionBuildingPopupRuntime({
      allowLegacyLocalProduction: false,
      getInventoryAmount: () => 10,
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => null,
      getResolvedEconomyState: () => ({ cleanMoney: 1000 }),
      getScaledProductionInputs: vi.fn(),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      persistProductionJob,
      renderProductionPanelUi,
      renderRecipeCard,
      syncCompletedProductionJobs
    });
    const root = createRoot({
      '[data-production-panel="pharmacy"]': {}
    });

    expect(runtime.renderProductionPanel(root, "pharmacy", {
      tonic: {
        durationMs: 1000,
        inputs: { chemicals: 1 },
        output: { inventory: "materials", itemId: "chemicals", amount: 1 }
      }
    })).toBe(true);

    expect(renderRecipeCard).not.toHaveBeenCalled();
    expect(persistProductionJob).not.toHaveBeenCalled();
    expect(syncCompletedProductionJobs).not.toHaveBeenCalled();
    expect(renderProductionPanelUi).toHaveBeenCalledWith(
      expect.objectContaining({ recipes: [] }),
      {},
      expect.anything()
    );
  });

  it("renders Armory lines from the server model and submits generic production commands", async () => {
    let callbacks = {};
    let renderedViewModel = null;
    let renderedOptions = null;
    const submitServerArmoryCommand = vi.fn(async () => ({ errors: [] }));
    const getArmoryRecipeStrengthPreview = vi.fn(() => ({
      label: "Síla útoku",
      basePower: 4,
      bonusPower: 0.4,
      bonusLabel: "+0.4"
    }));
    const getProductionResourceLabel = vi.fn((resourceKey) => ({
      "metal-parts": "Metal Parts",
      "tech-core": "Tech Core"
    })[resourceKey] || resourceKey);
    const renderRecipeCard = vi.fn((viewModel, nextCallbacks, options) => {
      callbacks = nextCallbacks;
      renderedViewModel = viewModel;
      renderedOptions = options;
      return {};
    });
    const runtime = createProductionBuildingPopupRuntime({
      allowLegacyLocalProduction: true,
      isServerAuthoritativeGameplayRuntimeReady: () => true,
      getServerArmoryReadModel: () => ({
        districtId: "district:1",
        buildingId: "building:armory:1",
        productionLines: [{
          recipeId: "pistol",
          category: "attack",
          resourceKey: "pistol",
          label: "Pistole",
          producedAmount: 2,
          producedCapacity: 5,
          playerStoredAmount: 7,
          playerStoredCapacity: 24,
          queuedAmount: 3,
          queueCapacity: 4,
          activeAmount: 1,
          waitingAmount: 2,
          unitCleanCashCost: 0,
          inputAvailability: [
            { resourceKey: "metal-parts", label: "Metal Parts", requiredAmount: 3, availableAmount: 12 },
            { resourceKey: "tech-core", label: "Tech Core", requiredAmount: 1, availableAmount: 4 }
          ],
          effectiveUnitDurationTicks: 75,
          remainingMs: 120000,
          status: "processing",
          maxStartQuantity: 2,
          canStart: true,
          canCancelWaiting: true,
          disabledReason: "Serverová autorita dočasně blokuje start."
        }]
      }),
      getArmoryRecipeStrengthPreview,
      getProductionResourceLabel,
      getServerTickRateMs: () => 4000,
      normalizeProductionResourceColorKey: (resourceKey) => `color:${resourceKey}`,
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard,
      setBuildingActionFeedback: vi.fn(),
      submitServerArmoryCommand
    });
    const root = createRoot({
      '[data-production-panel="armory"]': {}
    });

    expect(runtime.renderProductionPanel(root, "armory", ARMORY_RECIPES)).toBe(true);
    expect(renderedViewModel).toMatchObject({
      buildingId: "building:armory:1",
      buildingName: "armory",
      recipeId: "pistol",
      recipe: {
        name: "Pistole",
        inputs: { "metal-parts": 3, "tech-core": 1 },
        cleanMoneyCost: 0,
        durationMs: 300000,
        output: { inventory: "weapons", itemId: "pistol", amount: 1 }
      },
      job: {
        status: "running",
        queuedAmount: 3,
        producedAmount: 2
      },
      slotState: { label: "Výroba", isActive: true },
      outputInventoryAmount: 7,
      outputInventoryCapacity: 24,
      outputCap: 5,
      queueCap: 4,
      inputAmounts: { "metal-parts": 12, "tech-core": 4 },
      maxBatches: 2,
      maxSelectableBatches: 2,
      disabledReason: "Serverová autorita dočasně blokuje start.",
      armoryStrengthPreview: { label: "Síla útoku", basePower: 4, bonusPower: 0.4, bonusLabel: "+0.4" }
    });
    expect(renderedViewModel).not.toHaveProperty("serverLine");
    expect(getArmoryRecipeStrengthPreview).toHaveBeenCalledWith("pistol", expect.objectContaining({
      inputs: { "metal-parts": 3, "tech-core": 1 }
    }));
    expect(renderedOptions).toMatchObject({
      getResourceLabel: getProductionResourceLabel,
      normalizeResourceColorKey: expect.any(Function)
    });
    await callbacks.onStart({ batchCount: 2 });
    await callbacks.onStop();

    expect(submitServerArmoryCommand).toHaveBeenNthCalledWith(1, {
      type: "craft-item",
      payload: { districtId: "district:1", buildingId: "building:armory:1", recipeId: "pistol", quantity: 2 }
    });
    expect(submitServerArmoryCommand).toHaveBeenNthCalledWith(2, {
      type: "cancel-production-line",
      payload: { districtId: "district:1", buildingId: "building:armory:1", recipeId: "pistol" }
    });
  });

  it("maps the complete Pharmacy server stat schema into the shared recipe renderer", () => {
    let renderedViewModel = null;
    const runtime = createProductionBuildingPopupRuntime({
      allowLegacyLocalProduction: false,
      getServerPharmacyReadModel: () => ({
        districtId: "district:1",
        buildingId: "building:pharmacy:1",
        lines: [{
          recipeId: "chemicals",
          resourceKey: "chemicals",
          label: "Chemicals",
          producedAmount: 2,
          producedCapacity: 12,
          playerStoredAmount: 200,
          playerStoredCapacity: 90,
          queuedAmount: 1,
          queueCapacity: 8,
          activeAmount: 1,
          waitingAmount: 0,
          unitCleanCashCost: 360,
          effectiveUnitDurationTicks: 12,
          remainingMs: 30000,
          status: "processing",
          canStart: false,
          canCancelWaiting: false,
          maxStartQuantity: 0,
          disabledReason: "Lokální zásoba Lékárny je plná."
        }]
      }),
      getServerTickRateMs: () => 5000,
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard: vi.fn((viewModel) => {
        renderedViewModel = viewModel;
        return { viewModel };
      })
    });

    expect(runtime.renderProductionPanel(createRoot({
      '[data-production-panel="pharmacy"]': {}
    }), "pharmacy", PHARMACY_RECIPES)).toBe(true);
    expect(renderedViewModel).toMatchObject({
      buildingId: "building:pharmacy:1",
      buildingName: "pharmacy",
      recipeId: "chemicals",
      job: { status: "running", producedAmount: 2, queuedAmount: 1 },
      effectiveDurationMs: 60000,
      outputInventoryAmount: 200,
      outputInventoryCapacity: 90,
      outputCap: 12,
      queueCap: 8,
      canStart: false,
      canCancelWaiting: false,
      disabledReason: "Lokální zásoba Lékárny je plná."
    });
  });

  it("keeps Drug Lab and Armory in local edit mode without reading server production", () => {
    const getServerDrugLabReadModel = vi.fn();
    const getServerArmoryReadModel = vi.fn();
    const renderRecipeCard = vi.fn((viewModel) => ({ viewModel }));
    const renderProductionPanelUi = vi.fn(() => true);
    const runtime = createProductionBuildingPopupRuntime({
      allowLegacyLocalProduction: true,
      getInventoryAmount: () => 20,
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => null,
      getResolvedEconomyState: () => ({ cleanMoney: 1000 }),
      getServerDrugLabReadModel,
      getServerArmoryReadModel,
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      renderProductionPanelUi,
      renderRecipeCard,
      syncCompletedProductionJobs: vi.fn()
    });
    const root = createRoot({
      '[data-production-panel="druglab"]': {},
      '[data-production-panel="armory"]': {}
    });
    const recipe = {
      cleanMoneyCost: 0,
      durationMs: 1000,
      inputs: {},
      output: { inventory: "materials", itemId: "neon-dust", amount: 1 }
    };

    expect(runtime.renderProductionPanel(root, "druglab", { "neon-dust": recipe })).toBe(true);
    expect(runtime.renderProductionPanel(root, "armory", { pistol: recipe })).toBe(true);

    expect(getServerDrugLabReadModel).not.toHaveBeenCalled();
    expect(getServerArmoryReadModel).not.toHaveBeenCalled();
    expect(renderRecipeCard).toHaveBeenCalledTimes(2);
    expect(renderRecipeCard.mock.calls[0][0]).toMatchObject({ buildingName: "druglab", canStart: true });
    expect(renderRecipeCard.mock.calls[1][0]).toMatchObject({ buildingName: "armory", canStart: true });
  });

  it("passes recipe-specific local output and queue capacities to Pharmacy and Drug Lab cards", () => {
    const renderedCards = [];
    const runtime = createProductionBuildingPopupRuntime({
      getInventoryAmount: () => 100,
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => null,
      getResolvedEconomyState: () => ({ cleanMoney: 100000 }),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard: vi.fn((viewModel) => {
        renderedCards.push(viewModel);
        return {};
      }),
      syncCompletedProductionJobs: vi.fn()
    });
    const root = createRoot({
      '[data-production-panel="pharmacy"]': {},
      '[data-production-panel="druglab"]': {}
    });

    runtime.renderProductionPanel(root, "pharmacy", PHARMACY_RECIPES);
    runtime.renderProductionPanel(root, "druglab", DRUGLAB_RECIPES);

    expect(renderedCards.filter((card) => card.buildingName === "pharmacy")).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipeId: "chemicals", outputCap: 12, queueCap: 15 }),
      expect.objectContaining({ recipeId: "biomass", outputCap: 8, queueCap: 11 }),
      expect.objectContaining({ recipeId: "stim-pack", outputCap: 4, queueCap: 7 })
    ]));
    expect(renderedCards.filter((card) => card.buildingName === "druglab")).toEqual(expect.arrayContaining([
      expect.objectContaining({ recipeId: "neon-dust", outputCap: 10, queueCap: 13 }),
      expect.objectContaining({ recipeId: "pulse-shot", outputCap: 6, queueCap: 9 }),
      expect.objectContaining({ recipeId: "velvet-smoke", outputCap: 5, queueCap: 8 }),
      expect.objectContaining({ recipeId: "ghost-serum", outputCap: 2, queueCap: 5 }),
      expect.objectContaining({ recipeId: "overdrive-x", outputCap: 1, queueCap: 4 })
    ]));
  });

  it("upgrades the exact server-owned production building without local state writes", async () => {
    const openButton = createElement();
    const popup = createElement();
    const closeButton = createElement();
    const collectButton = createElement();
    const upgradeButton = createElement();
    const setBuildingActionFeedback = vi.fn();
    const upgradeConfirmation = {
      close: vi.fn(),
      isOpen: vi.fn(() => false),
      open: vi.fn(() => Promise.resolve(true))
    };
    const createUpgradeConfirmationController = vi.fn(() => upgradeConfirmation);
    const submitServerProductionBuildingUpgrade = vi.fn(async () => ({
      accepted: true,
      errors: []
    }));
    popup.querySelector = vi.fn((selector) => ({
      "[data-production-building-level]": createElement(),
      "[data-production-building-header-level]": createElement(),
      "[data-production-building-multiplier]": createElement(),
      "[data-production-building-ready]": createElement(),
      "[data-production-building-upgrade-cost]": createElement(),
      "[data-production-building-effects]": createElement(),
      "[data-production-building-collect]": collectButton,
      "[data-production-building-upgrade]": upgradeButton,
      "[data-production-building-info-text]": createElement(),
      "[data-production-building-info-effects]": createElement(),
      "[data-production-building-info-actions]": createElement(),
      "[data-production-building-info-upgrade-cost]": createElement(),
      "[data-production-building-info-upgrade-benefit]": createElement()
    }[selector] || null));
    popup.querySelectorAll = vi.fn(() => []);

    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { pharmacy: { label: "Lékárna" } },
      allowLegacyProductionUpgrade: false,
      createUpgradeConfirmationController,
      formatCurrency: (value) => `$${value}`,
      getResolvedEconomyState: () => ({ cleanMoney: 1000 }),
      getProductionBuildingEffectsLabel: () => "x1.00",
      getProductionBuildingMultiplier: () => 1,
      getProductionBuildingReadyCount: () => 0,
      getProductionBuildingUpgradeCost: () => 100,
      getServerPharmacyReadModel: () => ({
        districtId: "district:21",
        buildingId: "building:district-21:pharmacy:2",
        level: 3,
        productionLines: []
      }),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      isServerAuthoritativeGameplayRuntimeReady: () => true,
      renderProductionBuildingInfoPanel: vi.fn(),
      renderProductionPanelUi: vi.fn(() => true),
      selectors: {
        collect: "[data-production-building-collect]",
        effects: "[data-production-building-effects]",
        headerLevel: "[data-production-building-header-level]",
        infoActions: "[data-production-building-info-actions]",
        infoEffects: "[data-production-building-info-effects]",
        infoText: "[data-production-building-info-text]",
        level: "[data-production-building-level]",
        multiplier: "[data-production-building-multiplier]",
        panel: "[data-production-building-panel]",
        ready: "[data-production-building-ready]",
        tab: "[data-production-building-tab]",
        upgrade: "[data-production-building-upgrade]",
        upgradeCost: "[data-production-building-upgrade-cost]"
      },
      setBuildingActionFeedback,
      submitServerProductionBuildingUpgrade,
      syncBuildingDetailTopbarVisibility: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });
    const root = createRoot({
      ".open": openButton,
      ".popup": popup,
      ".close": [closeButton],
      '[data-production-panel="pharmacy"]': {}
    });

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName: "pharmacy",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    await openButton.dispatch("click");
    expect(upgradeButton.disabled).toBe(false);

    await upgradeButton.dispatch("click");
    expect(upgradeConfirmation.open).toHaveBeenCalledWith(expect.objectContaining({
      canConfirm: true,
      costLabel: "$100",
      noteLabel: "Po potvrzení zaplatíš $100 clean cash.",
      upgradeLabel: "L3 → L4"
    }));
    expect(submitServerProductionBuildingUpgrade).toHaveBeenCalledWith({
      districtId: "district:21",
      buildingId: "building:district-21:pharmacy:2"
    });
  });

  it("shows owned pharmacy network count in the pharmacy overview level slot", async () => {
    const openButton = createElement();
    const popup = createElement();
    const closeButton = createElement();
    const levelElement = createElement();
    const headerLevelElement = createElement();
    const multiplierElement = createElement();
    popup.querySelector = vi.fn((selector) => ({
      "[data-production-building-level]": levelElement,
      "[data-production-building-header-level]": headerLevelElement,
      "[data-production-building-multiplier]": multiplierElement,
      "[data-production-building-ready]": createElement(),
      "[data-production-building-upgrade-cost]": createElement(),
      "[data-production-building-effects]": createElement(),
      "[data-production-building-collect]": createElement(),
      "[data-production-building-upgrade]": createElement(),
      "[data-production-building-info-text]": createElement(),
      "[data-production-building-info-effects]": createElement(),
      "[data-production-building-info-actions]": createElement(),
      "[data-production-building-info-upgrade-cost]": createElement(),
      "[data-production-building-info-upgrade-benefit]": createElement()
    }[selector] || null));
    popup.querySelectorAll = vi.fn(() => []);

    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { pharmacy: { label: "Lékárna" } },
      formatCurrency: (value) => `$${value}`,
      getOwnedPharmacyCount: () => 4,
      getProductionBuildingEffectsLabel: () => "x1.10",
      getProductionBuildingMultiplier: (_name, level = 1) => 1 + ((level - 1) * 0.1),
      getProductionBuildingReadyCount: () => 0,
      getProductionBuildingUpgradeCost: () => 100,
      getStoredProductionBuildingState: () => ({ level: 2 }),
      renderProductionBuildingInfoPanel: vi.fn(),
      renderProductionPanelUi: vi.fn(() => true),
      selectors: {
        collect: "[data-production-building-collect]",
        effects: "[data-production-building-effects]",
        headerLevel: "[data-production-building-header-level]",
        infoActions: "[data-production-building-info-actions]",
        infoEffects: "[data-production-building-info-effects]",
        infoText: "[data-production-building-info-text]",
        level: "[data-production-building-level]",
        multiplier: "[data-production-building-multiplier]",
        panel: "[data-production-building-panel]",
        ready: "[data-production-building-ready]",
        tab: "[data-production-building-tab]",
        upgrade: "[data-production-building-upgrade]",
        upgradeCost: "[data-production-building-upgrade-cost]"
      },
      syncBuildingDetailTopbarVisibility: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });
    const root = createRoot({
      ".open": openButton,
      ".popup": popup,
      ".close": [closeButton],
      '[data-production-panel="pharmacy"]': {}
    });

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName: "pharmacy",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    await openButton.dispatch("click");

    expect(levelElement.textContent).toBe("4");
    expect(headerLevelElement.textContent).toBe("Lv 2");
    expect(multiplierElement.textContent).toBe("+10%");
  });

  it("keeps pharmacy network count at one even without an owned pharmacy district", async () => {
    const openButton = createElement();
    const popup = createElement();
    const closeButton = createElement();
    const levelElement = createElement();
    popup.querySelector = vi.fn((selector) => ({
      "[data-production-building-level]": levelElement,
      "[data-production-building-header-level]": createElement(),
      "[data-production-building-multiplier]": createElement(),
      "[data-production-building-ready]": createElement(),
      "[data-production-building-upgrade-cost]": createElement(),
      "[data-production-building-effects]": createElement(),
      "[data-production-building-collect]": createElement(),
      "[data-production-building-upgrade]": createElement(),
      "[data-production-building-info-text]": createElement(),
      "[data-production-building-info-effects]": createElement(),
      "[data-production-building-info-actions]": createElement(),
      "[data-production-building-info-upgrade-cost]": createElement(),
      "[data-production-building-info-upgrade-benefit]": createElement()
    }[selector] || null));
    popup.querySelectorAll = vi.fn(() => []);

    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { pharmacy: { label: "Lékárna" } },
      formatCurrency: (value) => `$${value}`,
      getOwnedPharmacyCount: () => 0,
      getProductionBuildingEffectsLabel: () => "x1.00",
      getProductionBuildingMultiplier: () => 1,
      getProductionBuildingReadyCount: () => 0,
      getProductionBuildingUpgradeCost: () => 100,
      getStoredProductionBuildingState: () => ({ level: 1 }),
      renderProductionBuildingInfoPanel: vi.fn(),
      renderProductionPanelUi: vi.fn(() => true),
      selectors: {
        collect: "[data-production-building-collect]",
        effects: "[data-production-building-effects]",
        headerLevel: "[data-production-building-header-level]",
        infoActions: "[data-production-building-info-actions]",
        infoEffects: "[data-production-building-info-effects]",
        infoText: "[data-production-building-info-text]",
        level: "[data-production-building-level]",
        multiplier: "[data-production-building-multiplier]",
        panel: "[data-production-building-panel]",
        ready: "[data-production-building-ready]",
        tab: "[data-production-building-tab]",
        upgrade: "[data-production-building-upgrade]",
        upgradeCost: "[data-production-building-upgrade-cost]"
      },
      syncBuildingDetailTopbarVisibility: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });
    const root = createRoot({
      ".open": openButton,
      ".popup": popup,
      ".close": [closeButton],
      '[data-production-panel="pharmacy"]': {}
    });

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName: "pharmacy",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    await openButton.dispatch("click");

    expect(levelElement.textContent).toBe("1");
  });

  it("shows owned drug lab network count in the lab overview network slot", async () => {
    const openButton = createElement();
    const popup = createElement();
    const closeButton = createElement();
    const levelElement = createElement();
    const headerLevelElement = createElement();
    const multiplierElement = createElement();
    popup.querySelector = vi.fn((selector) => ({
      "[data-production-building-level]": levelElement,
      "[data-production-building-header-level]": headerLevelElement,
      "[data-production-building-multiplier]": multiplierElement,
      "[data-production-building-ready]": createElement(),
      "[data-production-building-upgrade-cost]": createElement(),
      "[data-production-building-effects]": createElement(),
      "[data-production-building-collect]": createElement(),
      "[data-production-building-upgrade]": createElement(),
      "[data-production-building-info-text]": createElement(),
      "[data-production-building-info-effects]": createElement(),
      "[data-production-building-info-actions]": createElement(),
      "[data-production-building-info-upgrade-cost]": createElement(),
      "[data-production-building-info-upgrade-benefit]": createElement()
    }[selector] || null));
    popup.querySelectorAll = vi.fn(() => []);

    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { druglab: { label: "Lab" } },
      formatCurrency: (value) => `$${value}`,
      getOwnedDrugLabCount: () => 3,
      getProductionBuildingEffectsLabel: () => "x1.20",
      getProductionBuildingMultiplier: (_name, level = 1) => 1 + ((level - 1) * 0.1),
      getProductionBuildingReadyCount: () => 0,
      getProductionBuildingUpgradeCost: () => 100,
      getStoredProductionBuildingState: () => ({ level: 2 }),
      renderProductionBuildingInfoPanel: vi.fn(),
      renderProductionPanelUi: vi.fn(() => true),
      selectors: {
        collect: "[data-production-building-collect]",
        effects: "[data-production-building-effects]",
        headerLevel: "[data-production-building-header-level]",
        infoActions: "[data-production-building-info-actions]",
        infoEffects: "[data-production-building-info-effects]",
        infoText: "[data-production-building-info-text]",
        level: "[data-production-building-level]",
        multiplier: "[data-production-building-multiplier]",
        panel: "[data-production-building-panel]",
        ready: "[data-production-building-ready]",
        tab: "[data-production-building-tab]",
        upgrade: "[data-production-building-upgrade]",
        upgradeCost: "[data-production-building-upgrade-cost]"
      },
      syncBuildingDetailTopbarVisibility: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });
    const root = createRoot({
      ".open": openButton,
      ".popup": popup,
      ".close": [closeButton],
      '[data-production-panel="druglab"]': {}
    });

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName: "druglab",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    await openButton.dispatch("click");

    expect(levelElement.textContent).toBe("3");
    expect(headerLevelElement.textContent).toBe("Lv 2");
    expect(multiplierElement.textContent).toBe("+10%");
  });

  it("shows owned armory network count in the armory overview network slot", async () => {
    const openButton = createElement();
    const popup = createElement();
    const closeButton = createElement();
    const levelElement = createElement();
    const headerLevelElement = createElement();
    const multiplierElement = createElement();
    popup.querySelector = vi.fn((selector) => ({
      "[data-production-building-level]": levelElement,
      "[data-production-building-header-level]": headerLevelElement,
      "[data-production-building-multiplier]": multiplierElement,
      "[data-production-building-ready]": createElement(),
      "[data-production-building-upgrade-cost]": createElement(),
      "[data-production-building-effects]": createElement(),
      "[data-production-building-collect]": createElement(),
      "[data-production-building-upgrade]": createElement(),
      "[data-production-building-info-text]": createElement(),
      "[data-production-building-info-effects]": createElement(),
      "[data-production-building-info-actions]": createElement(),
      "[data-production-building-info-upgrade-cost]": createElement(),
      "[data-production-building-info-upgrade-benefit]": createElement()
    }[selector] || null));
    popup.querySelectorAll = vi.fn(() => []);

    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { armory: { label: "Zbrojovka" } },
      formatCurrency: (value) => `$${value}`,
      getOwnedArmoryCount: () => 5,
      getProductionBuildingEffectsLabel: () => "x1.30",
      getProductionBuildingMultiplier: (_name, level = 1) => 1 + ((level - 1) * 0.1),
      getProductionBuildingReadyCount: () => 0,
      getProductionBuildingUpgradeCost: () => 100,
      getStoredProductionBuildingState: () => ({ level: 3 }),
      renderProductionBuildingInfoPanel: vi.fn(),
      renderProductionPanelUi: vi.fn(() => true),
      selectors: {
        collect: "[data-production-building-collect]",
        effects: "[data-production-building-effects]",
        headerLevel: "[data-production-building-header-level]",
        infoActions: "[data-production-building-info-actions]",
        infoEffects: "[data-production-building-info-effects]",
        infoText: "[data-production-building-info-text]",
        level: "[data-production-building-level]",
        multiplier: "[data-production-building-multiplier]",
        panel: "[data-production-building-panel]",
        ready: "[data-production-building-ready]",
        tab: "[data-production-building-tab]",
        upgrade: "[data-production-building-upgrade]",
        upgradeCost: "[data-production-building-upgrade-cost]"
      },
      syncBuildingDetailTopbarVisibility: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });
    const root = createRoot({
      ".open": openButton,
      ".popup": popup,
      ".close": [closeButton],
      '[data-production-panel="armory"]': {}
    });

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName: "armory",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    await openButton.dispatch("click");

    expect(levelElement.textContent).toBe("5");
    expect(headerLevelElement.textContent).toBe("Lv 3");
    expect(multiplierElement.textContent).toBe("+20%");
  });

  it("hides production upgrade button when no next upgrade exists", async () => {
    const openButton = createElement();
    const popup = createElement();
    const closeButton = createElement();
    const collectButton = createElement();
    const upgradeButton = createElement();
    popup.querySelector = vi.fn((selector) => ({
      "[data-production-building-level]": createElement(),
      "[data-production-building-header-level]": createElement(),
      "[data-production-building-multiplier]": createElement(),
      "[data-production-building-ready]": createElement(),
      "[data-production-building-upgrade-cost]": createElement(),
      "[data-production-building-effects]": createElement(),
      "[data-production-building-collect]": collectButton,
      "[data-production-building-upgrade]": upgradeButton,
      "[data-production-building-info-text]": createElement(),
      "[data-production-building-info-effects]": createElement(),
      "[data-production-building-info-actions]": createElement(),
      "[data-production-building-info-upgrade-cost]": createElement(),
      "[data-production-building-info-upgrade-benefit]": createElement()
    }[selector] || null));
    popup.querySelectorAll = vi.fn(() => []);

    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { pharmacy: { label: "Lékárna" } },
      formatCurrency: (value) => `$${value}`,
      getProductionBuildingEffectsLabel: () => "x1.00",
      getProductionBuildingMultiplier: () => 1,
      getProductionBuildingReadyCount: () => 0,
      getProductionBuildingUpgradeCost: () => 100,
      getStoredProductionBuildingState: () => ({ level: 1 }),
      maxLevel: 1,
      renderProductionBuildingInfoPanel: vi.fn(),
      renderProductionPanelUi: vi.fn(() => true),
      selectors: {
        collect: "[data-production-building-collect]",
        effects: "[data-production-building-effects]",
        headerLevel: "[data-production-building-header-level]",
        infoActions: "[data-production-building-info-actions]",
        infoEffects: "[data-production-building-info-effects]",
        infoText: "[data-production-building-info-text]",
        level: "[data-production-building-level]",
        multiplier: "[data-production-building-multiplier]",
        panel: "[data-production-building-panel]",
        ready: "[data-production-building-ready]",
        tab: "[data-production-building-tab]",
        upgrade: "[data-production-building-upgrade]",
        upgradeCost: "[data-production-building-upgrade-cost]"
      },
      syncBuildingDetailTopbarVisibility: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });
    const root = createRoot({
      ".open": openButton,
      ".popup": popup,
      ".close": [closeButton],
      '[data-production-panel="pharmacy"]': {}
    });

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName: "pharmacy",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    await openButton.dispatch("click");

    expect(upgradeButton.hidden).toBe(true);
    expect(upgradeButton.style.display).toBe("none");
    expect(upgradeButton.disabled).toBe(true);
  });

  it("cancels only the waiting Pharmacy unit and preserves the active reservation", () => {
    const recipeCallbacks = {};
    const clearProductionJob = vi.fn();
    const persistProductionJob = vi.fn();
    const setInventoryAmount = vi.fn();
    const setStoredEconomyState = vi.fn();
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      Object.assign(recipeCallbacks, callbacks);
      return { viewModel };
    });
    const runtime = createProductionBuildingPopupRuntime({
      applyTopbarEconomy: vi.fn(),
      clearProductionJob,
      getInventoryAmount: vi.fn(() => 0),
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => ({
        status: "running",
        quantity: 2,
        inputs: {},
        cleanMoneyCost: 720,
        output: { inventory: "materials", itemId: "chemicals", amount: 2 },
        durationMs: 2000
      }),
      getResolvedEconomyState: () => ({ cleanMoney: 280 }),
      getScaledProductionInputs: vi.fn((inputs, count) => Object.fromEntries(
        Object.entries(inputs || {}).map(([itemId, amount]) => [itemId, Number(amount || 0) * count])
      )),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      persistProductionJob,
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
      chemicals: {
        cleanMoneyCost: 360,
        durationMs: 1000,
        inputs: {},
        output: { inventory: "materials", itemId: "chemicals", amount: 1 }
      }
    });

    recipeCallbacks.onStop();

    expect(setInventoryAmount).not.toHaveBeenCalled();
    expect(setStoredEconomyState).toHaveBeenCalledWith({ cleanMoney: 640 });
    expect(persistProductionJob).toHaveBeenCalledWith("pharmacy:chemicals", expect.objectContaining({
      quantity: 1,
      queuedAmount: 1,
      producedAmount: 0,
      inputs: {},
      cleanMoneyCost: 360,
      output: expect.objectContaining({ amount: 0 })
    }));
    expect(clearProductionJob).not.toHaveBeenCalled();
  });

  it("keeps ready local output in the building when starting a new production batch", () => {
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
      '[data-production-panel="pharmacy"]': {}
    });
    runtime.renderProductionPanel(root, "pharmacy", {
      chemicals: {
        cleanMoneyCost: 360,
        durationMs: 1000,
        inputs: {},
        output: { inventory: "materials", itemId: "chemicals", amount: 1 }
      }
    });

    recipeCallbacks.onStart({ batchCount: 1 });

    expect(applyInventoryOutput).not.toHaveBeenCalled();
    expect(clearProductionJob).not.toHaveBeenCalled();
    expect(persistProductionJob).toHaveBeenCalledWith("pharmacy:chemicals", expect.objectContaining({
      status: "running",
      quantity: 1,
      queuedAmount: 1,
      producedAmount: 2,
      output: expect.objectContaining({ amount: 2 })
    }));
  });

  it("keeps the production remainder in a building when the local storage is full", () => {
    const recipeCallbacks = {};
    const applyInventoryOutput = vi.fn();
    const clearProductionJob = vi.fn();
    const persistProductionJob = vi.fn();
    const runtime = createProductionBuildingPopupRuntime({
      applyInventoryOutput,
      clearProductionJob,
      getInventoryAmount: () => 0,
      getInventoryCapacity: () => 60,
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => ({
        status: "ready",
        quantity: 2,
        queuedAmount: 0,
        producedAmount: 2,
        localOutputCap: 12,
        output: { inventory: "materials", itemId: "chemicals", amount: 2 },
        durationMs: 2000
      }),
      getReceivableInventoryOutputAmount: () => 1,
      getResolvedEconomyState: () => ({ cleanMoney: 1000 }),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      persistProductionJob,
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard: vi.fn((viewModel, callbacks) => {
        Object.assign(recipeCallbacks, callbacks);
        return { viewModel };
      }),
      scheduleProductionJob: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({ '[data-production-panel="pharmacy"]': {} });
    runtime.renderProductionPanel(root, "pharmacy", {
      chemicals: {
        cleanMoneyCost: 360,
        durationMs: 2000,
        inputs: {},
        localOutputCap: 12,
        queueCap: 8,
        output: { inventory: "materials", itemId: "chemicals", amount: 1 }
      }
    });

    recipeCallbacks.onCollect();

    expect(applyInventoryOutput).toHaveBeenCalledWith({ inventory: "materials", itemId: "chemicals", amount: 1 });
    expect(persistProductionJob).toHaveBeenCalledWith("pharmacy:chemicals", expect.objectContaining({
      producedAmount: 1,
      output: expect.objectContaining({ amount: 1 })
    }));
    expect(clearProductionJob).not.toHaveBeenCalled();
  });

  it("submits a selected Drug Lab batch through the server command", async () => {
    const recipeCallbacks = {};
    let renderedViewModel = null;
    const submitServerDrugLabCommand = vi.fn(async () => ({ errors: [] }));
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      Object.assign(recipeCallbacks, callbacks);
      renderedViewModel = viewModel;
      return { viewModel };
    });
    const runtime = createProductionBuildingPopupRuntime({
      allowLegacyLocalProduction: false,
      getServerDrugLabReadModel: () => ({
        districtId: "district:1",
        buildingId: "building:drug-lab:1",
        cleanCashAmount: 1000,
        lines: [{
          recipeId: "neon-dust",
          resourceKey: "neon-dust",
          label: "Neon Dust",
          unitCleanCashCost: 500,
          producedAmount: 1,
          producedCapacity: 10,
          playerStoredAmount: 4,
          playerStoredCapacity: 20,
          queuedAmount: 1,
          queueCapacity: 13,
          activeAmount: 1,
          waitingAmount: 0,
          inputAvailability: [{ resourceKey: "chemicals", label: "Chemicals", requiredAmount: 2, availableAmount: 9 }],
          effectiveUnitDurationTicks: 60,
          remainingMs: 45000,
          status: "processing",
          canStart: true,
          canCancelWaiting: false,
          maxStartQuantity: 2,
          disabledReason: "Serverový Lab je dočasně blokovaný."
        }]
      }),
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard,
      submitServerDrugLabCommand
    });

    const root = createRoot({
      '[data-production-panel="druglab"]': {}
    });
    runtime.renderProductionPanel(root, "druglab", DRUGLAB_RECIPES);

    expect(renderedViewModel).toMatchObject({
      buildingId: "building:drug-lab:1",
      buildingName: "druglab",
      recipeId: "neon-dust",
      recipe: {
        inputs: { chemicals: 2 },
        cleanMoneyCost: 500,
        output: { inventory: "drugs", itemId: "neon-dust", amount: 1 }
      },
      job: { status: "running", queuedAmount: 1, producedAmount: 1 },
      outputInventoryAmount: 4,
      outputInventoryCapacity: 20,
      outputCap: 10,
      queueCap: 13,
      inputAmounts: { chemicals: 9 },
      canCancelWaiting: false,
      disabledReason: "Serverový Lab je dočasně blokovaný.",
      maxBatches: 2
    });
    expect(renderedViewModel).not.toHaveProperty("serverLine");

    await recipeCallbacks.onStart({ batchCount: 2 });

    expect(submitServerDrugLabCommand).toHaveBeenCalledWith({
      type: "craft-item",
      payload: { districtId: "district:1", buildingId: "building:drug-lab:1", recipeId: "neon-dust", quantity: 2 }
    });
  });

  it("keeps each server Drug Lab recipe wired to its own command key", async () => {
    const recipeCallbacks = {};
    const submitServerDrugLabCommand = vi.fn(async () => ({ errors: [] }));
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      recipeCallbacks[viewModel.recipeId] = callbacks;
      return { viewModel };
    });
    const runtime = createProductionBuildingPopupRuntime({
      allowLegacyLocalProduction: false,
      getServerDrugLabReadModel: () => ({
        districtId: "district:1",
        buildingId: "building:drug-lab:1",
        cleanCashAmount: 1000,
        lines: [
          { recipeId: "pulse-shot", resourceKey: "pulse-shot", label: "Pulse Shot", unitCleanCashCost: 800, inputAvailability: [], canStart: true, canCancelWaiting: false, maxStartQuantity: 2 },
          { recipeId: "velvet-smoke", resourceKey: "velvet-smoke", label: "Velvet Smoke", unitCleanCashCost: 900, inputAvailability: [], canStart: true, canCancelWaiting: false, maxStartQuantity: 1 }
        ]
      }),
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard,
      submitServerDrugLabCommand
    });

    const root = createRoot({
      '[data-production-panel="druglab"]': {}
    });
    runtime.renderProductionPanel(root, "druglab", {
      "pulse-shot": {},
      "velvet-smoke": {}
    });

    await recipeCallbacks["pulse-shot"].onStart({ batchCount: 2 });
    await recipeCallbacks["velvet-smoke"].onStart({ batchCount: 1 });

    expect(submitServerDrugLabCommand).toHaveBeenNthCalledWith(1, expect.objectContaining({
      payload: expect.objectContaining({ recipeId: "pulse-shot", quantity: 2 })
    }));
    expect(submitServerDrugLabCommand).toHaveBeenNthCalledWith(2, expect.objectContaining({
      payload: expect.objectContaining({ recipeId: "velvet-smoke", quantity: 1 })
    }));
  });

  it("does not restore legacy Drug Lab jobs when a server model is unavailable", () => {
    const persistProductionJob = vi.fn();
    const renderRecipeCard = vi.fn();
    const syncCompletedProductionJobs = vi.fn();
    const runtime = createProductionBuildingPopupRuntime({
      allowLegacyLocalProduction: false,
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
      syncCompletedProductionJobs
    });

    const root = createRoot({
      '[data-production-panel="druglab"]': {}
    });
    runtime.renderProductionPanel(root, "druglab", {
      "pulse-shot": {
        durationMs: 1000,
        inputs: { chemicals: 2, biomass: 1 },
        output: { inventory: "drugs", itemId: "pulse-shot", amount: 1 }
      }
    });

    expect(renderRecipeCard).not.toHaveBeenCalled();
    expect(persistProductionJob).not.toHaveBeenCalled();
    expect(syncCompletedProductionJobs).not.toHaveBeenCalled();
  });

  it("uses the canonical Armory queue cap and rejects an oversized start atomically", () => {
    const recipeCallbacks = {};
    const consumeMaterials = vi.fn();
    const persistProductionJob = vi.fn();
    const setBuildingActionFeedback = vi.fn();
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      Object.assign(recipeCallbacks, callbacks);
      return { viewModel };
    });
    const runtime = createProductionBuildingPopupRuntime({
      consumeMaterials,
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
      setBuildingActionFeedback,
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({
      '[data-production-panel="armory"]': {}
    });
    runtime.renderProductionPanel(root, "armory", {
      bat: {
        durationMs: 1000,
        inputs: { "metal-parts": 2 },
        output: { inventory: "weapons", itemId: "baseball-bat", amount: 1 },
        localOutputCap: 8,
        queueCap: 6
      }
    });

    recipeCallbacks.onStart({ batchCount: 1 });

    expect(persistProductionJob).toHaveBeenCalledWith("armory:bat", expect.objectContaining({
      status: "running",
      quantity: 1,
      queuedAmount: 1,
      producedAmount: 0,
      inputs: { "metal-parts": 2 },
      output: expect.objectContaining({ amount: 0 }),
      durationMs: 1000
    }));

    persistProductionJob.mockClear();
    consumeMaterials.mockClear();
    recipeCallbacks.onStart({ batchCount: 20 });

    expect(persistProductionJob).not.toHaveBeenCalled();
    expect(consumeMaterials).not.toHaveBeenCalled();
    expect(setBuildingActionFeedback).toHaveBeenCalledWith(
      root,
      "warning",
      "Budova",
      expect.stringContaining("celé zvolené množství")
    );
  });

  it("passes recruitment strength preview into armory recipe cards", () => {
    const renderRecipeCard = vi.fn((viewModel) => ({ viewModel }));
    const getArmoryRecipeStrengthPreview = vi.fn(() => ({ label: "Síla útoku", basePower: 10, bonusPower: 0.8, bonusLabel: "+0.8" }));
    const runtime = createProductionBuildingPopupRuntime({
      getArmoryRecipeStrengthPreview,
      getInventoryAmount: () => 10,
      getProductionBuildingMultiplier: () => 1,
      getProductionJob: () => null,
      getResolvedEconomyState: () => ({ cleanMoney: 100 }),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      hasEnoughMaterials: () => true,
      renderProductionPanelUi: vi.fn(() => true),
      renderRecipeCard,
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({
      '[data-production-panel="armory"]': {}
    });
    expect(runtime.renderProductionPanel(root, "armory", {
      pistol: {
        durationMs: 1000,
        inputs: { "metal-parts": 2 },
        output: { inventory: "weapons", itemId: "pistol", amount: 1 }
      }
    })).toBe(true);

    expect(getArmoryRecipeStrengthPreview).toHaveBeenCalledWith("pistol", expect.objectContaining({
      output: expect.objectContaining({ itemId: "pistol" })
    }));
    expect(renderRecipeCard).toHaveBeenCalledWith(
      expect.objectContaining({
        armoryStrengthPreview: { label: "Síla útoku", basePower: 10, bonusPower: 0.8, bonusLabel: "+0.8" }
      }),
      expect.any(Object),
      expect.any(Object)
    );
  });

  it("does not scale Armory queue or output caps with Armory or Warehouse count", () => {
    const recipeCallbacks = {};
    const persistProductionJob = vi.fn();
    const renderedCards = [];
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      Object.assign(recipeCallbacks, callbacks);
      renderedCards.push(viewModel);
      return { viewModel };
    });
    const runtime = createProductionBuildingPopupRuntime({
      consumeMaterials: vi.fn(),
      getInventoryAmount: () => 100,
      getOwnedArmoryCount: () => 3,
      getOwnedWarehouseCount: () => 2,
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
      setBuildingActionFeedback: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({
      '[data-production-panel="armory"]': {}
    });
    runtime.renderProductionPanel(root, "armory", {
      bat: {
        durationMs: 1000,
        inputs: { "metal-parts": 2 },
        output: { inventory: "weapons", itemId: "baseball-bat", amount: 1 },
        localOutputCap: 8,
        queueCap: 6
      }
    });

    expect(renderedCards[0]).toMatchObject({
      outputCap: 8,
      queueCap: 6,
      maxBatches: 6,
      maxSelectableBatches: 6
    });

    recipeCallbacks.onStart({ batchCount: 99 });

    expect(persistProductionJob).not.toHaveBeenCalled();
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

  it("resolves a server production shortcut before opening its modal", async () => {
    const openButton = createElement();
    const popup = createElement();
    const closeButton = createElement();
    popup.hidden = true;
    popup.querySelectorAll = vi.fn(() => []);
    const prepareServerProductionBuilding = vi.fn().mockResolvedValue({
      accepted: false,
      errors: [{ message: "Na vlastněných districtech Lékárna není." }]
    });
    const setBuildingActionFeedback = vi.fn();
    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { pharmacy: { label: "Lékárna" } },
      isServerAuthoritativeGameplayRuntimeReady: () => true,
      prepareServerProductionBuilding,
      setBuildingActionFeedback
    });
    const root = createRoot({
      ".open": openButton,
      ".popup": popup,
      ".close": [closeButton]
    });

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName: "pharmacy",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    await openButton.dispatch("click");

    expect(prepareServerProductionBuilding).toHaveBeenCalledWith("pharmacy");
    expect(setBuildingActionFeedback).toHaveBeenCalledWith(
      root,
      "warning",
      "Lékárna",
      "Na vlastněných districtech Lékárna není."
    );
    expect(popup.hidden).toBe(true);
    expect(openButton.disabled).toBe(false);
  });

  it("does not upgrade production building when confirmation is cancelled", async () => {
    const openButton = createElement();
    const popup = createElement();
    const closeButton = createElement();
    const collectButton = createElement();
    const upgradeButton = createElement();
    const panelMount = {};
    const setStoredEconomyState = vi.fn();
    const setStoredProductionBuildingState = vi.fn();
    const createUpgradeConfirmationController = vi.fn(() => ({
      close: vi.fn(),
      isOpen: vi.fn(() => false),
      open: vi.fn(() => Promise.resolve(false))
    }));
    popup.querySelector = vi.fn((selector) => ({
      ".modal__body": createElement(),
      "[data-production-building-level]": createElement(),
      "[data-production-building-header-level]": createElement(),
      "[data-production-building-multiplier]": createElement(),
      "[data-production-building-ready]": createElement(),
      "[data-production-building-upgrade-cost]": createElement(),
      "[data-production-building-effects]": createElement(),
      "[data-production-building-collect]": collectButton,
      "[data-production-building-upgrade]": upgradeButton,
      "[data-production-building-info-text]": createElement(),
      "[data-production-building-info-effects]": createElement(),
      "[data-production-building-info-actions]": createElement(),
      "[data-production-building-info-upgrade-cost]": createElement(),
      "[data-production-building-info-upgrade-benefit]": createElement()
    }[selector] || null));
    popup.querySelectorAll = vi.fn(() => []);

    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { pharmacy: { label: "Lékárna" } },
      createUpgradeConfirmationController,
      formatCurrency: (value) => `$${value}`,
      getProductionBuildingEffectsLabel: () => "x1.00",
      getProductionBuildingMultiplier: (_name, level = 1) => 1 + ((level - 1) * 0.1),
      getProductionBuildingReadyCount: () => 0,
      getProductionBuildingUpgradeCost: () => 100,
      getResolvedEconomyState: () => ({ cleanMoney: 150 }),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      renderProductionBuildingInfoPanel: vi.fn(),
      renderProductionPanelUi: vi.fn(() => true),
      selectors: {
        collect: "[data-production-building-collect]",
        effects: "[data-production-building-effects]",
        headerLevel: "[data-production-building-header-level]",
        infoActions: "[data-production-building-info-actions]",
        infoEffects: "[data-production-building-info-effects]",
        infoText: "[data-production-building-info-text]",
        level: "[data-production-building-level]",
        multiplier: "[data-production-building-multiplier]",
        panel: "[data-production-building-panel]",
        ready: "[data-production-building-ready]",
        tab: "[data-production-building-tab]",
        upgrade: "[data-production-building-upgrade]",
        upgradeCost: "[data-production-building-upgrade-cost]"
      },
      setStoredEconomyState,
      setStoredProductionBuildingState,
      syncBuildingDetailTopbarVisibility: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({
      ".open": openButton,
      ".popup": popup,
      ".close": [closeButton],
      '[data-production-panel="pharmacy"]': panelMount
    });

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName: "pharmacy",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    await upgradeButton.dispatch("click");

    expect(createUpgradeConfirmationController).toHaveBeenCalled();
    expect(setStoredEconomyState).not.toHaveBeenCalled();
    expect(setStoredProductionBuildingState).not.toHaveBeenCalled();
  });

  it("upgrades production building after confirmation", async () => {
    const openButton = createElement();
    const popup = createElement();
    const closeButton = createElement();
    const collectButton = createElement();
    const upgradeButton = createElement();
    const panelMount = {};
    const setStoredEconomyState = vi.fn();
    const setStoredProductionBuildingState = vi.fn();
    const createUpgradeConfirmationController = vi.fn(() => ({
      close: vi.fn(),
      isOpen: vi.fn(() => false),
      open: vi.fn(() => Promise.resolve(true))
    }));
    popup.querySelector = vi.fn((selector) => ({
      ".modal__body": createElement(),
      "[data-production-building-level]": createElement(),
      "[data-production-building-header-level]": createElement(),
      "[data-production-building-multiplier]": createElement(),
      "[data-production-building-ready]": createElement(),
      "[data-production-building-upgrade-cost]": createElement(),
      "[data-production-building-effects]": createElement(),
      "[data-production-building-collect]": collectButton,
      "[data-production-building-upgrade]": upgradeButton,
      "[data-production-building-info-text]": createElement(),
      "[data-production-building-info-effects]": createElement(),
      "[data-production-building-info-actions]": createElement(),
      "[data-production-building-info-upgrade-cost]": createElement(),
      "[data-production-building-info-upgrade-benefit]": createElement()
    }[selector] || null));
    popup.querySelectorAll = vi.fn(() => []);

    const runtime = createProductionBuildingPopupRuntime({
      PRODUCTION_BUILDING_CONFIG: { pharmacy: { label: "Lékárna" } },
      applyTopbarEconomy: vi.fn(),
      createUpgradeConfirmationController,
      formatCurrency: (value) => `$${value}`,
      getProductionBuildingEffectsLabel: () => "x1.10",
      getProductionBuildingMultiplier: (_name, level = 1) => 1 + ((level - 1) * 0.1),
      getProductionBuildingReadyCount: () => 0,
      getProductionBuildingUpgradeCost: () => 100,
      getResolvedEconomyState: () => ({ cleanMoney: 150 }),
      getStoredProductionBuildingState: () => ({ level: 1 }),
      renderProductionBuildingInfoPanel: vi.fn(),
      renderProductionPanelUi: vi.fn(() => true),
      selectors: {
        collect: "[data-production-building-collect]",
        effects: "[data-production-building-effects]",
        headerLevel: "[data-production-building-header-level]",
        infoActions: "[data-production-building-info-actions]",
        infoEffects: "[data-production-building-info-effects]",
        infoText: "[data-production-building-info-text]",
        level: "[data-production-building-level]",
        multiplier: "[data-production-building-multiplier]",
        panel: "[data-production-building-panel]",
        ready: "[data-production-building-ready]",
        tab: "[data-production-building-tab]",
        upgrade: "[data-production-building-upgrade]",
        upgradeCost: "[data-production-building-upgrade-cost]"
      },
      setBuildingActionFeedback: vi.fn(),
      setStoredEconomyState,
      setStoredProductionBuildingState,
      syncBuildingDetailTopbarVisibility: vi.fn(),
      syncCompletedProductionJobs: vi.fn()
    });

    const root = createRoot({
      ".open": openButton,
      ".popup": popup,
      ".close": [closeButton],
      '[data-production-panel="pharmacy"]': panelMount
    });
    root.querySelectorAll = vi.fn((selector) => selector === ".close" ? [closeButton] : []);

    expect(runtime.bindProductionBuildingPopup(root, {
      buildingName: "pharmacy",
      closeSelector: ".close",
      openSelector: ".open",
      popupSelector: ".popup",
      recipes: {}
    })).toBe(true);

    await upgradeButton.dispatch("click");

    expect(setStoredEconomyState).toHaveBeenCalledWith({ cleanMoney: 50 });
    expect(setStoredProductionBuildingState).toHaveBeenCalledWith("pharmacy", { level: 2 });
  });
});
