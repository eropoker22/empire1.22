import { describe, expect, it } from "vitest";
import {
  createMarketCatalogPanelPayload,
  createPlayerMarketPanelPayload,
  createSellablePlayerMarketItems
} from "../../page-assets/js/app/runtime/marketPopupViewModel.js";

const formatPrice = (value) => `${Math.max(0, Math.floor(Number(value) || 0))}$`;

describe("market popup view model adapters", () => {
  it("builds sellable player market items from catalog and inventory callbacks", () => {
    expect(createSellablePlayerMarketItems([
      { inventory: "materials", itemId: "chemicals", name: "Chemicals" },
      { inventory: "drugs", itemId: "neon-dust", name: "Neon Dust" }
    ], {
      getInventoryAmount: (inventory, itemId) => inventory === "materials" && itemId === "chemicals" ? 3 : 0
    })).toEqual([
      { inventory: "materials", itemId: "chemicals", name: "Chemicals", amount: 3 }
    ]);
  });

  it("builds player market panel payload with own listing and money fallbacks", () => {
    const payload = createPlayerMarketPanelPayload({
      priceState: {
        playerListings: [
          { id: "own", sellerId: "player:self", currency: "cleanMoney", createdAt: 2, amount: 1, unitPrice: 100 },
          { id: "peer", sellerId: "seller:a", currency: "dirtyMoney", createdAt: 1, amount: 2, unitPrice: 80 }
        ]
      },
      serverScope: { serverId: "server-a" },
      catalog: [{ inventory: "materials", itemId: "chemicals", name: "Chemicals" }],
      economy: { cleanMoney: 50, dirtyMoney: 200 },
      sellerId: "player:self",
      ownListingLimit: 4,
      normalizeMarketTradeState: (state) => state,
      normalizePlayerMarketListings: (listings) => listings,
      getInventoryAmount: () => 2,
      formatPrice
    });

    expect(payload.sellableItems).toEqual([
      { inventory: "materials", itemId: "chemicals", name: "Chemicals", amount: 2 }
    ]);
    expect(payload.viewModel.ownListingCount).toBe(1);
    expect(payload.viewModel.listings.map((listing) => listing.id)).toEqual(["own", "peer"]);
    expect(payload.viewModel.listings[0].title).toBe("Stáhnout nabídku a vrátit položku do skladu.");
    expect(payload.viewModel.listings[1].disabled).toBe(false);
  });

  it("builds catalog item payload with stock and price labels", () => {
    const payload = createMarketCatalogPanelPayload({
      tabConfig: {
        items: [{ inventory: "materials", itemId: "chemicals", name: "Chemicals", price: 100 }],
        buyMultiplier: 1.15,
        sellMultiplier: 0.9
      },
      activeTab: "market",
      paymentKey: "cleanMoney",
      payoutKey: "cleanMoney",
      priceState: {
        items: {
          "market:chemicals": { price: 120, previousPrice: 100 }
        }
      },
      marketDiscount: { discountPct: 0, feeReductionPct: 0 },
      getInventoryAmount: () => 4,
      getStockAmount: () => 10,
      getMaxStock: () => 20,
      getStockLabel: () => "Stock 10/20 ks",
      getStockPercent: () => 50,
      applyDiscountToPrice: (value) => value,
      formatPrice,
      getMoneyLabel: () => "clean cash"
    });

    expect(payload.items[0]).toMatchObject({
      itemId: "chemicals",
      amount: 4,
      buyPrice: 138,
      sellPrice: 108,
      stockLabel: "Stock 10/20 ks",
      stockPercent: 50
    });
  });

  it("handles partial payloads without crashing", () => {
    expect(createSellablePlayerMarketItems(null)).toEqual([]);
    expect(createPlayerMarketPanelPayload().viewModel.listings).toEqual([]);
    expect(createMarketCatalogPanelPayload({ tabConfig: null }).items).toEqual([]);
  });
});
