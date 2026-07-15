import { describe, expect, it } from "vitest";
import {
  createMarketCopy,
  createMarketDashboardViewModel,
  createMarketItemViewModels,
  createMarketTradeStateViewModel,
  createPlayerMarketViewModel,
  getSuggestedPlayerMarketUnitPrice
} from "../../page-assets/js/app/runtime/marketViewModel.js";

const formatPrice = (value) => `${Math.max(0, Math.floor(Number(value) || 0))}$`;

describe("market view model builders", () => {
  it("builds dashboard chips and scoped copy labels", () => {
    const dashboard = createMarketDashboardViewModel({
      activeTab: "black-market",
      tabLabel: "Black market",
      stockSummary: "neomezeně",
      economy: { cleanMoney: 1200, dirtyMoney: 450 },
      gangState: { heat: 7 },
      refreshCountdownSeconds: 42,
      recentTransactions: [
        { type: "buy", itemName: "Chemicals", amount: 1, total: 100 },
        { type: "sell", itemName: "Biomass", amount: 2, total: 50 },
        { type: "buy", itemName: "Pistol", amount: 1, total: 300 },
        { type: "sell", itemName: "Tech", amount: 1, total: 10 }
      ],
      formatPrice
    });

    expect(dashboard.chips).toEqual([
      { label: "Black market", value: "policie blízko", tone: "danger" },
      { label: "Čisté", value: "1200$", tone: "clean" },
      { label: "Špinavé", value: "450$", tone: "dirty" },
      { label: "Heat", value: "7", tone: "danger" },
      { label: "Obnova", value: "42 s", tone: "timer" },
      { label: "Zásoba", value: "neomezeně", tone: "danger" }
    ]);
    expect(dashboard.recentTransactions).toHaveLength(1);
    expect(dashboard.allRecentTransactions).toHaveLength(4);
    expect(createMarketCopy("market", { copy: "Normal." })).toBe("Normal. Nákup snižuje zásobu trhu, prodej ji vrací a ceny se průběžně obnovují.");
    expect(createMarketCopy("player-market", { copy: "Bazar." })).toContain("Nabídku můžeš bezpečně stáhnout");
  });

  it("builds normal market item labels without changing price math", () => {
    const items = createMarketItemViewModels({
      items: [{ inventory: "materials", itemId: "chemicals", name: "Chemicals", price: 100 }],
      activeTab: "market",
      paymentKey: "cleanMoney",
      payoutKey: "cleanMoney",
      buyMultiplier: 1.15,
      sellMultiplier: 0.9,
      priceState: {
        items: {
          "market:chemicals": { price: 120, previousPrice: 100 }
        }
      },
      marketDiscount: { discountPct: 10, feeReductionPct: 15 },
      getInventoryAmount: () => 2,
      getStockAmount: () => 10,
      getMaxStock: () => 20,
      getStockLabel: () => "Stock 10/20 ks",
      getStockPercent: () => 50,
      applyDiscountToPrice: (basePrice) => Math.round(basePrice * 0.9),
      formatPrice,
      getMoneyLabel: () => "clean cash"
    });

    expect(items[0]).toMatchObject({
      amount: 2,
      buyPrice: 124,
      sellPrice: 108,
      rowMode: "normal",
      metaLabel: "Máš 2 ks · Stock 10/20 ks · platba clean cash",
      priceLabel: "Základ 138$ · sleva OC -10.0 % · nákup 124$ · fee -15 % · výkup 108$",
      trendDirection: "up",
      trendLabel: "▲ +20$",
      stockPercent: 50,
      stockLabel: "Stock 10/20 ks"
    });
  });

  it("builds player listing view models with enough and missing money states", () => {
    const viewModel = createPlayerMarketViewModel({
      listings: [
        { id: "old", sellerId: "seller:a", currency: "cleanMoney", createdAt: 1, amount: 1, unitPrice: 500 },
        { id: "own", sellerId: "player:self", currency: "cleanMoney", createdAt: 2, amount: 1, unitPrice: 100 },
        { id: "new", sellerId: "seller:b", currency: "dirtyMoney", createdAt: 3, amount: 2, unitPrice: 80 }
      ],
      sellableItems: [{ itemId: "chemicals", amount: 2 }],
      economy: { cleanMoney: 200, dirtyMoney: 50 },
      sellerId: "player:self",
      ownListingLimit: 4,
      getListingTotal: (listing) => listing.amount * listing.unitPrice,
      formatPrice
    });

    expect(viewModel.ownListingCount).toBe(1);
    expect(viewModel.ownListingLimit).toBe(4);
    expect(viewModel.listings.map((listing) => listing.id)).toEqual(["own", "new", "old"]);
    expect(viewModel.listings[0]).toMatchObject({
      id: "own",
      isOwn: true,
      disabled: true,
      title: "Stáhnout nabídku a vrátit položku do skladu."
    });
    expect(viewModel.listings[1].title).toBe("Chybí 110$.");
  });

  it("builds trade state titles for stock, money, and black-market heat risk", () => {
    expect(createMarketTradeStateViewModel({
      item: { buyPrice: 120, sellPrice: 90, paymentKey: "cleanMoney" },
      requestedQuantity: 2,
      currentEconomy: { cleanMoney: 100 },
      currentAmount: 4,
      latestStock: 10,
      latestMaxStock: 20,
      formatPrice
    })).toMatchObject({
      buyDisabled: true,
      sellDisabled: false,
      buyTitle: "Chybí 140$.",
      sellTitle: "Prodat do trhu.",
      totalLabel: "Celkem 240$ · prodej 180$"
    });

    expect(createMarketTradeStateViewModel({
      activeTab: "black-market",
      item: { buyPrice: 400, sellPrice: 100, paymentKey: "dirtyMoney" },
      requestedQuantity: 2,
      currentEconomy: { dirtyMoney: 1000 },
      currentAmount: 3,
      blackHeatRisk: { heat: 3, label: "střední" },
      formatPrice
    })).toMatchObject({
      buyDisabled: false,
      buyTitle: "Rizikový obchod: +3 heat (střední).",
      totalLabel: "Celkem 800$ · likvidace 200$ · tvrdá ztráta · +3 heat"
    });
  });

  it("suggests player market unit prices from scoped price state", () => {
    expect(getSuggestedPlayerMarketUnitPrice(
      { inventory: "materials", itemId: "chemicals", price: 100 },
      { items: { "market:chemicals": { price: 120 } } }
    )).toBe(122);
    expect(getSuggestedPlayerMarketUnitPrice(
      { inventory: "drugs", itemId: "neon-dust", price: 200 },
      { items: { "black-market:neon-dust": { price: 300 } } }
    )).toBe(276);
  });
});
