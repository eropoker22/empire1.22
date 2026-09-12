import { describe, expect, it } from "vitest";
import { applyCommand } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { MarketCommand } from "@empire/shared-types";
import { createCoreStateFixture, createPlayerFixture, createResourceStateFixture } from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };
const command = (type: MarketCommand["type"], playerId: string, payload: MarketCommand["payload"]): MarketCommand => ({
  id: `audit:${type}`, type, playerId, payload, mode: "free", serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(), clientRequestId: null
} as MarketCommand);

const setup = (buyerStock: number) => {
  const state = createCoreStateFixture();
  state.resourceStatesById["resource:1"].balances = { cash: 1000, chemicals: 10 };
  const buyer = createPlayerFixture({ id: "player:2", accountId: "account:2", resourceStateId: "resource:2" });
  state.playersById[buyer.id] = buyer;
  state.root.playerIds.push(buyer.id);
  state.resourceStatesById[buyer.resourceStateId] = createResourceStateFixture({
    id: buyer.resourceStateId, ownerType: "player", ownerId: buyer.id, balances: { cash: 1000, chemicals: buyerStock }
  });
  const created = applyCommand(state, command("create-player-market-listing", "player:1", {
    resourceId: "chemicals", amount: 2, unitPrice: 100, paymentType: "cleanCash"
  }), context);
  expect(created.errors).toEqual([]);
  const listingId = (created.nextState.market as { playerListings: Array<{ id: string }> }).playerListings[0].id;
  return { state: created.nextState, listingId };
};

describe("bazaar ID normalization audit", () => {
  it.each([false, true])("rejects an over-capacity purchase without changing escrow or wallets (padded ID: %s)", padded => {
    const { state, listingId } = setup(59);
    const before = structuredClone(state);
    const result = applyCommand(state, command("buy-player-market-listing", "player:2", {
      listingId: padded ? ` \t${listingId}\n ` : listingId
    }), context);
    expect(result.errors[0]?.code).toBe("storage_capacity_exceeded");
    expect(result.nextState).toBe(state);
    expect(state).toEqual(before);
  });

  it("delivers a padded-ID purchase and notifies the seller once with the canonical ID", () => {
    const { state, listingId } = setup(58);
    const buy = command("buy-player-market-listing", "player:2", { listingId: ` ${listingId} ` });
    const result = applyCommand(state, buy, context);
    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:2"].balances).toMatchObject({ chemicals: 60, cash: 800 });
    expect(result.nextState.resourceStatesById["resource:1"].balances).toMatchObject({ chemicals: 8, cash: 1200 });
    expect(result.nextState.notificationsById[`market-sale:${listingId}`]).toMatchObject({
      recipientId: "player:1", payload: { listingId, creditedAmount: 200 }
    });
    const repeated = applyCommand(result.nextState, { ...buy, id: "audit:repeat" }, context);
    expect(repeated.errors).not.toEqual([]);
    expect(repeated.nextState).toEqual(result.nextState);
  });

  it("cancels a padded-ID listing and refunds the seller exactly once", () => {
    const { state, listingId } = setup(0);
    const cancel = command("cancel-player-market-listing", "player:1", { listingId: ` ${listingId} ` });
    const result = applyCommand(state, cancel, context);
    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances.chemicals).toBe(10);
    const repeated = applyCommand(result.nextState, { ...cancel, id: "audit:repeat" }, context);
    expect(repeated.errors).not.toEqual([]);
    expect(repeated.nextState).toEqual(result.nextState);
  });
});
