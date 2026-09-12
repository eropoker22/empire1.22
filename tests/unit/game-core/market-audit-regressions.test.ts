import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { applyCommand } from "@empire/game-core";
import type { BuyMarketResourceCommand } from "@empire/shared-types";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";
import { buyResource, calculateMarketPrice, cancelPlayerMarketListing, createPlayerMarketListing, getBlackMarketRotation, getMarketViewModel, initializeServerMarket, marketConfig, tickMarket } from "../../../packages/game-core/src/rules/market";

const config = resolveModeConfig("free");
const simpleState = () => ({ playersById: {
  seller: { id: "seller", cleanCash: 1_000_000, dirtyCash: 1_000_000, resources: { chemicals: 100, "metal-parts": 100 } }
} });

describe("deep market audit regressions", () => {
  it("never reuses a removed listing ID or deletes another listing with the same timestamp", () => {
    const initial = simpleState();
    const first = createPlayerMarketListing(initial, initial.playersById.seller, "chemicals", 2, 100, "cleanCash", 1000);
    const second = createPlayerMarketListing(first.nextState!, first.nextState!.playersById.seller, "metal-parts", 3, 100, "cleanCash", 1000);
    const cancelled = cancelPlayerMarketListing(second.nextState!, second.nextState!.playersById.seller, first.listingId!, 1000);
    const third = createPlayerMarketListing(cancelled.nextState!, cancelled.nextState!.playersById.seller, "chemicals", 4, 100, "cleanCash", 1000);
    expect(new Set([first.listingId, second.listingId, third.listingId]).size).toBe(3);
    const stale = cancelPlayerMarketListing(third.nextState!, third.nextState!.playersById.seller, first.listingId!, 1000);
    expect(stale.success).toBe(false);
    const removed = cancelPlayerMarketListing(third.nextState!, third.nextState!.playersById.seller, second.listingId!, 1000);
    expect(removed.nextState!.market.playerListings.map((entry: { id: string }) => entry.id)).toEqual([third.listingId]);
    expect(removed.nextState!.playersById.seller.resources.chemicals).toBe(96);
    expect(removed.nextState!.playersById.seller.resources["metal-parts"]).toBe(100);
  });

  it("keeps all active escrow listings beyond the transaction history limit", () => {
    const state = initializeServerMarket(simpleState(), 1000);
    state.market.playerListings = Array.from({ length: marketConfig.transactionLogLimit + 10 }, (_, index) => ({
      id: `player-market:1000:seller:${index}`, sellerPlayerId: "seller", resourceId: "chemicals" as const,
      amount: 1, unitPrice: 100, paymentType: "cleanCash" as const, status: "active" as const, createdAt: 1000, expiresAt: 2000
    }));
    expect(initializeServerMarket(state, 1000).market.playerListings).toHaveLength(marketConfig.transactionLogLimit + 10);
    const expired = tickMarket(state, 2000);
    expect(expired.nextState.playersById.seller.resources.chemicals).toBe(100 + marketConfig.transactionLogLimit + 10);
    expect(tickMarket(expired.nextState, 3000).nextState.playersById.seller.resources.chemicals).toBe(100 + marketConfig.transactionLogLimit + 10);
  });

  it("keeps transaction IDs unique after the bounded history fills", () => {
    let state: any = simpleState();
    const ids: string[] = [];
    const resource = getBlackMarketRotation(state, 1000)[0];
    for (let index = 0; index < marketConfig.transactionLogLimit + 3; index++) {
      state.playersById.seller.cleanCash = 1_000_000;
      const bought = buyResource(state, state.playersById.seller, resource, 1, "black", "cleanCash", 1000);
      expect(bought.success).toBe(true);
      ids.push(bought.transactionId!);
      state = bought.nextState!;
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.market.transactions).toHaveLength(marketConfig.transactionLogLimit);
  });

  it("does not mutate authoritative state when merely projecting market data", () => {
    const state = simpleState();
    const before = structuredClone(state);
    getMarketViewModel(state, state.playersById.seller, 1000, { config });
    expect(state).toEqual(before);
  });

  it("uses the live configuration for both airport quotes and charged purchases", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("airport", { playerBalances: { cash: 100_000, "dirty-cash": 100_000, "tech-core": 0 } });
    const custom = structuredClone(config);
    state.policeStatesById["police:1"] = { id: "police:1", ownerPlayerId: "player:1", heat: 19, wantedLevel: 0, activeFlags: [], lastDecayTick: 0, version: 1 };
    custom.balance.airport!.blackCharter.purchaseCustomsRiskPct = 100;
    state.buildingsById[building.id].metadata = { airport: { blackCharterExpiresAtTick: 100 } };
    let now = 1000;
    while (!getBlackMarketRotation(state, now).includes("tech-core")) now += 60_000;
    const context = { config: custom, clock: { now: () => new Date(now), nowIso: () => new Date(now).toISOString() } };
    const expected = getMarketViewModel({ ...structuredClone(state), config: custom }, state.playersById["player:1"], now, context).resources.find((entry: any) => entry.id === "tech-core");
    const actual = getMarketViewModel(state, state.playersById["player:1"], now, context).resources.find((entry: any) => entry.id === "tech-core");
    expect(actual.blackMarket.price).toBe(expected.blackMarket.price);
    const command: BuyMarketResourceCommand = { id: "audit:airport", type: "buy-market-resource", mode: "free", serverInstanceId: state.serverInstance.id, playerId: "player:1", clientRequestId: null, issuedAt: new Date(now).toISOString(), payload: { resourceId: "tech-core", amount: 1, marketType: "black", paymentType: "cleanCash" } };
    const result = applyCommand(state, command, context);
    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(100_000 - expected.blackMarket.price);
    expect((result.events[0].payload as Record<string, number>).heatAdded).toBeGreaterThanOrEqual(custom.balance.airport!.expressImport.customsHeatGain);
    expect(result.nextState.policeStatesById["police:1"].wantedLevel).toBeGreaterThan(0);
    expect(result.nextState).not.toHaveProperty("config");
  });

  it("applies only the black-market share of stock-exchange pressure to black prices", () => {
    const baseline = initializeServerMarket(simpleState(), 1000);
    const pressured = { ...structuredClone(baseline), root: { tick: 0 }, buildingsById: { exchange: {
      id: "exchange", buildingTypeId: "stock_exchange", status: "active", ownerPlayerId: "seller",
      metadata: { stockExchange: { marketEffects: [{ category: "materials", expiresAtTick: 100, regularPriceModifierPct: 20, blackMarketPriceModifierPct: 10 }] } }
    } } };
    const normal = calculateMarketPrice(baseline, "metal-parts", "normal").finalPrice;
    const black = calculateMarketPrice(baseline, "metal-parts", "black").finalPrice;
    expect(calculateMarketPrice(pressured, "metal-parts", "normal").finalPrice).toBeCloseTo(normal * 1.2, -1);
    expect(calculateMarketPrice(pressured, "metal-parts", "black").finalPrice).toBeCloseTo(black * 1.1, -1);
  });

  it("counts a canonical police heat value once even when legacy mirrors exist", () => {
    const { state } = createCoreStateWithFixedBuildingFixture("pharmacy");
    const canonical: any = state;
    canonical.policeStatesById["police:1"] = { id: "police:1", heat: 80 };
    const mirrored = structuredClone(canonical);
    mirrored.playersById["player:1"].heat = 80;
    mirrored.playersById["player:1"].gang = { heat: 80 };
    mirrored.playersById["player:1"].police = { heat: 80 };
    expect(calculateMarketPrice(mirrored, "metal-parts", "black")).toEqual(calculateMarketPrice(canonical, "metal-parts", "black"));
  });

  it("regenerates stock from a valid zero timestamp", () => {
    const state = initializeServerMarket(simpleState(), 0);
    state.market.stock.chemicals = 0;
    const regenerated = tickMarket(state, 60 * 60 * 1000);
    expect(regenerated.nextState.market.stock.chemicals).toBeGreaterThan(0);
    expect(regenerated.snapshots).toBeGreaterThan(0);
  });

  it("lets old violence expire from prices and counts mirrored event records once", () => {
    const now = 2 * 60 * 60 * 1000;
    const baseline = { ...simpleState(), root: { tick: now / 1000 }, tickRateMs: 1000 };
    const old = { ...structuredClone(baseline), eventsById: { attack: { id: "attack", eventTypeId: "attack", startTick: 0 } } };
    const recentEvent = { id: "attack", eventTypeId: "attack", startTick: now / 1000 };
    const recent = { ...structuredClone(baseline), eventsById: { attack: recentEvent } };
    const mirrored = { ...structuredClone(recent), eventLog: [{ id: "attack", type: "attack", createdAt: now }] };
    const price = (state: object) => calculateMarketPrice(state, "metal-parts", "normal").finalPrice;
    expect(price(old)).toBe(price(baseline));
    expect(price(recent)).toBeGreaterThan(price(baseline));
    expect(price(mirrored)).toBe(price(recent));
  });
});
