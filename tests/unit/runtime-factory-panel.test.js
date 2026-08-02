import { describe, expect, it, vi } from "vitest";
import {
  FACTORY_CONFIG,
  FACTORY_SLOT_CONFIG,
  FACTORY_SLOT_STORAGE_CAP
} from "../../packages/game-config/src/legacy-page/economy-config.js";
import {
  buildFactoryDashboardViewModel,
  buildServerFactoryDashboardViewModel
} from "../../page-assets/js/app/runtime/factoryViewModel.js";
import { renderFactoryDashboardPanel } from "../../page-assets/js/app/ui/factoryPanel.js";

class FakeElement {
  constructor() {
    this.textContent = "";
    this.disabled = false;
    this.hidden = false;
    this.style = {};
    this.title = "";
    this.attributes = new Map();
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

describe("factory dashboard view model and panel", () => {
  it("builds dashboard labels and slot payloads", () => {
    const viewModel = buildFactoryDashboardViewModel({
      factoryState: {
        level: 2,
        resources: { metalParts: 3, techCore: 4, combatModule: 5 },
        slots: [
          { id: "a", resourceKey: "metalParts", producedAmount: 2 },
          { id: "b", resourceKey: "combatModule", producedAmount: 5 },
          { id: "tech", resourceKey: "techCore", producedAmount: 0 }
        ]
      },
      syncResult: {
        productionMultiplier: 1.25,
        ownedFactoryCount: 2,
        networkProductionBonusPct: 10,
        rates: { metalPartsPerHour: 1, techCorePerHour: 2, combatModulePerHour: 3 }
      },
      supplyState: { metalParts: 6, techCore: 7, combatModule: 8 },
      collectableAmount: 9,
      config: { ...FACTORY_CONFIG, maxLevel: 3 },
      slotConfig: [{ id: "a", label: "Metal line" }],
      slotStorageCap: 20,
      formatCurrency: (value) => `${value}$`,
      formatDurationLabel: (value) => `${value / 60_000} min`,
      getFactoryUpgradeCost: () => 100,
      normalizeResourceColorKey: (key) => `color:${key}`
    });

    expect(viewModel.levelLabel).toBe("2");
    expect(viewModel.headerLevelLabel).toBe("Lv 2");
    expect(viewModel.multiplierLabel).toBe("+25%");
    expect(viewModel.upgradeCostLabel).toBe("100$");
    expect(viewModel.resources).toEqual({ metalParts: "2/10", techCore: "0/5", combatModule: "5/2" });
    expect(viewModel.collectButton.disabled).toBe(false);
    expect(viewModel.slots[0]).toMatchObject({
      title: "Metal line",
      perHour: 1,
      resourceColor: "color:metalParts",
      priceLabel: "$300 clean",
      secondaryLine: "",
      displayCost: { cleanCash: 300, metalParts: 0, techCore: 0 }
    });
    expect(viewModel.slots[0].typeLabel).toBe("");
    expect(viewModel.slots[1].primaryLine).toBe("$2500 clean · 4× Metal Parts · 2× Tech Core");
    expect(viewModel.slots[1].priceLabel).toBe("$2500 clean · 4× Metal Parts · 2× Tech Core");
    expect(viewModel.slots[1].secondaryLine).toBe("15 min / kus");
    expect(viewModel.slots[1].slotStorageCap).toBe(5);
  });

  it("keeps factory output caps separate from queue caps", () => {
    const viewModel = buildFactoryDashboardViewModel({
      factoryState: {
        level: 1,
        resources: { metalParts: 12, techCore: 0, combatModule: 0 },
        slots: [
          { id: "metal", resourceKey: "metalParts", producedAmount: 12, queuedAmount: 5, slotCap: 30, queueCap: 28 }
        ]
      },
      syncResult: {
        productionMultiplier: 1,
        ownedFactoryCount: 3,
        rates: { metalPartsPerHour: 2, techCorePerHour: 0, combatModulePerHour: 0 }
      },
      config: { ...FACTORY_CONFIG, maxLevel: 3 },
      slotConfig: [{ id: "metal", label: "Metal line" }],
      slotStorageCap: 20,
      formatCurrency: (value) => `${value}$`,
      getFactoryUpgradeCost: () => 100
    });

    expect(viewModel.resources.metalParts).toBe("12/10");
    expect(viewModel.ownedCountLabel).toBe("3");
    expect(viewModel.slots[0]).toMatchObject({
      slotStorageCap: 13,
      slotOutputCap: 10,
      queueCap: 13,
      queuedAmount: 5
    });
  });

  it("adapts authoritative Factory data into the same canonical presentation as the demo", () => {
    const lines = [
      {
        recipeId: "metal-parts",
        resourceKey: "metal-parts",
        label: "Metal Parts",
        producedAmount: 0,
        producedCapacity: 12,
        queuedAmount: 0,
        queueCapacity: 17,
        baseUnitDurationTicks: 48,
        effectiveUnitDurationTicks: 32,
        effectiveSpeedMultiplier: 1.5,
        unitsPerHour: 22.5,
        status: "ready",
        canStart: true,
        maxStartQuantity: 4,
        costDisplayRows: [{ resourceKey: "cash", amount: 300, availableAmount: 100000 }]
      },
      {
        recipeId: "tech-core",
        resourceKey: "tech-core",
        label: "Tech Core",
        producedAmount: 0,
        producedCapacity: 5,
        queuedAmount: 0,
        queueCapacity: 8,
        baseUnitDurationTicks: 96,
        effectiveUnitDurationTicks: 64,
        effectiveSpeedMultiplier: 1.5,
        unitsPerHour: 11.25,
        status: "ready",
        canStart: true,
        maxStartQuantity: 4,
        costDisplayRows: [
          { resourceKey: "cash", amount: 900, availableAmount: 100000 },
          { resourceKey: "metal-parts", amount: 4, availableAmount: 200 }
        ]
      },
      {
        recipeId: "combat-module",
        resourceKey: "combat-module",
        label: "Bojový modul",
        producedAmount: 0,
        producedCapacity: 2,
        queuedAmount: 0,
        queueCapacity: 5,
        baseUnitDurationTicks: 180,
        effectiveUnitDurationTicks: 120,
        effectiveSpeedMultiplier: 1.5,
        unitsPerHour: 6,
        status: "ready",
        canStart: true,
        maxStartQuantity: 2,
        costDisplayRows: [
          { resourceKey: "cash", amount: 2500, availableAmount: 100000 },
          { resourceKey: "metal-parts", amount: 4, availableAmount: 200 },
          { resourceKey: "tech-core", amount: 2, availableAmount: 200 }
        ]
      }
    ];
    const viewModel = buildServerFactoryDashboardViewModel({
      serverFactory: {
        buildingId: "building:factory:1",
        level: 1,
        effectiveProductionSpeedMultiplier: 1.5,
        collectableAmount: 0,
        canCollect: false,
        collectDisabledReason: "Zatím není nic hotového k vyzvednutí.",
        network: {
          activeFactoryCount: 1,
          networkSpeedMultiplier: 1,
          levelSpeedMultiplier: 1,
          effectiveSpeedMultiplier: 1
        },
        productionLines: lines
      },
      tickRateMs: 5000,
      config: FACTORY_CONFIG,
      slotConfig: FACTORY_SLOT_CONFIG,
      slotStorageCap: FACTORY_SLOT_STORAGE_CAP,
      formatCurrency: (value) => `$${value}`,
      formatDurationLabel: (value) => `${value / 60_000} min`,
      getFactoryUpgradeCost: () => 5000
    });

    expect(viewModel.multiplierLabel).toBe("+50%");
    expect(viewModel.resources).toEqual({ metalParts: "0/12", techCore: "0/5", combatModule: "0/2" });
    expect(viewModel.slots.map((slot) => slot.durationMs)).toEqual([160000, 320000, 600000]);
    expect(viewModel.slots.map((slot) => slot.durationBonusLabel)).toEqual(["−33 %", "−33 %", "−33 %"]);
    expect(viewModel.slots.map((slot) => slot.secondaryLine)).toEqual(["", "", "10 min / kus"]);
    expect(viewModel.slots.map((slot) => slot.perHour)).toEqual([22.5, 11.25, 6]);
    expect(viewModel.slots[0]).toMatchObject({ slotOutputCap: 12, slotStorageCap: 17, queueCap: 17 });
    expect(viewModel.slots.map((slot) => slot.serverLine)).toEqual(lines);
    expect(viewModel.slots.map((slot) => slot.maxStartQuantity)).toEqual([4, 4, 2]);
  });

  it("keeps foreign Factory collection disabled with the authoritative ownership reason", () => {
    const ownershipReason = "Továrna patří jinému hráči.";
    const viewModel = buildServerFactoryDashboardViewModel({
      serverFactory: {
        buildingId: "building:factory:foreign",
        level: 1,
        effectiveProductionSpeedMultiplier: 1,
        collectableAmount: 0,
        canCollect: false,
        collectDisabledReason: ownershipReason,
        network: { activeFactoryCount: 0, effectiveSpeedMultiplier: 1 },
        productionLines: [{
          recipeId: "metal-parts",
          resourceKey: "metal-parts",
          label: "Metal Parts",
          producedAmount: 4,
          producedCapacity: 12,
          queuedAmount: 0,
          queueCapacity: 17,
          baseUnitDurationTicks: 48,
          effectiveUnitDurationTicks: 48,
          effectiveSpeedMultiplier: 1,
          unitsPerHour: 15,
          status: "completed",
          canStart: false,
          canCollect: false,
          maxStartQuantity: 0,
          collectDisabledReason: ownershipReason,
          disabledReason: ownershipReason,
          costDisplayRows: []
        }]
      },
      tickRateMs: 5000,
      config: FACTORY_CONFIG,
      slotConfig: FACTORY_SLOT_CONFIG,
      slotStorageCap: FACTORY_SLOT_STORAGE_CAP
    });
    const collectButton = new FakeElement();

    expect(viewModel.collectableAmount).toBe(0);
    expect(viewModel.collectButton).toEqual({ disabled: true, text: "+", title: ownershipReason });
    expect(renderFactoryDashboardPanel({ collectButton }, viewModel)).toBe(true);
    expect(collectButton.disabled).toBe(true);
    expect(collectButton.title).toBe(ownershipReason);
    expect(collectButton.attributes.get("aria-label")).toBe(ownershipReason);
  });

  it("renders dashboard elements and forwards callbacks", () => {
    const elements = {
      level: new FakeElement(),
      headerLevel: new FakeElement(),
      multiplier: new FakeElement(),
      ownedCount: new FakeElement(),
      upgradeCost: new FakeElement(),
      metal: new FakeElement(),
      tech: new FakeElement(),
      combat: new FakeElement(),
      supplyMetal: new FakeElement(),
      supplyTech: new FakeElement(),
      supplyCombat: new FakeElement(),
      upgradeButton: new FakeElement(),
      collectButton: new FakeElement(),
      infoPanel: new FakeElement(),
      slotList: new FakeElement()
    };
    const renderFactoryBuildingInfo = vi.fn();
    const renderFactorySlotList = vi.fn();

    expect(renderFactoryDashboardPanel(elements, {
      factoryState: { level: 1 },
      syncResult: {},
      collectableAmount: 0,
      levelLabel: "1",
      headerLevelLabel: "Lv 1",
      multiplierLabel: "1.00x",
      ownedCountLabel: "1",
      upgradeCostLabel: "50$",
      resources: { metalParts: "2", techCore: "3", combatModule: "4" },
      supplies: { metalParts: "5", techCore: "6", combatModule: "7" },
      upgradeButton: { disabled: false, text: "⇪", title: "Upgrade budovy (50$)" },
      collectButton: { disabled: true, text: "+", title: "Vybrat hotové do skladu" },
      slots: [{ slot: { id: "a" } }]
    }, {
      renderFactoryBuildingInfo,
      renderFactorySlotList
    })).toBe(true);

    expect(elements.level.textContent).toBe("1");
    expect(elements.upgradeButton.title).toBe("Upgrade budovy (50$)");
    expect(elements.collectButton.disabled).toBe(true);
    expect(renderFactoryBuildingInfo).toHaveBeenCalledTimes(1);
    expect(renderFactorySlotList).toHaveBeenCalledTimes(1);
  });

  it("hides the factory upgrade button when no next upgrade exists", () => {
    const elements = {
      upgradeButton: new FakeElement()
    };

    expect(renderFactoryDashboardPanel(elements, {
      upgradeButton: { visible: false, disabled: true, text: "⇪", title: "Max level" }
    })).toBe(true);

    expect(elements.upgradeButton.hidden).toBe(true);
    expect(elements.upgradeButton.style.display).toBe("none");
    expect(elements.upgradeButton.disabled).toBe(true);
    expect(elements.upgradeButton.title).toBe("Max level");
  });
});
