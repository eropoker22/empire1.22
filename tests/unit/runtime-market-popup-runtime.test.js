import { describe, expect, it, vi } from "vitest";
import { createMarketPopupRuntime } from "../../page-assets/js/app/runtime/marketPopupRuntime.js";

function createElement(dataset = {}) {
  const listeners = new Map();

  return {
    dataset,
    hidden: true,
    textContent: "",
    addEventListener: vi.fn((type, listener) => {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    }),
    dispatch(type) {
      for (const listener of listeners.get(type) || []) {
        listener({ key: "Escape", type });
      }
    },
    replaceChildren: vi.fn()
  };
}

function createRoot(elements = {}, all = {}) {
  return {
    querySelector: vi.fn((selector) => elements[selector] || null),
    querySelectorAll: vi.fn((selector) => all[selector] || [])
  };
}

function createRuntime(overrides = {}) {
  return createMarketPopupRuntime({
    MARKET_PLAYER_TAB_ID: "player-market",
    MARKET_TAB_CONFIG: {
      market: { items: [], payment: "cleanMoney" },
      "black-market": { items: [], payment: "dirtyMoney" },
      "player-market": { items: [] }
    },
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    closeMarketPanel: vi.fn((popup) => {
      popup.hidden = true;
    }),
    createMarketCatalogCallbacks: vi.fn(() => ({ onBuyItem: vi.fn() })),
    createMarketCatalogPanelPayload: vi.fn(() => ({ items: [] })),
    createMarketCopy: vi.fn((tab) => `copy:${tab}`),
    createMarketDashboardAdapter: vi.fn((payload) => payload),
    createMarketDashboardViewModel: vi.fn((payload) => payload),
    getMarketMaxStock: vi.fn(() => 10),
    getMarketRefreshCityTimeLabel: vi.fn(() => "11:00"),
    getMarketServerScope: vi.fn(() => ({ serverLabel: "FREE-01" })),
    getMarketStockAmount: vi.fn(() => 5),
    getMarketStockLabel: vi.fn(() => "5/10"),
    getMarketStockPercent: vi.fn(() => 50),
    getGameplayExecutionMode: vi.fn(() => "local-demo"),
    getResolvedEconomyState: vi.fn(() => ({ cleanMoney: 100 })),
    getResolvedGangState: vi.fn(() => ({ heat: 0 })),
    getResolvedMarketPriceState: vi.fn(() => ({ nextRefreshAt: new Date(Date.now() + 1000).toISOString() })),
    normalizeMarketTradeState: vi.fn((state) => state),
    openMarketPanel: vi.fn((popup) => {
      popup.hidden = false;
    }),
    refreshMarketPricesIfNeeded: vi.fn(() => ({ nextRefreshAt: new Date(Date.now() + 1000).toISOString() })),
    renderMarketDashboard: vi.fn(),
    renderMarketFeedback: vi.fn(),
    renderMarketPanel: vi.fn(),
    selectors: {
      close: ".close",
      copy: ".copy",
      dashboard: ".dashboard",
      feedback: ".feedback",
      list: ".list",
      open: ".open",
      popup: ".popup",
      serverBadge: ".server",
      tab: ".tab"
    },
    setStoredMarketPriceState: vi.fn(),
    syncMarketTabs: vi.fn(),
    windowRef: {
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(() => 7)
    },
    ...overrides
  });
}

describe("market popup runtime", () => {
  it("rechecks the current local deadline instead of forcing a stale scheduled refresh", () => {
    let scheduledRefresh = null;
    const refreshMarketPricesIfNeeded = vi.fn(() => ({
      nextRefreshAt: new Date(Date.now() + 60_000).toISOString()
    }));
    const windowRef = {
      clearTimeout: vi.fn(),
      setTimeout: vi.fn((callback) => {
        scheduledRefresh = callback;
        return 7;
      })
    };
    const runtime = createRuntime({ refreshMarketPricesIfNeeded, windowRef });
    const root = createRoot({
      ".copy": createElement(),
      ".dashboard": createElement(),
      ".feedback": createElement(),
      ".list": createElement(),
      ".open": createElement(),
      ".popup": createElement(),
      ".server": createElement(),
      "[data-market-title]": createElement()
    }, {
      ".close": [createElement()],
      ".tab": [createElement({ marketTab: "market" })]
    });

    expect(runtime.bindMarketPopup(root)).toBe(true);
    expect(scheduledRefresh).toBeTypeOf("function");
    scheduledRefresh();

    expect(refreshMarketPricesIfNeeded).toHaveBeenCalledWith(false);
    expect(refreshMarketPricesIfNeeded).not.toHaveBeenCalledWith(true);
  });

  it("binds the shared market renderer in hosted mode without starting local timers", () => {
    const open = createElement();
    const refreshMarketPricesIfNeeded = vi.fn(() => ({
      nextRefreshAt: new Date(Date.now() + 1000).toISOString()
    }));
    const windowRef = {
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(() => 7)
    };
    const runtime = createRuntime({
      getGameplayExecutionMode: vi.fn(() => "server-authoritative"),
      getServerMarketReadModel: vi.fn(() => ({ resources: [], playerMarket: { listings: [] } })),
      refreshMarketPricesIfNeeded,
      windowRef
    });
    const root = createRoot({
      ".copy": createElement(),
      ".dashboard": createElement(),
      ".feedback": createElement(),
      ".list": createElement(),
      ".open": open,
      ".popup": createElement(),
      ".server": createElement(),
      "[data-market-title]": createElement()
    }, {
      ".close": [createElement()],
      ".tab": [createElement({ marketTab: "market" })]
    });

    expect(runtime.bindMarketPopup(root)).toBe(true);
    expect(open.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    open.dispatch("click");
    expect(refreshMarketPricesIfNeeded).not.toHaveBeenCalled();
    expect(windowRef.setTimeout).not.toHaveBeenCalled();
  });

  it("uses only authoritative offers, balances and refresh data in hosted mode", () => {
    const open = createElement();
    const renderMarketPanel = vi.fn();
    const renderMarketDashboard = vi.fn();
    const createMarketDashboardAdapter = vi.fn((payload) => payload);
    const getCityMarketTabConfig = vi.fn(() => ({
      items: [{ itemId: "chemicals" }],
      payment: "cleanMoney"
    }));
    const getMarketRefreshCityTimeLabel = vi.fn(() => "11:00");
    const getMarketServerScope = vi.fn(() => ({ serverId: "local-preview" }));
    const getResolvedEconomyState = vi.fn(() => ({ cleanMoney: 25_000, dirtyMoney: 0 }));
    const serverMarket = {
      resources: [
        {
          id: "chemicals",
          name: "Chemicals",
          category: "material",
          normalMarket: { available: true, offerIndex: 1, price: 450, sellPrice: 200, stock: 8, maxStock: 10, stockPercent: 80, canBuy: true, canSell: true },
          blackMarket: { available: false, heatRisk: 10 }
        },
        {
          id: "biomass",
          name: "Biomass",
          normalMarket: { available: true, offerIndex: 0, price: 500, sellPrice: 240, stock: 7, maxStock: 12, stockPercent: 58, canBuy: true, canSell: false },
          blackMarket: { available: false }
        }
      ],
      normalMarket: { nextRefreshCityTimeLabel: "19:00" },
      blackMarket: {
        refreshesAt: Date.UTC(2040, 0, 1, 4, 30),
        heatByValue: [{ min: 1, heat: 10 }]
      },
      playerMarket: { listings: [] }
    };
    const runtime = createRuntime({
      createMarketDashboardAdapter,
      getCityMarketTabConfig,
      getGameplayExecutionMode: vi.fn(() => "server-authoritative"),
      getMarketRefreshCityTimeLabel,
      getMarketServerScope,
      getResolvedEconomyState,
      getServerMarketReadModel: vi.fn(() => serverMarket),
      getServerPlayerView: vi.fn(() => ({
        economy: { cleanCash: 4_321, dirtyCash: 876 },
        resourceBalances: { chemicals: 5 }
      })),
      renderMarketDashboard,
      renderMarketPanel
    });
    const root = createRoot({
      ".copy": createElement(),
      ".dashboard": createElement(),
      ".feedback": createElement(),
      ".list": createElement(),
      ".open": open,
      ".popup": createElement(),
      ".server": createElement(),
      "[data-market-title]": createElement()
    }, {
      ".close": [createElement()],
      ".tab": [createElement({ marketTab: "market" })]
    });

    expect(runtime.bindMarketPopup(root)).toBe(true);
    open.dispatch("click");

    expect(getCityMarketTabConfig).not.toHaveBeenCalled();
    expect(getMarketRefreshCityTimeLabel).not.toHaveBeenCalled();
    expect(getMarketServerScope).not.toHaveBeenCalled();
    expect(getResolvedEconomyState).not.toHaveBeenCalled();
    expect(createMarketDashboardAdapter).toHaveBeenCalledWith(expect.objectContaining({
      economy: { cleanMoney: 4_321, dirtyMoney: 876 },
      marketState: serverMarket,
      refreshAtCityTime: "19:00",
      serverScope: {}
    }));
    const [, viewModel, callbacks] = renderMarketPanel.mock.calls[0];
    expect(viewModel.items.map((item) => item.resourceId))
      .toEqual(["biomass", "chemicals"]);
    const chemicals = viewModel.items.find((item) => item.resourceId === "chemicals");
    expect(chemicals).toMatchObject({
      stock: 8,
      maxStock: 10,
      heatRisk: 0,
      heatByValue: [],
      marketCategoryLabel: "drug_material",
      marketMetadata: expect.objectContaining({ marketCategory: "drug_material" })
    });
    expect(chemicals.badges).not.toContainEqual(expect.objectContaining({ tone: "risk" }));
    expect(callbacks.getTradeState(chemicals, 2)).toMatchObject({
      sellDisabled: false,
      sellTitle: "Prodat do trhu."
    });
    expect(callbacks.getTradeState(chemicals, 3)).toMatchObject({
      sellDisabled: true,
      sellTitle: "Trh je přesycený."
    });
    expect(renderMarketDashboard.mock.calls[0]?.[2]).toEqual({
      onClearRecentTransactions: expect.any(Function)
    });
  });

  it("rerenders an open hosted popup from the gameplay slice and falls back to the canonical city refresh label", () => {
    const documentRef = createElement();
    const open = createElement();
    const popup = createElement();
    const renderMarketDashboard = vi.fn();
    const renderMarketPanel = vi.fn();
    const windowRef = {
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(() => 7)
    };
    let serverMarket = {
      resources: [{
        id: "chemicals",
        name: "Chemicals",
        normalMarket: {
          available: true,
          price: 450,
          sellPrice: 200,
          stock: 8,
          maxStock: 10,
          stockPercent: 80,
          canBuy: true,
          canSell: true
        },
        blackMarket: { available: false }
      }],
      normalMarket: { nextRefreshCityTimeLabel: "17:00" },
      blackMarket: { refreshesAt: Date.UTC(2040, 0, 1, 23, 45) },
      playerMarket: { listings: [] }
    };
    const runtime = createRuntime({
      documentRef,
      getGameplayExecutionMode: vi.fn(() => "server-authoritative"),
      getServerMarketReadModel: vi.fn(() => serverMarket),
      getServerPlayerView: vi.fn(() => ({
        economy: { cleanCash: 1_000, dirtyCash: 0 },
        resourceBalances: { chemicals: 1 }
      })),
      renderMarketDashboard,
      renderMarketPanel,
      windowRef
    });
    const root = createRoot({
      ".copy": createElement(),
      ".dashboard": createElement(),
      ".feedback": createElement(),
      ".list": createElement(),
      ".open": open,
      ".popup": popup,
      ".server": createElement(),
      "[data-market-title]": createElement()
    }, {
      ".close": [createElement()],
      ".tab": [createElement({ marketTab: "market" })]
    });

    expect(runtime.bindMarketPopup(root)).toBe(true);
    expect(documentRef.addEventListener).toHaveBeenCalledWith(
      "empire:gameplay-slice-rendered",
      expect.any(Function)
    );
    documentRef.dispatch("empire:gameplay-slice-rendered");
    expect(renderMarketPanel).not.toHaveBeenCalled();

    open.dispatch("click");
    expect(renderMarketDashboard.mock.calls.at(-1)?.[1]?.refreshAtCityTime).toBe("17:00");
    expect(renderMarketPanel.mock.calls.at(-1)?.[1]?.items[0]?.stock).toBe(8);

    serverMarket = {
      ...serverMarket,
      resources: [{
        ...serverMarket.resources[0],
        normalMarket: { ...serverMarket.resources[0].normalMarket, stock: 9, stockPercent: 90 }
      }],
      normalMarket: {}
    };
    documentRef.dispatch("empire:gameplay-slice-rendered");

    expect(renderMarketPanel).toHaveBeenCalledTimes(2);
    expect(renderMarketPanel.mock.calls.at(-1)?.[1]?.items[0]?.stock).toBe(9);
    expect(renderMarketDashboard.mock.calls.at(-1)?.[1]?.refreshAtCityTime).toBe("--:--");
    expect(windowRef.setTimeout).not.toHaveBeenCalled();
  });

  it("handles missing market DOM without crashing", () => {
    expect(createRuntime().bindMarketPopup(createRoot())).toBe(false);
    expect(createRuntime().bindMarketPopup(null)).toBe(false);
  });

  it("binds market popup shell, renders active tab, and schedules refresh", () => {
    const open = createElement();
    const popup = createElement();
    const tab = createElement({ marketTab: "black-market" });
    const playerTab = createElement({ marketTab: "player-market" });
    const close = createElement();
    const title = createElement();
    const renderMarketPanel = vi.fn();
    const renderBlackMarketPanel = vi.fn();
    const openMarketPanel = vi.fn((target) => {
      target.hidden = false;
    });
    const runtime = createRuntime({
      openMarketPanel,
      renderBlackMarketPanel,
      renderMarketPanel
    });
    const root = createRoot({
      ".copy": createElement(),
      ".dashboard": createElement(),
      ".feedback": createElement(),
      ".list": createElement(),
      ".open": open,
      ".popup": popup,
      ".server": createElement(),
      "[data-market-title]": title
    }, {
      ".close": [close],
      ".tab": [tab, playerTab]
    });

    expect(runtime.bindMarketPopup(root)).toBe(true);
    open.dispatch("click");
    expect(title.textContent).toBe("Městský market");
    expect(title.dataset.mobileTitle).toBe("Market");
    tab.dispatch("click");
    expect(title.textContent).toBe("Černý trh");
    expect(title.dataset.mobileTitle).toBe("Černý trh");
    playerTab.dispatch("click");

    expect(openMarketPanel).toHaveBeenCalledWith(popup);
    expect(renderMarketPanel).toHaveBeenCalledTimes(1);
    expect(renderBlackMarketPanel).toHaveBeenCalledTimes(1);
    expect(title.textContent).toBe("Hráčský bazar");
    expect(title.dataset.mobileTitle).toBe("Hráčský bazar");
  });

  it("renders only resources available in the selected server market", () => {
    const open = createElement();
    const popup = createElement();
    const close = createElement();
    const renderMarketPanel = vi.fn();
    const runtime = createRuntime({
      getServerMarketReadModel: vi.fn(() => ({
        resources: [
          {
            id: "chemicals",
            name: "Chemicals",
            normalMarket: { available: true, price: 450, sellPrice: 200, stock: 8, maxStock: 10, stockPercent: 80, canBuy: true, canSell: false },
            blackMarket: { available: false }
          },
          {
            id: "tech-core",
            name: "Tech Core",
            normalMarket: { available: false, price: 3260, sellPrice: 1000, stock: 0, maxStock: 0, stockPercent: 0 },
            blackMarket: { available: true, price: 5000, dirtyCashPrice: 6250, canBuyWithDirtyCash: true, canBuyWithCleanCash: true }
          }
        ],
        playerMarket: { listings: [] }
      })),
      getServerPlayerView: vi.fn(() => ({
        economy: { cleanCash: 10000 },
        resourceBalances: {},
        storage: {
          groups: [{ items: [{ resourceKey: "chemicals", currentAmount: 4, maxAmount: 5 }] }]
        }
      })),
      renderMarketPanel
    });
    const root = createRoot({
      ".copy": createElement(),
      ".dashboard": createElement(),
      ".feedback": createElement(),
      ".list": createElement(),
      ".open": open,
      ".popup": popup,
      ".server": createElement(),
      "[data-market-title]": createElement()
    }, {
      ".close": [close],
      ".tab": [createElement({ marketTab: "market" })]
    });

    runtime.bindMarketPopup(root);
    open.dispatch("click");

    expect(renderMarketPanel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ items: [expect.objectContaining({ resourceId: "chemicals" })] }),
      expect.anything()
    );

    const [, viewModel, callbacks] = renderMarketPanel.mock.calls.at(-1);
    const item = viewModel.items[0];
    expect(callbacks.getTradeState(item, 1).buyDisabled).toBe(false);
    expect(callbacks.getTradeState(item, 2)).toMatchObject({
      buyDisabled: true,
      buyTitle: "Do SKLADU se zvolené množství nevejde."
    });
    expect(callbacks.getTradeState({ ...item, storageAvailableAmount: 99 }, 9).buyTitle).toBe("Trh má jen 8 ks.");
    expect(callbacks.getTradeState({
      ...item,
      storageAvailableAmount: 99,
      playerCleanCash: 500
    }, 2).buyTitle).toContain("nemáš dost clean cash");
  });

  it("uses the authoritative player bazaar projection when the server provides it", () => {
    const documentRef = createElement();
    const open = createElement();
    const popup = createElement();
    const close = createElement();
    const playerTab = createElement({ marketTab: "player-market" });
    const renderPlayerMarketPanel = vi.fn();
    const runtime = createRuntime({
      documentRef,
      getGameplayExecutionMode: vi.fn(() => "server-authoritative"),
      getServerMarketReadModel: vi.fn(() => ({
        resources: [{ id: "chemicals", name: "Chemicals", normalMarket: { price: 450 } }],
        playerMarket: { listings: [], ownListingCount: 0, listingLimitPerSeller: 5 }
      })),
      getServerPlayerView: vi.fn(() => ({ resourceBalances: { chemicals: 3 } })),
      renderPlayerMarketPanel,
      submitServerMarketCommand: vi.fn()
    });
    const root = createRoot({
      ".copy": createElement(),
      ".dashboard": createElement(),
      ".feedback": createElement(),
      ".list": createElement(),
      ".open": open,
      ".popup": popup,
      ".server": createElement(),
      "[data-market-title]": createElement()
    }, {
      ".close": [close],
      ".tab": [createElement({ marketTab: "market" }), playerTab]
    });

    runtime.bindMarketPopup(root);
    open.dispatch("click");
    playerTab.dispatch("click");

    expect(renderPlayerMarketPanel).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ isAuthoritative: true, isPreview: false }),
      expect.objectContaining({
        onCreateListing: expect.any(Function),
        onFormStateChange: expect.any(Function)
      })
    );

    const formState = {
      itemValue: "materials|chemicals",
      requestedAmount: 10,
      unitPrice: 25,
      currency: "cleanMoney"
    };
    renderPlayerMarketPanel.mock.calls.at(-1)[2].onFormStateChange(formState);
    documentRef.dispatch("empire:gameplay-slice-rendered");
    expect(renderPlayerMarketPanel.mock.calls.at(-1)[1].formState).toEqual(formState);

    close.dispatch("click");
    open.dispatch("click");
    expect(renderPlayerMarketPanel.mock.calls.at(-1)[1].formState).toBeNull();
  });

  it("recalculates black-market Heat from the selected quantity", () => {
    const open = createElement();
    const popup = createElement();
    const blackTab = createElement({ marketTab: "black-market" });
    const renderBlackMarketPanel = vi.fn();
    const runtime = createRuntime({
      getServerMarketReadModel: vi.fn(() => ({
        resources: [{
          id: "neon-dust",
          name: "Neon Dust",
          normalMarket: { available: false, sellPrice: 1 },
          blackMarket: {
            available: true,
            price: 400,
            dirtyCashPrice: 500,
            heatRisk: 1,
            canBuyWithDirtyCash: true,
            canBuyWithCleanCash: true
          }
        }],
        blackMarket: {
          heatByValue: [
            { min: 3500, heat: 10 },
            { min: 1800, heat: 6 },
            { min: 750, heat: 3 },
            { min: 1, heat: 1 }
          ]
        },
        playerMarket: { listings: [] }
      })),
      getServerPlayerView: vi.fn(() => ({ economy: { cleanCash: 10000 }, resourceBalances: {} })),
      renderBlackMarketPanel
    });
    const root = createRoot({
      ".copy": createElement(),
      ".dashboard": createElement(),
      ".feedback": createElement(),
      ".list": createElement(),
      ".open": open,
      ".popup": popup,
      ".server": createElement(),
      "[data-market-title]": createElement()
    }, {
      ".close": [createElement()],
      ".tab": [createElement({ marketTab: "market" }), blackTab]
    });

    runtime.bindMarketPopup(root);
    blackTab.dispatch("click");

    const [, viewModel, callbacks] = renderBlackMarketPanel.mock.calls.at(-1);
    expect(viewModel.items[0].dirtyBuyPrice).toBe(500);
    expect(callbacks.getTradeState(viewModel.items[0], 1).totalLabel).toContain("Heat +1");
    expect(callbacks.getTradeState(viewModel.items[0], 2).totalLabel).toContain("Heat +3");
  });

  it("clears recent market transactions through dashboard callback", () => {
    const open = createElement();
    const popup = createElement();
    const close = createElement();
    const renderMarketDashboard = vi.fn();
    const setStoredMarketPriceState = vi.fn();
    const runtime = createRuntime({
      renderMarketDashboard,
      setStoredMarketPriceState,
      refreshMarketPricesIfNeeded: vi.fn(() => ({
        nextRefreshAt: new Date(Date.now() + 1000).toISOString(),
        transactions: [{ id: "tx-1" }]
      })),
      normalizeMarketTradeState: vi.fn((state) => state)
    });
    const root = createRoot({
      ".copy": createElement(),
      ".dashboard": createElement(),
      ".feedback": createElement(),
      ".list": createElement(),
      ".open": open,
      ".popup": popup,
      ".server": createElement(),
      "[data-market-title]": createElement()
    }, {
      ".close": [close],
      ".tab": [createElement({ marketTab: "market" })]
    });

    expect(runtime.bindMarketPopup(root)).toBe(true);
    open.dispatch("click");

    const dashboardOptions = renderMarketDashboard.mock.calls[0]?.[2];
    expect(typeof dashboardOptions?.onClearRecentTransactions).toBe("function");

    dashboardOptions.onClearRecentTransactions();

    expect(setStoredMarketPriceState).toHaveBeenCalledWith(expect.objectContaining({
      transactions: []
    }));
    expect(renderMarketDashboard).toHaveBeenCalledTimes(2);
  });
});
