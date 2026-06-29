import { describe, expect, it } from "vitest";
import { applyCommand, calculateMarketPrice } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createCoreStateFixture } from "../../fixtures/game-state-fixtures";
import type { BuyMarketResourceCommand, SellMarketResourceCommand } from "@empire/shared-types";

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
      metalParts: 10,
      techCore: 1,
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

describe("market command handler", () => {
  it("buys from normal market with server calculated price and stock mutation", () => {
    const state = createState();
    const unitPrice = calculateMarketPrice(state, "metalParts", "normal").finalPrice;
    const result = applyCommand(state, buyCommand({
      resourceId: "metalParts",
      amount: 2,
      marketType: "normal",
      paymentType: "cleanCash"
    }), context);

    expect(result.errors).toHaveLength(0);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(10000 - unitPrice * 2);
    expect(result.nextState.resourceStatesById["resource:1"].balances.metalParts).toBe(12);
    expect(result.nextState.market?.stock).toMatchObject({ metalParts: 898 });
    expect(result.events[0]).toMatchObject({
      type: "market-transaction-resolved",
      payload: {
        transactionType: "buy",
        resourceId: "metalParts",
        amount: 2,
        marketType: "normal",
        paymentType: "cleanCash",
        totalPrice: unitPrice * 2
      }
    });
  });

  it("sells resources into normal market and credits clean cash", () => {
    const state = createState();
    const unitPrice = Math.max(1, Math.floor(calculateMarketPrice(state, "metalParts", "normal").finalPrice * 0.72));
    const result = applyCommand(state, sellCommand({
      resourceId: "metalParts",
      amount: 3
    }), context);

    expect(result.errors).toHaveLength(0);
    expect(result.nextState.resourceStatesById["resource:1"].balances.metalParts).toBe(7);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(10000 + unitPrice * 3);
    expect(result.nextState.market?.stock).toMatchObject({ metalParts: 903 });
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
      resourceId: "techCore",
      amount: 1,
      marketType: "normal",
      paymentType: "cleanCash"
    }), context);

    expect(result.errors[0]?.code).toBe("market_not_enough_cash");
    expect(result.nextState).toBe(state);
    expect(state.resourceStatesById["resource:1"].balances.techCore).toBe(1);
    expect(state.market).toBeUndefined();
  });

  it("applies black market dirty cash payment and heat through server rules", () => {
    const state = createState();
    const result = applyCommand(state, buyCommand({
      resourceId: "chemicals",
      amount: 2,
      marketType: "black",
      paymentType: "dirtyCash"
    }), context);

    expect(result.errors).toHaveLength(0);
    expect(result.nextState.resourceStatesById["resource:1"].balances.chemicals).toBe(2);
    expect(result.nextState.resourceStatesById["resource:1"].balances["dirty-cash"]).toBeLessThan(10000);
    expect((result.nextState.playersById["player:1"] as any).heat).toBeGreaterThan(0);
  });
});

