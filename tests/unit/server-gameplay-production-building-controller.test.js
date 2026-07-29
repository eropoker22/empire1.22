// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServerGameplayProductionBuildingController
} from "../../page-assets/js/app/ui/serverGameplayProductionBuildingController.js";

describe("server gameplay production building controller", () => {
  beforeEach(() => {
    resetOverlayCoordinator();
    document.body.innerHTML = `<main id="game-root">
      ${productionPopup("pharmacy", "pharmacy")}
      ${productionPopup("druglab", "druglab")}
      ${productionPopup("armory", "armory")}
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

    document.querySelector("[data-factory-slot-toggle-state='stop']").click();
    await vi.waitFor(() => expect(dispatchSurfaceAction).toHaveBeenCalledWith({
      cancelProductionBuildingId: "building:factory:1",
      cancelProductionRecipeId: "metal-parts"
    }));

    document.querySelector("[data-factory-collect]").click();
    await vi.waitFor(() => expect(dispatchSurfaceAction).toHaveBeenCalledWith({
      collectBuildingId: "building:factory:1",
      collectResourceKey: "metal-parts"
    }));

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
});

function productionPopup(shellName, panelName) {
  return `<div data-${shellName}-popup hidden>
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
