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
    getMarketRefreshCountdownSeconds: vi.fn(() => 12),
    getMarketServerScope: vi.fn(() => ({ serverLabel: "FREE-01" })),
    getMarketStockAmount: vi.fn(() => 5),
    getMarketStockLabel: vi.fn(() => "5/10"),
    getMarketStockPercent: vi.fn(() => 50),
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
    tab.dispatch("click");
    expect(title.textContent).toBe("Černý trh");
    playerTab.dispatch("click");

    expect(openMarketPanel).toHaveBeenCalledWith(popup);
    expect(renderMarketPanel).toHaveBeenCalledTimes(1);
    expect(renderBlackMarketPanel).toHaveBeenCalledTimes(1);
    expect(title.textContent).toBe("Hráčský bazar");
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
      getServerPlayerView: vi.fn(() => ({ economy: { cleanCash: 10000 }, resourceBalances: {} })),
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
  });

  it("uses the authoritative player bazaar projection when the server provides it", () => {
    const open = createElement();
    const popup = createElement();
    const close = createElement();
    const playerTab = createElement({ marketTab: "player-market" });
    const renderPlayerMarketPanel = vi.fn();
    const runtime = createRuntime({
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
    playerTab.dispatch("click");

    expect(renderPlayerMarketPanel).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ isAuthoritative: true, isPreview: false }),
      expect.objectContaining({ onCreateListing: expect.any(Function) })
    );
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
