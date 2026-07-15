import { describe, expect, it } from "vitest";
import {
  createDefaultMarketPriceState,
  createDefaultPlayerMarketListings,
  getMarketServerScope,
  getMarketStockKey,
  normalizeMarketServerId,
  normalizeMarketStockState,
  normalizeMarketTradeState,
  normalizeMarketTransactions,
  normalizePlayerMarketListings
} from "../../page-assets/js/app/runtime/marketState.js";

describe("market state helpers", () => {
  it("normalizes server scope with stable fallback values", () => {
    expect(normalizeMarketServerId("")).toBe("preview-server");
    expect(getMarketServerScope({ registration: { serverId: "war-01", serverLabel: "War One" } })).toEqual({
      serverId: "war-01",
      serverLabel: "War One"
    });
  });

  it("creates default market state with stock and demo player listings", () => {
    const state = createDefaultMarketPriceState("free-01", 1_700_000_000_000);

    expect(state.serverId).toBe("free-01");
    expect(state.items[getMarketStockKey("market", "chemicals")].price).toBe(450);
    expect(state.items[getMarketStockKey("market", "stim-pack")].price).toBe(1000);
    expect(state.items[getMarketStockKey("black-market", "neon-dust")].price).toBe(1900);
    expect(state.items[getMarketStockKey("black-market", "bazooka")].price).toBe(25890);
    expect(state.stock[getMarketStockKey("market", "chemicals")]).toBe(700);
    expect(state.playerListings.length).toBeGreaterThan(0);
    expect(state.playerListings[0].id).toContain("demo-player-market:free-01:");
  });

  it("clamps market stock and normalizes partial trade state", () => {
    const stock = normalizeMarketStockState({
      [getMarketStockKey("market", "chemicals")]: 999999,
      [getMarketStockKey("market", "biomass")]: -50
    });
    const tradeState = normalizeMarketTradeState({
      serverId: "war-02",
      stock,
      transactions: [{ itemId: "chemicals", amount: 2, total: 100 }],
      playerListings: []
    });

    expect(stock[getMarketStockKey("market", "chemicals")]).toBe(1100);
    expect(stock[getMarketStockKey("market", "biomass")]).toBe(0);
    expect(tradeState.serverId).toBe("war-02");
    expect(tradeState.transactions[0].itemName).toBe("chemicals");
    expect(tradeState.playerListings).toEqual([]);
  });

  it("normalizes legacy listing aliases and transaction fallbacks", () => {
    const listings = normalizePlayerMarketListings([
      {
        resourceId: "metalParts",
        inventory: "materials",
        sellerId: "player:self",
        amount: 3,
        price: 11,
        expiresAt: 2_000
      }
    ], "free-01", 1_000);
    const transactions = normalizeMarketTransactions([{ itemId: "pistol", type: "sell" }], 1_000);

    expect(listings[0].itemId).toBe("metal-parts");
    expect(listings[0].isOwn).toBe(true);
    expect(transactions[0]).toMatchObject({
      id: "market-tx-1000-0",
      type: "sell",
      itemId: "pistol",
      amount: 1,
      moneyKey: "cleanMoney"
    });
  });

  it("creates deterministic default player listings per server", () => {
    const first = createDefaultPlayerMarketListings("free-01", 1_000);
    const second = createDefaultPlayerMarketListings("free-01", 1_000);

    expect(first).toEqual(second);
  });
});
