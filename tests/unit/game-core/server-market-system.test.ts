import { describe, expect, it } from "vitest";
import {
  applyMarketEvent,
  buyPlayerMarketListing,
  buyResource,
  calculateMarketPrice,
  cancelPlayerMarketListing,
  createPlayerMarketListing,
  getInflationFactor,
  getMarketViewModel,
  getResourceTrend,
  getServerTotalMoney,
  initializeServerMarket,
  marketConfig,
  sellResource,
  tickMarket
} from "../../../packages/game-core/src/rules/market";

const createMarketStateFixture = () => ({
  mode: "free",
  playersById: {
    "player:1": {
      id: "player:1",
      cleanCash: 10000,
      dirtyCash: 10000,
      resources: {
        "metal-parts": 20,
        "tech-core": 5,
        "stim-pack": 0,
        chemicals: 30,
        biomass: 40
      },
      heat: 0,
      policeSuspicion: 0
    },
    "player:2": {
      id: "player:2",
      cleanCash: 2500,
      dirtyCash: 1500,
      resources: {}
    }
  },
  eventLog: [] as Array<Record<string, unknown>>,
  rumors: [] as Array<Record<string, unknown>>
});

describe("server market system", () => {
  it("initializes per-server market stock with config baselines", () => {
    const state = initializeServerMarket(createMarketStateFixture(), 1000);

    expect(marketConfig.id).toBe("server_market");
    expect(state.market.mode).toBe("free");
    expect(state.market.stock["metal-parts"]).toBe(900);
    expect(state.market.stock["tech-core"]).toBe(0);
  });

  it("normal market has limited stock and buying lowers stock", () => {
    const state = initializeServerMarket(createMarketStateFixture(), 1000);
    state.market.stock["stim-pack"] = 2;

    const tooMuch = buyResource(state, state.playersById["player:1"], "stim-pack", 3, "normal", "cleanCash", 1000);
    expect(tooMuch.success).toBe(false);
    expect(tooMuch.reason).toBe("NOT_ENOUGH_STOCK");

    const bought = buyResource(state, state.playersById["player:1"], "stim-pack", 2, "normal", "cleanCash", 1000);
    expect(bought.success).toBe(true);
    expect(bought.nextState?.market.stock["stim-pack"]).toBe(0);
    expect(bought.playerState?.resources["stim-pack"]).toBe(2);
  });

  it("applies owned shopping mall discounts to normal and black market buys", () => {
    const state = initializeServerMarket(createMarketStateFixture(), 1000);
    (state as any).buildingsById = Object.fromEntries(Array.from({ length: 3 }, (_value, index) => [
      `building:shopping-mall:${index + 1}`,
      {
        id: `building:shopping-mall:${index + 1}`,
        buildingTypeId: "shopping_mall",
        ownerPlayerId: "player:1",
        status: "active"
      }
    ]));
    const baseNormalPrice = calculateMarketPrice(state, "metal-parts", "normal").finalPrice;
    const baseBlackPrice = calculateMarketPrice(state, "neon-dust", "black").finalPrice;

    const normalBuy = buyResource(state, state.playersById["player:1"], "metal-parts", 1, "normal", "cleanCash", 1000);
    const blackBuy = buyResource(state, state.playersById["player:1"], "neon-dust", 1, "black", "cleanCash", 1000);
    const view = getMarketViewModel(state, state.playersById["player:1"], 1000);

    expect(normalBuy.success).toBe(true);
    expect(normalBuy.baseUnitPrice).toBe(baseNormalPrice);
    expect(normalBuy.shoppingMallDiscountPct).toBe(6);
    expect(normalBuy.unitPrice).toBe(Math.ceil(baseNormalPrice * 0.94));
    expect(normalBuy.marketFeeReductionPct).toBe(15);
    expect(blackBuy.shoppingMallDiscountPct).toBeCloseTo(2.4);
    expect(blackBuy.unitPrice).toBe(Math.ceil(baseBlackPrice * 0.976));
    expect(view.resources.find((resource: any) => resource.id === "metal-parts")?.normalMarket).toMatchObject({
      basePrice: baseNormalPrice,
      shoppingMallDiscountPct: 6,
      marketFeeReductionPct: 15
    });
  });

  it("black market is available without normal stock and is more expensive", () => {
    const state = initializeServerMarket(createMarketStateFixture(), 1000);
    state.market.stock["tech-core"] = 0;
    state.playersById["player:1"].cleanCash = 500000;

    const normalPrice = calculateMarketPrice(state, "tech-core", "normal").finalPrice;
    const blackPrice = calculateMarketPrice(state, "tech-core", "black").finalPrice;
    const bought = buyResource(state, state.playersById["player:1"], "tech-core", 8, "black", "cleanCash", 1_800_000);

    expect(blackPrice).toBeGreaterThan(normalPrice);
    expect(bought.success).toBe(true);
    expect(bought.nextState?.market.stock["tech-core"]).toBe(0);
    expect(bought.heatAdded).toBeGreaterThan(0);
    expect(bought.policeSuspicionAdded).toBeGreaterThan(0);
  });

  it("keeps official market floors above special-building production costs", () => {
    const productionFloors = {
      chemicals: 360,
      biomass: 420,
      "metal-parts": 300,
      "stim-pack": 800
    } as const;
    const maxNormalDiscountFactor = 1 - marketConfig.shoppingMallBonus.maxDiscountPct / 100;

    for (const [resourceId, productionCost] of Object.entries(productionFloors)) {
      const resource = marketConfig.resources[resourceId as keyof typeof productionFloors];
      const discountedFloor = Math.ceil(resource.basePrice * resource.minPriceMultiplier * maxNormalDiscountFactor);

      expect(discountedFloor).toBeGreaterThanOrEqual(productionCost);
    }
  });

  it("dirty cash can only be used on black market and uses worse rate", () => {
    const state = initializeServerMarket(createMarketStateFixture(), 1000);
    const normalDirty = buyResource(state, state.playersById["player:1"], "chemicals", 1, "normal", "dirtyCash");
    expect(normalDirty.success).toBe(false);
    expect(normalDirty.reason).toBe("DIRTY_CASH_NOT_ALLOWED");

    const clean = buyResource(state, state.playersById["player:1"], "neon-dust", 1, "black", "cleanCash", 1000);
    const dirty = buyResource(state, state.playersById["player:1"], "neon-dust", 1, "black", "dirtyCash", 1000);
    expect(dirty.success).toBe(true);
    expect(dirty.totalPrice).toBe(Math.ceil((clean.unitPrice ?? 0) * marketConfig.blackMarket.dirtyCashPaymentMultiplier));
  });

  it("selling resource increases normal stock and pays clean cash", () => {
    const state = initializeServerMarket(createMarketStateFixture(), 1000);
    const beforeStock = state.market.stock["metal-parts"];
    const beforeCash = state.playersById["player:1"].cleanCash;

    const sold = sellResource(state, state.playersById["player:1"], "metal-parts", 5, 1000);

    expect(sold.success).toBe(true);
    expect(sold.nextState?.market.stock["metal-parts"]).toBe(beforeStock + 5);
    expect(sold.playerState?.resources["metal-parts"]).toBe(15);
    expect(sold.playerState?.cleanCash).toBeGreaterThan(beforeCash);
  });

  it("rejects buys without money and sells without resource", () => {
    const state = createMarketStateFixture();
    state.playersById["player:1"].cleanCash = 0;
    state.playersById["player:1"].resources.biomass = 0;

    const buy = buyResource(state, state.playersById["player:1"], "biomass", 10, "normal", "cleanCash");
    const sell = sellResource(state, state.playersById["player:1"], "biomass", 1);

    expect(buy.success).toBe(false);
    expect(buy.reason).toBe("NOT_ENOUGH_CASH");
    expect(sell.success).toBe(false);
    expect(sell.reason).toBe("NOT_ENOUGH_RESOURCE");
  });

  it("raises price with low stock, high demand, high inflation and chaos", () => {
    const calm = initializeServerMarket(createMarketStateFixture(), 1000);
    const stressed = initializeServerMarket(createMarketStateFixture(), 1000);
    stressed.market.stock["tech-core"] = 5;
    stressed.market.rollingVolume["tech-core"].buy = 400;
    stressed.playersById["player:1"].cleanCash = 200000;
    stressed.playersById["player:2"].dirtyCash = 120000;
    stressed.playersById["player:1"].heat = 220;
    stressed.eventLog.push({ type: "district_heist", createdAt: Date.now() });
    stressed.eventLog.push({ type: "district-attacked", createdAt: Date.now() });

    const calmPrice = calculateMarketPrice(calm, "tech-core", "normal").finalPrice;
    const stressedPrice = calculateMarketPrice(stressed, "tech-core", "normal").finalPrice;

    expect(stressedPrice).toBeGreaterThan(calmPrice);
    expect(getInflationFactor(stressed)).toBeGreaterThan(getInflationFactor(calm));
    expect(Number.isNaN(stressedPrice)).toBe(false);
    expect(stressedPrice).toBeGreaterThan(0);
  });

  it("large black market transaction can trigger police exposure and rumor", () => {
    const state = initializeServerMarket(createMarketStateFixture(), 1000);
    (state as typeof state & { marketAuditRoll?: number }).marketAuditRoll = 0;
    state.playersById["player:1"].dirtyCash = 2_000_000;

    const result = buyResource(state, state.playersById["player:1"], "tech-core", 1, "black", "dirtyCash", 1_800_000);

    expect(result.success).toBe(true);
    expect(result.auditTriggered).toBe(true);
    expect(result.playerState?.policeSuspicion).toBeGreaterThan(0);
    expect(result.nextState?.eventLog.some((entry: Record<string, unknown>) => entry.type === "police")).toBe(true);
    expect(result.nextState?.rumors.length).toBeGreaterThan(0);
  });

  it("stock regen respects max stock and price history snapshots are saved", () => {
    const state = initializeServerMarket(createMarketStateFixture(), 1000);
    state.market.stock["metal-parts"] = marketConfig.resources["metal-parts"].normalMarketMaxStock - 5;
    state.market.lastStockRegenAt = 1;
    state.market.lastPriceSnapshotAt = 1;

    const ticked = tickMarket(state, 600001);

    expect(ticked.nextState.market.stock["metal-parts"]).toBe(marketConfig.resources["metal-parts"].normalMarketMaxStock);
    expect(ticked.snapshots).toBe(21);
    expect(ticked.nextState.market.priceHistory["metal-parts"].length).toBe(1);
  });

  it("market events affect price and expire on tick", () => {
    const state = initializeServerMarket(createMarketStateFixture(), 1000);
    const before = calculateMarketPrice(state, "chemicals", "normal").finalPrice;
    const eventResult = applyMarketEvent(state, "police_crackdown", 1000);
    const during = calculateMarketPrice(eventResult.nextState!, "chemicals", "normal").finalPrice;
    const ticked = tickMarket(eventResult.nextState!, 1000 + 601000);

    expect(eventResult.success).toBe(true);
    expect(during).toBeGreaterThan(before);
    expect(ticked.expiredEvents.length).toBe(1);
    expect(ticked.nextState.market.activeMarketEvents).toHaveLength(0);
  });

  it("view model exposes inflation, warnings, trends and recent transactions", () => {
    const state = initializeServerMarket(createMarketStateFixture(), 1000);
    state.market.priceHistory["tech-core"].push(
      { timestamp: 1, normalPrice: 100, blackMarketPrice: 160, stock: 260, inflationFactor: 1 },
      { timestamp: 2, normalPrice: 130, blackMarketPrice: 210, stock: 30, inflationFactor: 1.2 }
    );
    state.market.stock["tech-core"] = 10;
    const bought = buyResource(state, state.playersById["player:1"], "metal-parts", 1, "normal", "cleanCash", 1000);

    const viewModel = getMarketViewModel(bought.nextState!, bought.nextState!.playersById["player:1"]);
    const techCore = viewModel.resources.find((resource: Record<string, unknown>) => resource.id === "tech-core");

    expect(viewModel.resources).toHaveLength(21);
    expect(viewModel.inflation.level).toBeTruthy();
    expect(viewModel.recentTransactions.length).toBeGreaterThan(0);
    expect(getResourceTrend(bought.nextState!, "tech-core")).toBe("spike");
    expect(techCore.warnings).toContain("Stock dochází");
  });

  it("projects only canonical channel availability and the actual dirty-cash price", () => {
    const now = 1_000;
    const state = initializeServerMarket(createMarketStateFixture(), now);
    state.playersById["player:1"].dirtyCash = 1_000_000;
    state.playersById["player:1"].cleanCash = 1_000_000;

    const viewModel = getMarketViewModel(state, state.playersById["player:1"], now);
    const chemicals = viewModel.resources.find((resource: Record<string, unknown>) => resource.id === "chemicals");
    const techCore = viewModel.resources.find((resource: Record<string, unknown>) => resource.id === "tech-core");
    const rotatedBlackOffer = viewModel.resources.find((resource: Record<string, unknown>) =>
      Boolean((resource.blackMarket as Record<string, unknown> | undefined)?.available)
    );

    expect(chemicals.normalMarket.available).toBe(true);
    expect(techCore.normalMarket.available).toBe(false);
    expect(viewModel.blackMarket.offerResourceIds).toHaveLength(marketConfig.blackMarket.offerCount);
    expect(viewModel.blackMarket.heatByValue).toEqual([
      { min: 3500, heat: 10 },
      { min: 1800, heat: 6 },
      { min: 750, heat: 3 },
      { min: 1, heat: 1 }
    ]);
    expect(rotatedBlackOffer.blackMarket.dirtyCashPrice).toBe(
      Math.ceil(rotatedBlackOffer.blackMarket.price * marketConfig.blackMarket.dirtyCashPaymentMultiplier)
    );
    expect(rotatedBlackOffer.blackMarket.canBuyWithCleanCash).toBe(true);
    expect(rotatedBlackOffer.blackMarket.canBuyWithDirtyCash).toBe(true);
  });

  it("keeps market state isolated per server object", () => {
    const serverA = initializeServerMarket(createMarketStateFixture(), 1000);
    const serverB = initializeServerMarket(createMarketStateFixture(), 1000);
    serverA.playersById["player:1"].cleanCash = 100000;
    serverB.playersById["player:1"].cleanCash = 100000;

    const boughtA = buyResource(serverA, serverA.playersById["player:1"], "biomass", 100, "normal", "cleanCash");

    expect(boughtA.success).toBe(true);
    expect(boughtA.nextState?.market.stock.biomass).toBe(serverA.market.stock.biomass - 100);
    expect(serverB.market.stock.biomass).toBe(marketConfig.resources.biomass.normalMarketStartStock);
    expect(getServerTotalMoney(serverB)).toBe(getServerTotalMoney(serverA));
  });

  it("supports player-to-player listings on the same server", () => {
    const state = initializeServerMarket(createMarketStateFixture(), 1000);
    const listed = createPlayerMarketListing(state, state.playersById["player:1"], "chemicals", 6, 44, "cleanCash");

    expect(listed.success).toBe(true);
    expect(listed.nextState?.market.playerListings).toHaveLength(1);
    expect(listed.playerState?.resources.chemicals).toBe(24);

    const bought = buyPlayerMarketListing(listed.nextState!, listed.nextState!.playersById["player:2"], listed.listingId!);

    expect(bought.success).toBe(true);
    expect(bought.nextState?.market.playerListings).toHaveLength(0);
    expect(bought.nextState?.playersById["player:2"].resources.chemicals).toBe(6);
    expect(bought.nextState?.playersById["player:1"].cleanCash).toBeGreaterThan(state.playersById["player:1"].cleanCash);
    expect(getMarketViewModel(bought.nextState!, bought.nextState!.playersById["player:2"]).playerMarket.listings).toHaveLength(0);
  });

  it("lets sellers cancel or expire player market listings and get resources back", () => {
    const state = initializeServerMarket(createMarketStateFixture(), 1000);
    const listed = createPlayerMarketListing(state, state.playersById["player:1"], "biomass", 5, 24, "dirtyCash");

    const cancelled = cancelPlayerMarketListing(listed.nextState!, listed.nextState!.playersById["player:1"], listed.listingId!);

    expect(cancelled.success).toBe(true);
    expect(cancelled.nextState?.market.playerListings).toHaveLength(0);
    expect(cancelled.playerState?.resources.biomass).toBe(40);

    const listedAgain = createPlayerMarketListing(cancelled.nextState!, cancelled.nextState!.playersById["player:1"], "biomass", 5, 24, "dirtyCash");
    const expired = tickMarket(listedAgain.nextState!, Date.now() + marketConfig.playerMarket.listingTtlSecondsFree * 1000 + 1);

    expect(expired.expiredPlayerListings).toContain(listedAgain.listingId);
    expect(expired.nextState.market.playerListings).toHaveLength(0);
    expect(expired.nextState.playersById["player:1"].resources.biomass).toBe(40);
  });
});
