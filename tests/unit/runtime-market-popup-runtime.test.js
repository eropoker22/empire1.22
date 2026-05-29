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
    expect(title.textContent).toBe("Neon Market");
    tab.dispatch("click");
    expect(title.textContent).toBe("Blackline Market");
    playerTab.dispatch("click");

    expect(openMarketPanel).toHaveBeenCalledWith(popup);
    expect(renderMarketPanel).toHaveBeenCalledTimes(1);
    expect(renderBlackMarketPanel).toHaveBeenCalledTimes(1);
    expect(title.textContent).toBe("Podzemní burza");
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
