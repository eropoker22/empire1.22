import { describe, expect, it, vi } from "vitest";
import {
  createServerPlayerMarketCallbacks,
  createServerPlayerMarketPanelPayload
} from "../../page-assets/js/app/runtime/marketServerPlayerViewModel.js";
import { createMarketDataSourceSnapshot } from "../../page-assets/js/app/runtime/marketDataSource.js";

describe("server player market view model", () => {
  it("keeps the player bazaar authoritative when its server projection is present", () => {
    const serverMarket = { resources: [], playerMarket: { listings: [] } };
    const snapshot = createMarketDataSourceSnapshot({
      activeTab: "player-market",
      playerTabId: "player-market",
      serverMarket,
      localMarketState: { playerListings: [{ id: "local-preview" }] }
    });

    expect(snapshot.isAuthoritative).toBe(true);
    expect(snapshot.isPreview).toBe(false);
    expect(snapshot.serverMarket).toBe(serverMarket);
  });

  it("projects owned inventory and server escrow listings without local mutation", () => {
    const viewModel = createServerPlayerMarketPanelPayload({
      serverMarket: {
        resources: [{
          id: "chemicals",
          name: "Chemicals",
          category: "bulk",
          normalMarket: { price: 450 }
        }],
        playerMarket: {
          ownListingCount: 1,
          listingLimitPerSeller: 5,
          listings: [{
            id: "listing:1",
            resourceId: "chemicals",
            sellerPlayerId: "player:2",
            amount: 2,
            unitPrice: 500,
            totalPrice: 1000,
            paymentType: "cleanCash",
            createdAt: 100,
            expiresAt: 1000,
            isOwn: false,
            canBuy: true
          }]
        }
      },
      playerView: { resourceBalances: { chemicals: 4 } }
    });

    expect(viewModel).toMatchObject({
      isAuthoritative: true,
      isPreview: false,
      ownListingCount: 1,
      ownListingLimit: 5
    });
    expect(viewModel.sellableItems).toEqual([
      expect.objectContaining({ resourceId: "chemicals", amount: 4, suggestedUnitPrice: 450 })
    ]);
    expect(viewModel.listings).toEqual([
      expect.objectContaining({ id: "listing:1", total: 1000, disabled: false })
    ]);
  });

  it("submits create, buy and cancel intents through server commands", async () => {
    const submitServerMarketCommand = vi.fn().mockResolvedValue({ accepted: true });
    const refreshMarketTab = vi.fn();
    const callbacks = createServerPlayerMarketCallbacks({
      submitServerMarketCommand,
      refreshMarketTab,
      setMarketFeedback: vi.fn()
    });

    await callbacks.onCreateListing({
      item: { resourceId: "chemicals" },
      requestedAmount: 3,
      unitPrice: 600,
      currency: "dirtyMoney"
    });
    await callbacks.onBuyListing({ id: "listing:1" });
    await callbacks.onCancelListing({ id: "listing:2" });

    expect(submitServerMarketCommand.mock.calls.map(([payload]) => payload)).toEqual([
      {
        action: "create-listing",
        resourceId: "chemicals",
        amount: 3,
        unitPrice: 600,
        paymentType: "dirtyCash"
      },
      { action: "buy-listing", listingId: "listing:1" },
      { action: "cancel-listing", listingId: "listing:2" }
    ]);
    expect(refreshMarketTab).toHaveBeenCalledTimes(3);
  });
});
