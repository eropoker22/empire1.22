import { describe, expect, it } from "vitest";
import { validateSubmitGameplayCommandRequest } from "../../apps/server/src/transport/gameplay-slice-request-validation";

const createSubmitRequest = (type: string, payload: Record<string, unknown>) => ({
  focusDistrictId: "district:1",
  expectedStateVersion: 1,
  command: {
    id: `command:${type}:1`,
    type,
    mode: "free",
    playerId: "player:1",
    serverInstanceId: "instance:1",
    issuedAt: new Date(0).toISOString(),
    payload,
    clientRequestId: null
  }
});

describe("market command transport payload validation", () => {
  it("accepts valid normal and black market buys plus normal sells", () => {
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("buy-market-resource", {
      resourceId: "metalParts",
      amount: 5,
      marketType: "normal",
      paymentType: "cleanCash"
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("buy-market-resource", {
      resourceId: "techCore",
      amount: 1,
      marketType: "black",
      paymentType: "cleanCash"
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("buy-market-resource", {
      resourceId: "chemicals",
      amount: 1,
      marketType: "black",
      paymentType: "dirtyCash"
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("sell-market-resource", {
      resourceId: "biomass",
      amount: 3
    })).accepted).toBe(true);
  });

  it("rejects dirty cash on normal market and invalid amounts/resources", () => {
    const dirtyNormal = validateSubmitGameplayCommandRequest(createSubmitRequest("buy-market-resource", {
      resourceId: "metalParts",
      amount: 1,
      marketType: "normal",
      paymentType: "dirtyCash"
    }));
    const floatAmount = validateSubmitGameplayCommandRequest(createSubmitRequest("buy-market-resource", {
      resourceId: "metalParts",
      amount: 1.5,
      marketType: "normal",
      paymentType: "cleanCash"
    }));
    const unknownResource = validateSubmitGameplayCommandRequest(createSubmitRequest("sell-market-resource", {
      resourceId: "stim-pack",
      amount: 1
    }));

    expect(dirtyNormal.accepted).toBe(false);
    expect(floatAmount.accepted).toBe(false);
    expect(unknownResource.accepted).toBe(false);
  });

  it("rejects client supplied market prices, rewards and stock mutation fields", () => {
    const result = validateSubmitGameplayCommandRequest(createSubmitRequest("buy-market-resource", {
      resourceId: "metalParts",
      amount: 1,
      marketType: "normal",
      paymentType: "cleanCash",
      price: 1,
      totalPrice: 1,
      reward: { metalParts: 999 },
      stock: { metalParts: 9999 }
    }));

    expect(result.accepted).toBe(false);
    expect(result.errors.map((error) => error.details?.field)).toEqual([
      "command.payload.price",
      "command.payload.totalPrice",
      "command.payload.reward",
      "command.payload.stock"
    ]);
  });
});

