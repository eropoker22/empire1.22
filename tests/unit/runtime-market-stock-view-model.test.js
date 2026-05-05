import { describe, expect, it } from "vitest";
import {
  createMarketDashboardAdapter,
  getMarketDashboardStockSummary,
  getMarketMaxStock,
  getMarketStockAmount,
  getMarketStockLabel,
  getMarketStockPercent,
  getMarketTabLabel,
  resolveMarketHeatRiskByValue
} from "../../page-assets/js/app/runtime/marketStockViewModel.js";

const stockConfig = {
  market: {
    chemicals: { start: 700, max: 1100 },
    biomass: { start: 1000, max: 1600 }
  }
};
const options = {
  getMarketStockConfig: (tabId, itemId) => stockConfig[tabId]?.[itemId] || null,
  normalizeMarketStockState: (stock) => ({ ...(stock || {}) }),
  getMarketStockKey: (tabId, itemId) => `${tabId}:${itemId}`,
  clamp: (value, min, max) => Math.min(Math.max(value, min), max)
};

describe("market stock view model adapters", () => {
  it("builds stock amount, max, label and percent without mutating state", () => {
    const state = { stock: { "market:chemicals": 550 } };

    expect(getMarketStockAmount(state, "market", "chemicals", options)).toBe(550);
    expect(getMarketMaxStock("market", "chemicals", options)).toBe(1100);
    expect(getMarketStockLabel(state, "market", "chemicals", options)).toBe("Stock 550/1100 ks");
    expect(getMarketStockPercent(state, "market", "chemicals", options)).toBe(50);
    expect(state.stock["market:chemicals"]).toBe(550);
  });

  it("uses stock defaults and safe no-limit fallbacks for partial data", () => {
    expect(getMarketStockAmount({}, "market", "biomass", options)).toBe(1000);
    expect(getMarketStockLabel({}, "black-market", "neon-dust", options)).toBe("Stock bez limitu");
    expect(getMarketStockPercent({}, "black-market", "neon-dust", options)).toBe(100);
    expect(getMarketTabLabel("unknown", { market: { label: "Normal market" } })).toBe("Market");
  });

  it("builds dashboard stock summaries for normal, black and player market tabs", () => {
    expect(getMarketDashboardStockSummary({
      activeTab: "market",
      marketState: { stock: { "market:chemicals": 5, "market:biomass": 7 } },
      tabConfig: { items: [{ itemId: "chemicals" }, { itemId: "biomass" }] },
      getStockAmount: (state, tabId, itemId) => state.stock[`${tabId}:${itemId}`]
    })).toBe("12 ks");

    expect(getMarketDashboardStockSummary({ activeTab: "black-market" })).toBe("neomezeně");
    expect(getMarketDashboardStockSummary({
      activeTab: "player-market",
      marketState: { playerListings: [{ id: "a" }, { id: "b" }] },
      serverId: "server-a",
      normalizePlayerMarketListings: (listings, serverId) => listings.map((listing) => ({ ...listing, serverId }))
    })).toBe("2 nabídek");
  });

  it("builds dashboard adapter input for existing market dashboard view-model", () => {
    const adapter = createMarketDashboardAdapter({
      activeTab: "market",
      marketState: {
        stock: { "market:chemicals": 4 },
        transactions: [{ id: "tx-1" }]
      },
      marketTabConfig: {
        market: {
          label: "Normal market",
          items: [{ itemId: "chemicals" }]
        }
      },
      economy: { cleanMoney: 100 },
      gangState: { heat: 2 },
      refreshCountdownSeconds: 30,
      normalizeMarketTransactions: (transactions) => transactions,
      getStockAmount: () => 4,
      formatPrice: (value) => `${value}$`
    });

    expect(adapter).toMatchObject({
      activeTab: "market",
      tabLabel: "Normal market",
      stockSummary: "4 ks",
      economy: { cleanMoney: 100 },
      gangState: { heat: 2 },
      refreshCountdownSeconds: 30,
      recentTransactions: [{ id: "tx-1" }]
    });
  });

  it("resolves heat risk table with safe fallback", () => {
    const table = [
      { min: 1000, heat: 5 },
      { min: 1, heat: 1 }
    ];

    expect(resolveMarketHeatRiskByValue(1200, table)).toEqual({ min: 1000, heat: 5 });
    expect(resolveMarketHeatRiskByValue(50, table)).toEqual({ min: 1, heat: 1 });
    expect(resolveMarketHeatRiskByValue(0, [])).toBeNull();
  });
});
