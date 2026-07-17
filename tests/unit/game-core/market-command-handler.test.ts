import { describe, expect, it } from "vitest";
import { applyCommand, calculateMarketPrice, tickMarket } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createCoreStateFixture } from "../../fixtures/game-state-fixtures";
import type {
  BuyMarketResourceCommand,
  CancelPlayerMarketListingCommand,
  CreatePlayerMarketListingCommand,
  SellMarketResourceCommand
} from "@empire/shared-types";

const context = {
  config: resolveModeConfig("free")
};

const createState = () => {
  const state = createCoreStateFixture();
  state.resourceStatesById["resource:1"] = {
    ...state.resourceStatesById["resource:1"],
    balances: {
      cash: 10000,
      "dirty-cash": 10000,
      "metal-parts": 10,
      "tech-core": 1,
      chemicals: 0,
      biomass: 0
    }
  };
  return state;
};

const buyCommand = (payload: BuyMarketResourceCommand["payload"], id = "command:market-buy:1"): BuyMarketResourceCommand => ({
  id,
  type: "buy-market-resource",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload,
  clientRequestId: null
});

const sellCommand = (payload: SellMarketResourceCommand["payload"], id = "command:market-sell:1"): SellMarketResourceCommand => ({
  id,
  type: "sell-market-resource",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload,
  clientRequestId: null
});

const createListingCommand = (
  payload: CreatePlayerMarketListingCommand["payload"],
  id = "command:market-listing-create:1"
): CreatePlayerMarketListingCommand => ({
  id,
  type: "create-player-market-listing",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload,
  clientRequestId: null
});

const cancelListingCommand = (
  payload: CancelPlayerMarketListingCommand["payload"],
  id = "command:market-listing-cancel:1"
): CancelPlayerMarketListingCommand => ({
  id,
  type: "cancel-player-market-listing",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  payload,
  clientRequestId: null
});

describe("market command handler", () => {
  it("buys from normal market with server calculated price and stock mutation", () => {
    const state = createState();
    const initialStock = Number(tickMarket(state, 0).nextState.market?.stock["metal-parts"] ?? 0);
    const unitPrice = calculateMarketPrice(state, "metal-parts", "normal").finalPrice;
    const result = applyCommand(state, buyCommand({
      resourceId: "metal-parts",
      amount: 2,
      marketType: "normal",
      paymentType: "cleanCash"
    }), context);

    expect(result.errors).toHaveLength(0);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(10000 - unitPrice * 2);
    expect(result.nextState.resourceStatesById["resource:1"].balances["metal-parts"]).toBe(12);
    expect(result.nextState.resourceStatesById["resource:1"].balances.metalParts).toBeUndefined();
    expect(result.nextState.market?.stock).toMatchObject({ "metal-parts": initialStock - 2 });
    expect(result.events[0]).toMatchObject({
      type: "market-transaction-resolved",
      payload: {
        transactionType: "buy-market-resource",
        resourceId: "metal-parts",
        amount: 2,
        marketType: "normal",
        paymentType: "cleanCash",
        totalPrice: unitPrice * 2
      }
    });
  });

  it("sells resources into normal market and credits clean cash", () => {
    const state = createState();
    const initialStock = Number(tickMarket(state, 0).nextState.market?.stock["metal-parts"] ?? 0);
    const unitPrice = Math.max(1, Math.floor(calculateMarketPrice(state, "metal-parts", "normal").finalPrice * 0.65));
    const result = applyCommand(state, sellCommand({
      resourceId: "metal-parts",
      amount: 3
    }), context);

    expect(result.errors).toHaveLength(0);
    expect(result.nextState.resourceStatesById["resource:1"].balances["metal-parts"]).toBe(7);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(10000 + unitPrice * 3);
    expect(result.nextState.market?.stock).toMatchObject({ "metal-parts": initialStock + 3 });
  });

  it("rejects failed buys without mutating cash, inventory or stock", () => {
    const state = createState();
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: {
        ...state.resourceStatesById["resource:1"].balances,
        cash: 0
      }
    };
    const result = applyCommand(state, buyCommand({
      resourceId: "stim-pack",
      amount: 1,
      marketType: "normal",
      paymentType: "cleanCash"
    }), context);

    expect(result.errors[0]?.code).toBe("market_not_enough_cash");
    expect(result.nextState).toBe(state);
    expect(state.resourceStatesById["resource:1"].balances["tech-core"]).toBe(1);
    expect(state.market).toBeUndefined();
  });

  it("applies black market dirty cash payment and heat through server rules", () => {
    const state = createState();
    const result = applyCommand(state, buyCommand({
      resourceId: "neon-dust",
      amount: 1,
      marketType: "black",
      paymentType: "dirtyCash"
    }), context);

    expect(result.errors).toHaveLength(0);
    expect(result.nextState.resourceStatesById["resource:1"].balances["neon-dust"]).toBe(1);
    expect(result.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeLessThan(10000);
    expect((result.nextState.playersById["player:1"] as any).heat).toBeGreaterThan(0);
  });

  it("rejects a buy at capacity before cash or market stock change", () => {
    const state = createState();
    state.resourceStatesById["resource:1"] = {
      ...state.resourceStatesById["resource:1"],
      balances: { ...state.resourceStatesById["resource:1"].balances, chemicals: 60 }
    };
    const result = applyCommand(state, buyCommand({
      resourceId: "chemicals",
      amount: 1,
      marketType: "normal",
      paymentType: "cleanCash"
    }), context);

    expect(result.errors[0]?.code).toBe("storage_capacity_full");
    expect(result.nextState).toBe(state);
    expect(state.resourceStatesById["resource:1"].balances.cash).toBe(10000);
    expect(state.market).toBeUndefined();
  });

  it("routes player bazaar escrow and restorative cancellation through canonical commands", () => {
    const state = createState();
    const created = applyCommand(state, createListingCommand({
      resourceId: "metal-parts",
      amount: 4,
      unitPrice: 500,
      paymentType: "cleanCash"
    }), context);

    expect(created.errors).toHaveLength(0);
    expect(created.nextState.resourceStatesById["resource:1"].balances["metal-parts"]).toBe(6);
    const listingId = (created.nextState.market as { playerListings?: Array<{ id: string }> } | undefined)
      ?.playerListings?.[0]?.id;
    expect(listingId).toBeTruthy();

    const cancelled = applyCommand(created.nextState, cancelListingCommand({ listingId: listingId! }), context);

    expect(cancelled.errors).toHaveLength(0);
    expect(cancelled.nextState.resourceStatesById["resource:1"].balances["metal-parts"]).toBe(10);
    expect(cancelled.nextState.market?.playerListings).toHaveLength(0);
  });
});

