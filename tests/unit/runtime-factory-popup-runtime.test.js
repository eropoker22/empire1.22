import { describe, expect, it, vi } from "vitest";
import { createFactoryPopupRuntime } from "../../page-assets/js/app/runtime/factoryPopupRuntime.js";

function createElement(dataset = {}) {
  const listeners = new Map();

  return {
    dataset,
    disabled: false,
    hidden: false,
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
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    replaceChildren: vi.fn(),
    classList: {
      toggle: vi.fn()
    },
    setAttribute: vi.fn()
  };
}

function createRoot(elements = {}, all = {}) {
  return {
    querySelector: vi.fn((selector) => elements[selector] || null),
    querySelectorAll: vi.fn((selector) => all[selector] || [])
  };
}

function createRuntime(overrides = {}) {
  return createFactoryPopupRuntime({
    FACTORY_CONFIG: { maxLevel: 14 },
    FACTORY_SLOT_CONFIG: [],
    FACTORY_SLOT_STORAGE_CAP: 100,
    buildFactoryDashboardViewModel: vi.fn(() => ({ slots: [] })),
    createFactoryBuildingInfoViewModel: vi.fn(() => ({ rows: [], actions: [] })),
    formatCurrency: (value) => `$${value}`,
    formatDurationLabel: () => "1s",
    getFactoryLevelMultiplier: () => 1,
    getFactoryUpgradeCost: () => 100,
    getResolvedEconomyState: () => ({ cleanMoney: 1000 }),
    getStoredFactoryState: () => ({ level: 1, slots: [] }),
    getStoredFactorySupplies: () => ({}),
    renderFactoryBuildingInfoPanel: vi.fn(),
    renderFactoryDashboardPanel: vi.fn(),
    renderFactorySlotList: vi.fn(),
    selectors: {
      close: ".close",
      collect: ".collect",
      combat: ".combat",
      effectsLabel: ".effects",
      headerLevel: ".header",
      level: ".level",
      metal: ".metal",
      multiplier: ".multiplier",
      open: ".open",
      ownedCount: ".owned",
      panel: ".panel",
      popup: ".popup",
      slotList: ".slots",
      supplyCombat: ".supply-combat",
      supplyMetal: ".supply-metal",
      supplyTech: ".supply-tech",
      tab: ".tab",
      tech: ".tech",
      upgrade: ".upgrade",
      upgradeCost: ".upgrade-cost"
    },
    setStoredFactoryState: vi.fn(),
    syncFactoryProduction: vi.fn((state) => ({ state })),
    ...overrides
  });
}

describe("factory popup runtime", () => {
  it("renders Factory exclusively from the server read model and submits server intents", async () => {
    const open = createElement();
    const popup = createElement();
    const close = createElement();
    const collect = createElement();
    const upgrade = createElement();
    const renderServerFactorySlotList = vi.fn();
    const submitServerFactoryCommand = vi.fn(async () => ({ errors: [] }));
    const serverFactory = {
      districtId: "district:1",
      buildingId: "building:factory",
      level: 3,
      network: { activeFactoryCount: 2, networkSpeedMultiplier: 1.1 },
      producedSummary: [
        { resourceKey: "metal-parts", currentAmount: 7, capacity: 10 },
        { resourceKey: "tech-core", currentAmount: 3, capacity: 5 },
        { resourceKey: "combat-module", currentAmount: 1, capacity: 2 }
      ],
      productionLines: [{ recipeId: "metal-parts", canCollect: true, canStart: true, canCancelWaiting: true }]
    };
    const runtime = createRuntime({
      allowLegacyLocalProduction: false,
      getServerFactoryReadModel: () => serverFactory,
      getServerTickRateMs: () => 5000,
      renderServerFactorySlotList,
      setBuildingActionFeedback: vi.fn(),
      submitServerFactoryCommand,
      syncBuildingDetailTopbarVisibility: vi.fn()
    });
    const root = createRoot({
      ".collect": collect,
      ".combat": createElement(),
      ".header": createElement(),
      ".level": createElement(),
      ".metal": createElement(),
      ".multiplier": createElement(),
      ".open": open,
      ".owned": createElement(),
      ".popup": popup,
      ".slots": createElement(),
      ".supply-combat": createElement(),
      ".supply-metal": createElement(),
      ".supply-tech": createElement(),
      ".tech": createElement(),
      ".upgrade": upgrade,
      ".upgrade-cost": createElement()
    }, { ".close": [close] });

    runtime.bindFactoryPopup(root);
    await open.dispatch("click");

    expect(root.querySelector(".metal").textContent).toBe("7 / 10");
    expect(root.querySelector(".tech").textContent).toBe("3 / 5");
    expect(root.querySelector(".combat").textContent).toBe("1 / 2");
    expect(renderServerFactorySlotList).toHaveBeenCalled();
    const callbacks = renderServerFactorySlotList.mock.calls[0][2];
    await callbacks.onStartSlot(serverFactory.productionLines[0], { batchCount: 2 });
    expect(submitServerFactoryCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "craft-item",
      payload: expect.objectContaining({ buildingId: "building:factory", quantity: 2 })
    }));
  });

  it("handles missing factory DOM without crashing", () => {
    const runtime = createRuntime();

    expect(runtime.bindFactoryPopup(createRoot())).toBe(false);
    expect(runtime.bindFactoryPopup(null)).toBe(false);
  });

  it("binds factory shell and delegates collect action to runtime callbacks", () => {
    const open = createElement();
    const popup = createElement();
    const close = createElement();
    const collect = createElement();
    const upgrade = createElement();
    const appendBuildingActionResultEntry = vi.fn();
    const collectFactoryOutputsToSupplies = vi.fn(() => ({
      items: [{ label: "Metal", amount: 2 }],
      total: 2
    }));
    const renderFactoryDashboardPanel = vi.fn();
    const runtime = createRuntime({
      appendBuildingActionResultEntry,
      collectFactoryOutputsToSupplies,
      createStorageCollectResultPayload: vi.fn((payload) => payload),
      renderFactoryDashboardPanel,
      setBuildingActionFeedback: vi.fn(),
      syncBuildingDetailTopbarVisibility: vi.fn()
    });
    const root = createRoot({
      ".collect": collect,
      ".combat": createElement(),
      ".header": createElement(),
      ".level": createElement(),
      ".metal": createElement(),
      ".multiplier": createElement(),
      ".open": open,
      ".owned": createElement(),
      ".popup": popup,
      ".slots": createElement(),
      ".supply-combat": createElement(),
      ".supply-metal": createElement(),
      ".supply-tech": createElement(),
      ".tech": createElement(),
      ".upgrade": upgrade,
      ".upgrade-cost": createElement()
    }, {
      ".close": [close]
    });

    expect(runtime.bindFactoryPopup(root)).toBe(true);
    open.dispatch("click");
    collect.dispatch("click");

    expect(renderFactoryDashboardPanel).toHaveBeenCalled();
    expect(collectFactoryOutputsToSupplies).toHaveBeenCalledTimes(1);
    expect(appendBuildingActionResultEntry).toHaveBeenCalledWith(
      root,
      "police",
      expect.objectContaining({ buildingLabel: "Továrna" }),
      {},
      { syncPreview: true, forceLog: true }
    );
  });

  it("keeps factory upgrade button clickable in server-owned mode to explain the route", async () => {
    const open = createElement();
    const popup = createElement();
    const close = createElement();
    const collect = createElement();
    const upgrade = createElement();
    const setBuildingActionFeedback = vi.fn();
    const runtime = createRuntime({
      allowLegacyProductionUpgrade: false,
      setBuildingActionFeedback,
      syncBuildingDetailTopbarVisibility: vi.fn()
    });
    const root = createRoot({
      ".collect": collect,
      ".combat": createElement(),
      ".header": createElement(),
      ".level": createElement(),
      ".metal": createElement(),
      ".multiplier": createElement(),
      ".open": open,
      ".owned": createElement(),
      ".popup": popup,
      ".slots": createElement(),
      ".supply-combat": createElement(),
      ".supply-metal": createElement(),
      ".supply-tech": createElement(),
      ".tech": createElement(),
      ".upgrade": upgrade,
      ".upgrade-cost": createElement()
    }, {
      ".close": [close]
    });

    expect(runtime.bindFactoryPopup(root)).toBe(true);
    await open.dispatch("click");
    expect(upgrade.disabled).toBe(false);

    await upgrade.dispatch("click");
    expect(setBuildingActionFeedback).toHaveBeenCalledWith(
      root,
      "warning",
      "Továrna",
      expect.stringContaining("konkrétní kartu budovy")
    );
  });

  it("blocks legacy local factory collection when the server bridge owns production", async () => {
    const open = createElement();
    const popup = createElement();
    const close = createElement();
    const collect = createElement();
    const upgrade = createElement();
    const collectFactoryOutputsToSupplies = vi.fn(() => ({ items: [], total: 1 }));
    const setBuildingActionFeedback = vi.fn();
    const runtime = createRuntime({
      allowLegacyLocalProduction: false,
      collectFactoryOutputsToSupplies,
      setBuildingActionFeedback,
      syncBuildingDetailTopbarVisibility: vi.fn()
    });
    const root = createRoot({
      ".collect": collect,
      ".combat": createElement(),
      ".header": createElement(),
      ".level": createElement(),
      ".metal": createElement(),
      ".multiplier": createElement(),
      ".open": open,
      ".owned": createElement(),
      ".popup": popup,
      ".slots": createElement(),
      ".supply-combat": createElement(),
      ".supply-metal": createElement(),
      ".supply-tech": createElement(),
      ".tech": createElement(),
      ".upgrade": upgrade,
      ".upgrade-cost": createElement()
    }, {
      ".close": [close]
    });

    expect(runtime.bindFactoryPopup(root)).toBe(true);
    open.dispatch("click");
    await collect.dispatch("click");

    expect(collect.disabled).toBe(true);
    expect(collectFactoryOutputsToSupplies).not.toHaveBeenCalled();
    expect(setBuildingActionFeedback).toHaveBeenCalledWith(
      root,
      "warning",
      "Továrna",
      expect.stringContaining("serverový production/craft flow")
    );
  });

  it("cancels factory slot queue instead of only pausing it", () => {
    const open = createElement();
    const popup = createElement();
    const close = createElement();
    const collect = createElement();
    const upgrade = createElement();
    const factoryState = {
      level: 1,
      slots: [{
        id: "metal",
        isProducing: true,
        queueMode: true,
        queuedAmount: 4,
        productionRemainder: 0.5,
        producedAmount: 2,
        lastTick: 100
      }]
    };
    const setStoredFactoryState = vi.fn();
    const renderFactoryDashboardPanel = vi.fn();
    const runtime = createRuntime({
      getStoredFactoryState: () => factoryState,
      renderFactoryDashboardPanel,
      setStoredFactoryState,
      syncBuildingDetailTopbarVisibility: vi.fn()
    });
    const root = createRoot({
      ".collect": collect,
      ".combat": createElement(),
      ".header": createElement(),
      ".level": createElement(),
      ".metal": createElement(),
      ".multiplier": createElement(),
      ".open": open,
      ".owned": createElement(),
      ".popup": popup,
      ".slots": createElement(),
      ".supply-combat": createElement(),
      ".supply-metal": createElement(),
      ".supply-tech": createElement(),
      ".tech": createElement(),
      ".upgrade": upgrade,
      ".upgrade-cost": createElement()
    }, {
      ".close": [close]
    });

    expect(runtime.bindFactoryPopup(root)).toBe(true);
    open.dispatch("click");
    renderFactoryDashboardPanel.mock.calls.at(-1)[2].onPauseSlot({ slot: { id: "metal" } });

    const nextState = setStoredFactoryState.mock.calls.at(-1)[0];
    expect(nextState.slots[0]).toEqual(expect.objectContaining({
      isProducing: false,
      queueMode: false,
      queuedAmount: 0,
      productionRemainder: 0,
      producedAmount: 2
    }));
  });

  it("caps added factory queue amount at the slot queue cap", () => {
    const open = createElement();
    const popup = createElement();
    const close = createElement();
    const collect = createElement();
    const upgrade = createElement();
    const factoryState = {
      level: 1,
      slots: [{
        id: "metal",
        resourceKey: "metalParts",
        isProducing: true,
        queueMode: true,
        queuedAmount: 8,
        queueCap: 9,
        slotCap: 20,
        producedAmount: 0,
        lastTick: 100
      }]
    };
    const setStoredFactoryState = vi.fn();
    const renderFactoryDashboardPanel = vi.fn();
    const runtime = createRuntime({
      getStoredFactoryState: () => factoryState,
      renderFactoryDashboardPanel,
      setStoredFactoryState,
      syncBuildingDetailTopbarVisibility: vi.fn()
    });
    const root = createRoot({
      ".collect": collect,
      ".combat": createElement(),
      ".header": createElement(),
      ".level": createElement(),
      ".metal": createElement(),
      ".multiplier": createElement(),
      ".open": open,
      ".owned": createElement(),
      ".popup": popup,
      ".slots": createElement(),
      ".supply-combat": createElement(),
      ".supply-metal": createElement(),
      ".supply-tech": createElement(),
      ".tech": createElement(),
      ".upgrade": upgrade,
      ".upgrade-cost": createElement()
    }, {
      ".close": [close]
    });

    expect(runtime.bindFactoryPopup(root)).toBe(true);
    open.dispatch("click");
    renderFactoryDashboardPanel.mock.calls.at(-1)[2].onStartSlot({ slot: { id: "metal" }, queueCap: 9 }, { batchCount: 4 });

    const nextState = setStoredFactoryState.mock.calls.at(-1)[0];
    expect(nextState.slots[0]).toEqual(expect.objectContaining({
      isProducing: true,
      queueMode: true,
      queuedAmount: 9
    }));
  });

  it("waits for upgrade confirmation before spending factory cash", async () => {
    const open = createElement();
    const popup = createElement();
    const close = createElement();
    const collect = createElement();
    const upgrade = createElement();
    const setStoredEconomyState = vi.fn();
    const setStoredFactoryState = vi.fn();
    const createUpgradeConfirmationController = vi.fn(() => ({
      close: vi.fn(),
      isOpen: vi.fn(() => false),
      open: vi.fn(() => Promise.resolve(false))
    }));
    const runtime = createRuntime({
      createUpgradeConfirmationController,
      setStoredEconomyState,
      setStoredFactoryState,
      syncBuildingDetailTopbarVisibility: vi.fn()
    });
    const root = createRoot({
      ".collect": collect,
      ".combat": createElement(),
      ".header": createElement(),
      ".level": createElement(),
      ".metal": createElement(),
      ".multiplier": createElement(),
      ".open": open,
      ".owned": createElement(),
      ".popup": popup,
      ".slots": createElement(),
      ".supply-combat": createElement(),
      ".supply-metal": createElement(),
      ".supply-tech": createElement(),
      ".tech": createElement(),
      ".upgrade": upgrade,
      ".upgrade-cost": createElement()
    }, {
      ".close": [close]
    });

    expect(runtime.bindFactoryPopup(root)).toBe(true);
    await upgrade.dispatch("click");

    expect(createUpgradeConfirmationController).toHaveBeenCalled();
    expect(setStoredEconomyState).not.toHaveBeenCalled();
    expect(setStoredFactoryState).not.toHaveBeenCalled();
  });

  it("upgrades factory after confirmation", async () => {
    const open = createElement();
    const popup = createElement();
    const close = createElement();
    const collect = createElement();
    const upgrade = createElement();
    const setStoredEconomyState = vi.fn();
    const setStoredFactoryState = vi.fn();
    const createUpgradeConfirmationController = vi.fn(() => ({
      close: vi.fn(),
      isOpen: vi.fn(() => false),
      open: vi.fn(() => Promise.resolve(true))
    }));
    const runtime = createRuntime({
      createUpgradeConfirmationController,
      setStoredEconomyState,
      setStoredFactoryState,
      syncBuildingDetailTopbarVisibility: vi.fn()
    });
    const root = createRoot({
      ".collect": collect,
      ".combat": createElement(),
      ".header": createElement(),
      ".level": createElement(),
      ".metal": createElement(),
      ".multiplier": createElement(),
      ".open": open,
      ".owned": createElement(),
      ".popup": popup,
      ".slots": createElement(),
      ".supply-combat": createElement(),
      ".supply-metal": createElement(),
      ".supply-tech": createElement(),
      ".tech": createElement(),
      ".upgrade": upgrade,
      ".upgrade-cost": createElement()
    }, {
      ".close": [close]
    });

    expect(runtime.bindFactoryPopup(root)).toBe(true);
    await upgrade.dispatch("click");

    expect(setStoredEconomyState).toHaveBeenCalledWith({ cleanMoney: 900 });
    expect(setStoredFactoryState).toHaveBeenCalledWith(expect.objectContaining({
      level: 2
    }));
  });
});
