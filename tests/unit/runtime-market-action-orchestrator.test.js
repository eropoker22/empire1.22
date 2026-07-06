import { describe, expect, it, vi } from "vitest";
import {
  createMarketCatalogCallbacks,
  createMarketTransaction,
  createPlayerMarketCallbacks,
  getMarketListingTotal
} from "../../page-assets/js/app/runtime/marketActionOrchestrator.js";

const formatMarketPrice = (value) => `${Math.max(0, Math.floor(Number(value) || 0))}$`;
const normalizeList = (value) => Array.isArray(value) ? value : [];
const normalizeStock = (stock) => ({ ...(stock || {}) });
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function createCommitHarness(initialState = {}) {
  let state = {
    stock: {},
    transactions: [],
    playerListings: [],
    ...initialState
  };
  const commitMarketState = vi.fn((updater) => {
    state = updater(state);
    return state;
  });
  return {
    commitMarketState,
    getState: () => state
  };
}

describe("market action orchestrator", () => {
  it("creates transaction and listing totals without runtime state", () => {
    expect(getMarketListingTotal({ amount: 3, unitPrice: 75 })).toBe(225);
    expect(getMarketListingTotal({ amount: 0, unitPrice: 0 })).toBe(1);
    expect(createMarketTransaction({
      type: "sell",
      tabId: "market",
      item: { itemId: "chemicals", name: "Chemicals" },
      amount: 2,
      total: 100,
      moneyKey: "cleanMoney"
    }, {
      now: () => 1234,
      random: () => 0.5
    })).toMatchObject({
      id: "market-tx-1234-i",
      type: "sell",
      tabId: "market",
      itemId: "chemicals",
      itemName: "Chemicals",
      amount: 2,
      total: 100,
      moneyKey: "cleanMoney",
      createdAt: 1234
    });
  });

  it("handles player listing create and cancel through dependency callbacks", () => {
    const harness = createCommitHarness({ playerListings: [{ id: "peer" }], transactions: [{ id: "old" }] });
    const setMarketFeedback = vi.fn();
    const setInventoryAmount = vi.fn();
    const refreshMarketTab = vi.fn();

    const callbacks = createPlayerMarketCallbacks({
      playerMarketViewModel: { ownListingCount: 0 },
      serverScope: { serverId: "server-a" },
      sellerId: "player:self",
      playerTabId: "player-market",
      ownListingLimit: 4,
      listingLimit: 10,
      listingTtlMs: 60000,
      now: () => 1000,
      random: () => 0.5,
      getSuggestedPlayerMarketUnitPrice: () => 125,
      setMarketFeedback,
      setInventoryAmount,
      getInventoryAmount: () => 2,
      getCurrentPlayerIdentityLabel: () => "Player",
      commitMarketState: harness.commitMarketState,
      normalizePlayerMarketListings: normalizeList,
      normalizeMarketTransactions: normalizeList,
      createTransaction: (payload) => ({ id: "tx", ...payload }),
      formatMarketPrice,
      applyTopbarEconomy: vi.fn(),
      refreshMarketTab
    });

    expect(callbacks.getSuggestedUnitPrice({ itemId: "chemicals" })).toBe(125);
    callbacks.onCreateListing({
      item: { inventory: "materials", itemId: "chemicals", name: "Chemicals", category: "Material", amount: 5 },
      requestedAmount: 3,
      unitPrice: 125,
      currency: "cleanMoney"
    });

    expect(setInventoryAmount).toHaveBeenCalledWith("materials", "chemicals", 2);
    expect(harness.getState().playerListings[0]).toMatchObject({
      id: "player-market:server-a:1000:i",
      sellerId: "player:self",
      sellerName: "Player",
      itemId: "chemicals",
      amount: 3,
      unitPrice: 125,
      expiresAt: 61000
    });
    expect(harness.getState().transactions[0]).toMatchObject({
      id: "tx",
      type: "sell",
      total: 375
    });
    expect(setMarketFeedback).toHaveBeenLastCalledWith("success", "Vystaveno 3x Chemicals za 125$ / kus.");
    expect(refreshMarketTab).toHaveBeenCalledTimes(1);

    callbacks.onCancelListing({ id: "player-market:server-a:1000:i", inventory: "materials", itemId: "chemicals", itemName: "Chemicals", amount: 3 });
    expect(setInventoryAmount).toHaveBeenLastCalledWith("materials", "chemicals", 5);
    expect(harness.getState().playerListings.some((listing) => listing.id === "player-market:server-a:1000:i")).toBe(false);
    expect(setMarketFeedback).toHaveBeenLastCalledWith("success", "Nabídka Chemicals stažena zpět do skladu.");
  });

  it("guards player listing create limits and handles dirty listing purchase", () => {
    const limitedFeedback = vi.fn();
    createPlayerMarketCallbacks({
      playerMarketViewModel: { ownListingCount: 4 },
      ownListingLimit: 4,
      setMarketFeedback: limitedFeedback
    }).onCreateListing({ item: { itemId: "chemicals" } });
    expect(limitedFeedback).toHaveBeenCalledWith("warning", "Nejdřív stáhni některou vlastní nabídku.");

    const harness = createCommitHarness({ playerListings: [{ id: "listing-1" }], transactions: [] });
    const setStoredEconomyState = vi.fn();
    const setInventoryAmount = vi.fn();
    const addGangHeat = vi.fn();
    const setMarketFeedback = vi.fn();

    createPlayerMarketCallbacks({
      root: "root",
      serverScope: { serverId: "server-a" },
      playerMarketViewModel: { ownListingCount: 0 },
      ownListingLimit: 4,
      playerTabId: "player-market",
      getResolvedEconomyState: () => ({ dirtyMoney: 1000 }),
      setStoredEconomyState,
      getInventoryAmount: () => 1,
      setInventoryAmount,
      resolveBlackMarketHeatRisk: () => ({ heat: 5 }),
      addGangHeat,
      commitMarketState: harness.commitMarketState,
      normalizePlayerMarketListings: normalizeList,
      normalizeMarketTransactions: normalizeList,
      createTransaction: (payload) => ({ id: "buy-tx", ...payload }),
      setMarketFeedback,
      formatMarketPrice,
      applyTopbarEconomy: vi.fn(),
      refreshMarketTab: vi.fn()
    }).onBuyListing({
      id: "listing-1",
      inventory: "drugs",
      itemId: "neon-dust",
      itemName: "Neon Dust",
      amount: 2,
      unitPrice: 100,
      currency: "dirtyMoney"
    });

    expect(setStoredEconomyState).toHaveBeenCalledWith({ dirtyMoney: 800 });
    expect(setInventoryAmount).toHaveBeenCalledWith("drugs", "neon-dust", 3);
    expect(addGangHeat).toHaveBeenCalledWith("root", 2, "Hráčský bazar: Neon Dust");
    expect(harness.getState().playerListings).toEqual([]);
    expect(setMarketFeedback).toHaveBeenLastCalledWith("danger", "Koupeno 2x Neon Dust. Dirty trade přidal heat.");
  });

  it("handles catalog buy/sell callbacks and disabled row refreshes", () => {
    const buyHarness = createCommitHarness({ stock: { "black-market:neon-dust": 10 }, transactions: [] });
    const setInventoryAmount = vi.fn();
    const setStoredEconomyState = vi.fn();
    const addGangHeat = vi.fn();
    const setMarketFeedback = vi.fn();
    const refreshMarketTab = vi.fn();
    const item = {
      inventory: "drugs",
      itemId: "neon-dust",
      name: "Neon Dust",
      buyPrice: 200,
      sellPrice: 90,
      paymentKey: "dirtyMoney",
      payoutKey: "dirtyMoney",
      hasLimitedStock: true,
      maxStock: 20
    };

    createMarketCatalogCallbacks({
      root: "root",
      activeTab: "black-market",
      getResolvedEconomyState: () => ({ dirtyMoney: 1000 }),
      getInventoryAmount: () => 1,
      getResolvedMarketPriceState: () => ({ stock: { "black-market:neon-dust": 10 } }),
      getStockAmount: () => 10,
      getMaxStock: () => 20,
      resolveBlackMarketHeatRisk: () => ({ heat: 4, label: "střední" }),
      createMarketTradeStateViewModel: (payload) => payload,
      formatMarketPrice,
      setMarketFeedback,
      setInventoryAmount,
      setStoredEconomyState,
      addGangHeat,
      commitMarketState: buyHarness.commitMarketState,
      normalizeMarketStockState: normalizeStock,
      getMarketStockKey: (tabId, itemId) => `${tabId}:${itemId}`,
      createTransaction: (payload) => ({ id: "buy-tx", ...payload }),
      normalizeMarketTransactions: normalizeList,
      applyTopbarEconomy: vi.fn(),
      refreshMarketTab
    }).onBuyItem(item, 2, vi.fn());

    expect(setInventoryAmount).toHaveBeenCalledWith("drugs", "neon-dust", 3);
    expect(setStoredEconomyState).toHaveBeenCalledWith({ dirtyMoney: 600 });
    expect(addGangHeat).toHaveBeenCalledWith("root", 4, "Černý trh nákup: Neon Dust");
    expect(buyHarness.getState().stock["black-market:neon-dust"]).toBe(8);
    expect(setMarketFeedback).toHaveBeenLastCalledWith("danger", "Kontakt předal 2x Neon Dust za 400$. Heat +4.");
    expect(refreshMarketTab).toHaveBeenCalledTimes(1);

    const updateRowTradeState = vi.fn();
    createMarketCatalogCallbacks({
      activeTab: "market",
      getResolvedEconomyState: () => ({ cleanMoney: 10 }),
      getResolvedMarketPriceState: () => ({}),
      getStockAmount: () => 10,
      setMarketFeedback
    }).onBuyItem({ ...item, paymentKey: "cleanMoney", buyPrice: 100 }, 2, updateRowTradeState);
    expect(updateRowTradeState).toHaveBeenCalledTimes(1);
    expect(setMarketFeedback).toHaveBeenLastCalledWith("warning", "Na nákup chybí 190$.");
  });

  it("handles catalog sell success and insufficient inventory fallback", () => {
    const harness = createCommitHarness({ stock: { "market:chemicals": 5 }, transactions: [] });
    const setMarketFeedback = vi.fn();
    const setInventoryAmount = vi.fn();
    const setStoredEconomyState = vi.fn();
    const item = {
      inventory: "materials",
      itemId: "chemicals",
      name: "Chemicals",
      buyPrice: 120,
      sellPrice: 80,
      paymentKey: "cleanMoney",
      payoutKey: "cleanMoney",
      hasLimitedStock: true,
      maxStock: 10
    };

    createMarketCatalogCallbacks({
      activeTab: "market",
      getResolvedEconomyState: () => ({ cleanMoney: 50 }),
      getInventoryAmount: () => 4,
      getResolvedMarketPriceState: () => ({ stock: { "market:chemicals": 5 } }),
      getStockAmount: () => 5,
      getMaxStock: () => 10,
      setMarketFeedback,
      setInventoryAmount,
      setStoredEconomyState,
      commitMarketState: harness.commitMarketState,
      normalizeMarketStockState: normalizeStock,
      getMarketStockKey: (tabId, itemId) => `${tabId}:${itemId}`,
      clamp,
      createTransaction: (payload) => ({ id: "sell-tx", ...payload }),
      normalizeMarketTransactions: normalizeList,
      formatMarketPrice,
      refreshMarketTab: vi.fn()
    }).onSellItem(item, 3, vi.fn());

    expect(setInventoryAmount).toHaveBeenCalledWith("materials", "chemicals", 1);
    expect(setStoredEconomyState).toHaveBeenCalledWith({ cleanMoney: 290 });
    expect(harness.getState().stock["market:chemicals"]).toBe(8);
    expect(harness.getState().transactions[0]).toMatchObject({ id: "sell-tx", type: "sell", total: 240 });
    expect(setMarketFeedback).toHaveBeenLastCalledWith("success", "Prodáno 3x Chemicals za 240$.");

    const updateRowTradeState = vi.fn();
    createMarketCatalogCallbacks({
      getInventoryAmount: () => 1,
      getResolvedMarketPriceState: () => ({}),
      getStockAmount: () => 0,
      getMaxStock: () => 10,
      setMarketFeedback
    }).onSellItem(item, 2, updateRowTradeState);
    expect(updateRowTradeState).toHaveBeenCalledTimes(1);
    expect(setMarketFeedback).toHaveBeenLastCalledWith("warning", "Ve skladu máš jen 1 ks Chemicals.");
  });

  it("does not crash when optional dependencies are missing", () => {
    expect(() => {
      const playerCallbacks = createPlayerMarketCallbacks({ ownListingLimit: 1, playerMarketViewModel: { ownListingCount: 0 } });
      playerCallbacks.onCreateListing();
      playerCallbacks.onCancelListing();
      playerCallbacks.onBuyListing();

      const catalogCallbacks = createMarketCatalogCallbacks();
      catalogCallbacks.getTradeState({ inventory: "materials", itemId: "x", buyPrice: 1, sellPrice: 1 }, 1);
      catalogCallbacks.onBuyItem({ inventory: "materials", itemId: "x", buyPrice: 1, paymentKey: "cleanMoney" }, 1);
      catalogCallbacks.onSellItem({ inventory: "materials", itemId: "x", name: "X", sellPrice: 1, payoutKey: "cleanMoney" }, 1);
    }).not.toThrow();
  });
});
