// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveClientSurfaceAction } from "../../apps/client/src/app/client-surface-action-resolver";
import { createFactoryPopupRuntime } from "../../page-assets/js/app/runtime/factoryPopupRuntime.js";
import {
  createProductionBuildingPopupRuntime
} from "../../page-assets/js/app/runtime/productionBuildingPopupRuntime.js";
import { createServerGameplayBuildingShortcutController } from "../../page-assets/js/app/ui/serverGameplayBuildingShortcutController.js";
import {
  createServerGameplayProductionBuildingController
} from "../../page-assets/js/app/ui/serverGameplayProductionBuildingController.js";

describe("server gameplay production building controller", () => {
  beforeEach(() => {
    resetOverlayCoordinator();
    document.body.innerHTML = `<main id="game-root" data-gameplay-slice-client>
      ${productionPopup("pharmacy", "pharmacy")}
      ${productionPopup("druglab", "druglab")}
      ${productionPopup("armory", "armory")}
      <button data-factory-popup-open>Továrna</button>
      <div data-factory-popup hidden>
        <button data-factory-popup-close>×</button>
        <button data-factory-collect>+</button>
        <button data-factory-upgrade>⇪</button>
        <span data-factory-header-level></span>
        <span data-factory-owned-count></span>
        <span data-factory-multiplier></span>
        <span data-factory-upgrade-cost></span>
        <button data-factory-tab="stats">Výroba</button>
        <button data-factory-tab="info">Info</button>
        <section data-factory-panel="stats"><div data-factory-slot-list></div></section>
        <section data-factory-panel="info" hidden></section>
      </div>
    </main>`;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    resetOverlayCoordinator();
  });

  it("opens the original production cards and dispatches only server commands", async () => {
    const readModel = createReadModel();
    const dispatchSurfaceAction = vi.fn(async () => ({ readModel }));
    const controller = createServerGameplayProductionBuildingController({
      root: document.querySelector("#game-root"),
      documentRef: document,
      dispatchSurfaceAction,
      getCurrentReadModel: () => readModel
    });

    expect(controller.mount()).toBe(true);
    expect(controller.open("building:factory:1")).toBe(true);
    expect(document.querySelector("[data-factory-popup]").hidden).toBe(false);
    expect(document.querySelectorAll(".factory-slot")).toHaveLength(3);
    expect(document.querySelector("[data-factory-slot-list]").textContent).toContain("Metal Parts");

    document.querySelector(".factory-slot__quantity-btn[aria-label^='Přidat']").click();
    document.querySelector("[data-factory-slot-toggle-state='start']").click();
    await vi.waitFor(() => expect(dispatchSurfaceAction).toHaveBeenCalledWith({
      craftBuildingId: "building:factory:1",
      craftRecipeId: "metal-parts",
      craftQuantity: 2
    }));
    expect(dispatchSurfaceAction).toHaveBeenCalledTimes(1);

    document.querySelector("[data-factory-slot-toggle-state='stop']").click();
    await vi.waitFor(() => expect(dispatchSurfaceAction).toHaveBeenCalledWith({
      cancelProductionBuildingId: "building:factory:1",
      cancelProductionRecipeId: "metal-parts"
    }));
    expect(dispatchSurfaceAction).toHaveBeenCalledTimes(2);

    document.querySelector("[data-factory-collect]").click();
    await vi.waitFor(() => expect(dispatchSurfaceAction).toHaveBeenCalledWith({
      collectBuildingId: "building:factory:1",
      collectResourceKey: "metal-parts"
    }));
    expect(dispatchSurfaceAction).toHaveBeenCalledTimes(3);

    controller.close();
    expect(controller.open("building:pharmacy:1")).toBe(true);
    expect(document.querySelectorAll("[data-pharmacy-popup] .pharmacy-slot")).toHaveLength(1);
    controller.close();
    expect(controller.open("building:drug_lab:1")).toBe(true);
    expect(document.querySelectorAll("[data-druglab-popup] .drug-production-slot")).toHaveLength(1);
    controller.close();
    expect(controller.open("building:armory:1")).toBe(true);
    expect(document.querySelectorAll("[data-armory-popup] .armory-slot")).toHaveLength(1);

    expect(controller.destroy()).toBe(true);
    expect(controller.destroy()).toBe(false);
  });

  it("maps each hosted visible production click to exactly one typed command", async () => {
    const readModel = createReadModel();
    const typedCommands = [];
    const dispatchSurfaceAction = vi.fn(async (surfaceDataset) => {
      const proxy = document.createElement("button");
      for (const [key, value] of Object.entries(surfaceDataset || {})) {
        proxy.dataset[key] = String(value);
      }
      const command = resolveClientSurfaceAction(proxy);
      typedCommands.push(command);
      return command;
    });
    const legacyProductionSubmit = vi.fn(async () => ({ accepted: true, errors: [] }));
    const legacyFactorySubmit = vi.fn(async () => ({ accepted: true, errors: [] }));
    const legacyRuntimes = bindLegacyHostedPopupRuntimes({
      readModel,
      legacyProductionSubmit,
      legacyFactorySubmit
    });
    const controller = createServerGameplayProductionBuildingController({
      root: document.querySelector("#game-root"),
      documentRef: document,
      dispatchSurfaceAction,
      getCurrentReadModel: () => readModel
    });
    expect(controller.mount()).toBe(true);
    const handleDistrictSelected = vi.fn(() => true);
    const shortcutController = createServerGameplayBuildingShortcutController({
      root: document.querySelector("#game-root"),
      source: {
        getCurrentReadModel: () => readModel,
        getCurrentRenderState: () => ({ districtPanel: { districtId: readModel.district.districtId } }),
        selectDistrict: vi.fn()
      },
      districtController: {
        handleDistrictSelected,
        openBuildingByType: (buildingTypeId) => {
          const normalizedTypeId = buildingTypeId === "druglab" ? "drug_lab" : buildingTypeId;
          const building = readModel.district.buildings.find(
            (candidate) => candidate.buildingTypeId === normalizedTypeId
          );
          return controller.open(building?.buildingId);
        }
      }
    });
    expect(shortcutController.mount()).toBe(true);
    shortcutController.update(readModel);

    for (const scenario of [
      {
        buildingName: "pharmacy",
        buildingId: "building:pharmacy:1",
        openSelector: "[data-pharmacy-popup-open]",
        popupSelector: "[data-pharmacy-popup]",
        recipeId: "chemicals",
        resourceKey: "chemicals"
      },
      {
        buildingName: "druglab",
        buildingId: "building:drug_lab:1",
        openSelector: "[data-druglab-popup-open]",
        popupSelector: "[data-druglab-popup]",
        recipeId: "neon-dust",
        resourceKey: "neon-dust"
      },
      {
        buildingName: "armory",
        buildingId: "building:armory:1",
        openSelector: "[data-armory-popup-open]",
        popupSelector: "[data-armory-popup]",
        recipeId: "pistol",
        resourceKey: "pistol"
      },
      {
        buildingName: "factory",
        buildingId: "building:factory:1",
        openSelector: "[data-factory-popup-open]",
        popupSelector: "[data-factory-popup]",
        recipeId: "metal-parts",
        resourceKey: "metal-parts"
      }
    ]) {
      document.querySelector(scenario.openSelector).click();
      const popup = document.querySelector(scenario.popupSelector);
      await vi.waitFor(() => expect(popup.hidden, scenario.buildingName).toBe(false));
      expect(popup.dataset.productionCommandOwner).toBe("server-gameplay-production-controller");

      findEnabledButton(popup, "Spustit").click();
      await vi.waitFor(() => expect(typedCommands.at(-1)).toEqual({
        kind: "craft",
        buildingId: scenario.buildingId,
        recipeId: scenario.recipeId,
        quantity: 1
      }));
      const countAfterStart = typedCommands.length;

      findEnabledButton(popup, "Zrušit").click();
      await vi.waitFor(() => expect(typedCommands).toHaveLength(countAfterStart + 1));
      expect(typedCommands.at(-1)).toEqual({
        kind: "cancel-production",
        buildingId: scenario.buildingId,
        recipeId: scenario.recipeId
      });
      const countAfterCancel = typedCommands.length;

      const collect = scenario.buildingName === "factory"
        ? popup.querySelector("[data-factory-collect]")
        : popup.querySelector("[data-production-building-collect]");
      collect.click();
      await vi.waitFor(() => expect(typedCommands).toHaveLength(countAfterCancel + 1));
      expect(typedCommands.at(-1)).toEqual({
        kind: "collect",
        buildingId: scenario.buildingId,
        resourceKey: scenario.resourceKey
      });

      expect(controller.close()).toBe(true);
      resetOverlayCoordinator();
    }

    expect(shortcutController.getDiagnostics().opens).toBe(4);
    expect(handleDistrictSelected).toHaveBeenCalledTimes(4);
    expect(controller.getDiagnostics().opens).toBe(4);
    expect(legacyRuntimes.prepareServerProductionBuilding).not.toHaveBeenCalled();
    expect(dispatchSurfaceAction).toHaveBeenCalledTimes(12);
    expect(legacyProductionSubmit).not.toHaveBeenCalled();
    expect(legacyFactorySubmit).not.toHaveBeenCalled();
    expect(shortcutController.destroy()).toBe(true);
    expect(controller.destroy()).toBe(true);
  });

  it("opens all production shells before the detailed server projection arrives", () => {
    const readModel = createReadModel();
    for (const building of readModel.district.buildings) {
      delete building.factory;
      delete building.pharmacy;
      delete building.drugLab;
      delete building.armory;
    }
    const controller = createServerGameplayProductionBuildingController({
      root: document.querySelector("#game-root"),
      documentRef: document,
      dispatchSurfaceAction: vi.fn(),
      getCurrentReadModel: () => readModel
    });
    controller.mount();

    for (const [buildingId, popupSelector, typeId] of [
      ["building:pharmacy:1", "[data-pharmacy-popup]", "pharmacy"],
      ["building:drug_lab:1", "[data-druglab-popup]", "drug_lab"],
      ["building:factory:1", "[data-factory-popup]", "factory"],
      ["building:armory:1", "[data-armory-popup]", "armory"]
    ]) {
      expect(controller.open(buildingId)).toBe(true);
      const popup = document.querySelector(popupSelector);
      expect(popup.hidden).toBe(false);
      expect(popup.textContent).toContain("Načítám serverový detail");
      expect(popup.dataset).toMatchObject({
        executionMode: "server-authoritative",
        serverBuildingId: buildingId,
        serverBuildingTypeId: typeId,
        serverDistrictId: "district:1",
        uiOwner: "legacy-shared"
      });
      expect(controller.close()).toBe(true);
    }

    controller.destroy();
  });
});

function productionPopup(shellName, panelName) {
  return `<button data-${shellName}-popup-open>${shellName}</button>
  <div data-${shellName}-popup hidden>
    <button data-${shellName}-popup-close>×</button>
    <button data-production-building-collect>+</button>
    <button data-production-building-upgrade>⇪</button>
    <span data-production-building-header-level></span>
    <span data-production-building-level></span>
    <span data-production-building-multiplier></span>
    <span data-production-building-upgrade-cost></span>
    <p data-production-building-info-text></p>
    <p data-production-building-info-effects></p>
    <div class="building-info-upgrade-mini">
      <span data-production-building-info-upgrade-cost></span>
      <span data-production-building-info-upgrade-benefit></span>
    </div>
    <button data-production-building-tab="${panelName}:stats">Výroba</button>
    <button data-production-building-tab="${panelName}:info">Info</button>
    <section data-production-building-panel="${panelName}:stats">
      <div data-production-panel="${panelName}"></div>
    </section>
    <section data-production-building-panel="${panelName}:info" hidden></section>
  </div>`;
}

function bindLegacyHostedPopupRuntimes({
  readModel,
  legacyProductionSubmit,
  legacyFactorySubmit
}) {
  const getBuilding = (buildingTypeId) => readModel.district.buildings.find(
    (building) => building.buildingTypeId === buildingTypeId
  );
  const prepareServerProductionBuilding = vi.fn(async (buildingName) => {
    const buildingTypeId = buildingName === "druglab" ? "drug_lab" : buildingName;
    return {
      accepted: true,
      building: getBuilding(buildingTypeId),
      districtId: readModel.district.districtId,
      readModel,
      errors: []
    };
  });
  const productionRuntime = createProductionBuildingPopupRuntime({
    allowLegacyLocalProduction: false,
    allowLegacyProductionUpgrade: false,
    isServerAuthoritativeGameplayRuntimeReady: () => true,
    documentRef: document,
    HTMLButtonElement,
    ARMORY_POPUP_CLOSE_SELECTOR: "[data-armory-popup-close]",
    ARMORY_POPUP_OPEN_SELECTOR: "[data-armory-popup-open]",
    ARMORY_POPUP_SELECTOR: "[data-armory-popup]",
    ARMORY_RECIPES: {},
    DRUGLAB_POPUP_CLOSE_SELECTOR: "[data-druglab-popup-close]",
    DRUGLAB_POPUP_OPEN_SELECTOR: "[data-druglab-popup-open]",
    DRUGLAB_POPUP_SELECTOR: "[data-druglab-popup]",
    DRUGLAB_RECIPES: {},
    PHARMACY_POPUP_CLOSE_SELECTOR: "[data-pharmacy-popup-close]",
    PHARMACY_POPUP_OPEN_SELECTOR: "[data-pharmacy-popup-open]",
    PHARMACY_POPUP_SELECTOR: "[data-pharmacy-popup]",
    PHARMACY_RECIPES: {},
    PRODUCTION_BUILDING_CONFIG: {
      armory: { label: "Zbrojovka" },
      druglab: { label: "Lab" },
      pharmacy: { label: "Lékárna" }
    },
    getServerArmoryReadModel: () => getBuilding("armory").armory,
    getServerDrugLabReadModel: () => getBuilding("drug_lab").drugLab,
    getServerPharmacyReadModel: () => getBuilding("pharmacy").pharmacy,
    prepareServerProductionBuilding,
    selectors: {
      collect: "[data-production-building-collect]",
      headerLevel: "[data-production-building-header-level]",
      infoActions: "[data-production-building-info-actions]",
      infoEffects: "[data-production-building-info-effects]",
      infoText: "[data-production-building-info-text]",
      level: "[data-production-building-level]",
      multiplier: "[data-production-building-multiplier]",
      panel: "[data-production-building-panel]",
      tab: "[data-production-building-tab]",
      upgrade: "[data-production-building-upgrade]",
      upgradeCost: "[data-production-building-upgrade-cost]"
    },
    submitServerArmoryCommand: legacyProductionSubmit,
    submitServerDrugLabCommand: legacyProductionSubmit,
    submitServerPharmacyCommand: legacyProductionSubmit
  });
  expect(productionRuntime.bindPharmacyPopup(document)).toBe(true);
  expect(productionRuntime.bindDrugLabPopup(document)).toBe(true);
  expect(productionRuntime.bindArmoryPopup(document)).toBe(true);

  const factoryRuntime = createFactoryPopupRuntime({
    allowLegacyLocalProduction: false,
    allowLegacyProductionUpgrade: false,
    isServerAuthoritativeGameplayRuntimeReady: () => true,
    documentRef: document,
    FACTORY_CONFIG: { maxLevel: 14 },
    getServerFactoryReadModel: () => getBuilding("factory").factory,
    prepareServerProductionBuilding,
    selectors: {
      close: "[data-factory-popup-close]",
      collect: "[data-factory-collect]",
      headerLevel: "[data-factory-header-level]",
      multiplier: "[data-factory-multiplier]",
      open: "[data-factory-popup-open]",
      ownedCount: "[data-factory-owned-count]",
      panel: "[data-factory-panel]",
      popup: "[data-factory-popup]",
      slotList: "[data-factory-slot-list]",
      tab: "[data-factory-tab]",
      upgrade: "[data-factory-upgrade]",
      upgradeCost: "[data-factory-upgrade-cost]"
    },
    submitServerFactoryCommand: legacyFactorySubmit
  });
  expect(factoryRuntime.bindFactoryPopup(document)).toBe(true);
  return { prepareServerProductionBuilding };
}

function findEnabledButton(popup, label) {
  const button = Array.from(popup.querySelectorAll("button")).find(
    (candidate) => candidate.textContent.trim() === label && !candidate.disabled
  );
  expect(button).toBeTruthy();
  return button;
}

function createReadModel() {
  const baseLine = {
    producedAmount: 1,
    producedCapacity: 20,
    queuedAmount: 2,
    queueCapacity: 8,
    activeAmount: 1,
    waitingAmount: 1,
    baseUnitDurationTicks: 12,
    effectiveUnitDurationTicks: 10,
    remainingTicks: 3,
    remainingMs: 30_000,
    status: "processing",
    canStart: true,
    canCancelWaiting: true,
    canCollect: true,
    maxStartQuantity: 3,
    disabledReason: null
  };
  const factoryLines = ["metal-parts", "tech-core", "combat-module"].map((resourceKey) => ({
    ...baseLine,
    recipeId: resourceKey,
    resourceKey,
    label: resourceKey === "metal-parts" ? "Metal Parts" : resourceKey,
    unitCleanCashCost: 100,
    materialInputCosts: {},
    costDisplayRows: [{ resourceKey: "cash", label: "Clean Cash", amount: 100 }],
    canCollect: resourceKey === "metal-parts"
  }));
  return {
    mode: { tickRateMs: 10_000 },
    player: { resourceBalances: { cash: 5_000 } },
    district: {
      districtId: "district:1",
      buildings: [{
        buildingId: "building:factory:1",
        buildingTypeId: "factory",
        level: 2,
        info: "Továrna",
        factory: {
          buildingId: "building:factory:1",
          districtId: "district:1",
          level: 2,
          network: { activeFactoryCount: 2, effectiveSpeedMultiplier: 1.2 },
          producedSummary: factoryLines.map((line) => ({
            resourceKey: line.resourceKey,
            currentAmount: 1,
            capacity: 20
          })),
          productionLines: factoryLines
        }
      }, {
        buildingId: "building:pharmacy:1",
        buildingTypeId: "pharmacy",
        level: 1,
        info: "Lékárna",
        pharmacy: {
          buildingId: "building:pharmacy:1",
          lines: [{ ...baseLine, recipeId: "chemicals", resourceKey: "chemicals", label: "Chemicals", unitCleanCashCost: 100 }]
        }
      }, {
        buildingId: "building:drug_lab:1",
        buildingTypeId: "drug_lab",
        level: 1,
        info: "Lab",
        drugLab: {
          buildingId: "building:drug_lab:1",
          lines: [{ ...baseLine, recipeId: "neon-dust", resourceKey: "neon-dust", label: "Neon Dust", inputAvailability: [] }]
        }
      }, {
        buildingId: "building:armory:1",
        buildingTypeId: "armory",
        level: 1,
        info: "Zbrojovka",
        armory: {
          buildingId: "building:armory:1",
          network: { activeArmoryCount: 1, effectiveSpeedMultiplier: 1 },
          productionLines: [{
            ...baseLine,
            recipeId: "pistol",
            resourceKey: "pistol",
            label: "Pistole",
            category: "attack",
            inputAvailability: []
          }]
        }
      }]
    }
  };
}

function resetOverlayCoordinator() {
  const state = globalThis[Symbol.for("empire.legacyOverlayCoordinator.state")];
  if (!state) return;
  state.overlayStack.splice(0);
  state.suppressionStartedAt = 0;
  state.suppressMapInputUntil = 0;
}
