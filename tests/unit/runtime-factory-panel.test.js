import { describe, expect, it, vi } from "vitest";
import { buildFactoryDashboardViewModel } from "../../page-assets/js/app/runtime/factoryViewModel.js";
import { renderFactoryDashboardPanel } from "../../page-assets/js/app/ui/factoryPanel.js";

class FakeElement {
  constructor() {
    this.textContent = "";
    this.disabled = false;
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
        slots: [{ id: "a", resourceKey: "metalParts" }, { id: "b", resourceKey: "combatModule" }]
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
    expect(viewModel.multiplierLabel).toBe("1.25x");
    expect(viewModel.upgradeCostLabel).toBe("100$");
    expect(viewModel.collectButton.disabled).toBe(false);
    expect(viewModel.slots[0]).toMatchObject({ title: "Metal line", perHour: 1, resourceColor: "color:metalParts" });
    expect(viewModel.slots[1].primaryLine).toBe("2 MP + 1 TC");
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
      effectsLabel: new FakeElement(),
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
      effectsLabel: "Síť Továren: 1 budova (+0% rychlost výroby)",
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
});
