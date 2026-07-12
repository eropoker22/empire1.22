import { describe, expect, it, vi } from "vitest";
import { buildFactoryDashboardViewModel } from "../../page-assets/js/app/runtime/factoryViewModel.js";
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
          { id: "b", resourceKey: "combatModule", producedAmount: 5 }
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
      config: { maxLevel: 3, combatModule: { metalPartsCost: 2, techCoreCost: 1, durationMs: 5000 } },
      slotConfig: [{ id: "a", label: "Metal line" }],
      slotStorageCap: 20,
      formatCurrency: (value) => `${value}$`,
      formatDurationLabel: () => "5s",
      getFactoryUpgradeCost: () => 100,
      normalizeResourceColorKey: (key) => `color:${key}`
    });

    expect(viewModel.levelLabel).toBe("2");
    expect(viewModel.headerLevelLabel).toBe("Lv 2");
    expect(viewModel.multiplierLabel).toBe("+25%");
    expect(viewModel.upgradeCostLabel).toBe("100$");
    expect(viewModel.resources).toEqual({ metalParts: "2/20", techCore: "0/10", combatModule: "5/5" });
    expect(viewModel.collectButton.disabled).toBe(false);
    expect(viewModel.slots[0]).toMatchObject({
      title: "Metal line",
      perHour: 1,
      resourceColor: "color:metalParts",
      priceLabel: "120",
      secondaryLine: "4 min",
      displayCost: { cleanCash: 120, techCore: 0 }
    });
    expect(viewModel.slots[0].typeLabel).toBe("");
    expect(viewModel.slots[1].primaryLine).toBe("650 + 1 Tech Core");
    expect(viewModel.slots[1].priceLabel).toBe("650 + 1 Tech Core");
    expect(viewModel.slots[1].secondaryLine).toBe("15 min");
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
      config: { maxLevel: 3, combatModule: { metalPartsCost: 2, techCoreCost: 1, durationMs: 5000 } },
      slotConfig: [{ id: "metal", label: "Metal line" }],
      slotStorageCap: 20,
      formatCurrency: (value) => `${value}$`,
      getFactoryUpgradeCost: () => 100
    });

    expect(viewModel.resources.metalParts).toBe("12/30");
    expect(viewModel.ownedCountLabel).toBe("3");
    expect(viewModel.slots[0]).toMatchObject({
      slotStorageCap: 28,
      slotOutputCap: 30,
      queueCap: 28,
      queuedAmount: 5
    });
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
