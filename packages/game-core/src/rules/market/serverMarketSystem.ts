import {
  clonePriceHistory,
  cloneServerState
} from "./market-state-clone";
import {
  creditPlayerCash,
  creditPlayerResource,
  debitPlayerCash,
  debitPlayerResource,
  findPlayer,
  getAllPlayers,
  getPlayerCash,
  getPlayerId,
  getPlayerResourceAmount,
  hasPlayerCash,
  resolvePlayerForMutation,
  resolvePlayerForRead
} from "./market-state-access";
export type MarketResourceId = "metalParts" | "techCore" | "chemicals" | "biomass";
export type MarketType = "normal" | "black";
export type MarketPaymentType = "cleanCash" | "dirtyCash";
export type MarketModeId = "free" | "war";
export type MarketTrend = "down" | "stable" | "up" | "spike";
export type PlayerMarketListingStatus = "active" | "sold" | "cancelled" | "expired";

type AnyRecord = Record<string, any>;

export interface MarketPriceResult {
  resourceId: MarketResourceId;
  marketType: MarketType;
  basePrice: number;
  finalPrice: number;
  factors: {
    demandFactor: number;
    scarcityFactor: number;
    chaosFactor: number;
    inflationFactor: number;
    eventFactor: number;
    marketTypeFactor: number;
  };
}

export interface MarketTransaction {
  id: string;
  timestamp: number;
  playerId: string;
  resourceId: MarketResourceId;
  marketType: MarketType | "player";
  type: "buy" | "sell";
  amount: number;
  unitPrice: number;
  totalPrice: number;
  paymentType: MarketPaymentType;
  auditTriggered?: boolean;
}

export interface PlayerMarketListing {
  id: string;
  createdAt: number;
  expiresAt: number;
  sellerPlayerId: string;
  sellerName?: string;
  resourceId: MarketResourceId;
  amount: number;
  unitPrice: number;
  paymentType: MarketPaymentType;
  status: PlayerMarketListingStatus;
}

export interface ServerMarketState {
  mode: MarketModeId;
  stock: Record<MarketResourceId, number>;
  rollingVolume: Record<MarketResourceId, { buy: number; sell: number }>;
  volumeEvents: Array<{
    timestamp: number;
    resourceId: MarketResourceId;
    type: "buy" | "sell";
    amount: number;
  }>;
  priceHistory: Record<MarketResourceId, Array<{
    timestamp: number;
    normalPrice: number;
    blackMarketPrice: number;
    stock: number;
    inflationFactor: number;
  }>>;
  transactions: MarketTransaction[];
  playerListings: PlayerMarketListing[];
  activeMarketEvents: Array<{
    id: string;
    eventType: MarketEventId;
    startedAt: number;
    expiresAt: number;
  }>;
  lastStockRegenAt: number;
  lastPriceSnapshotAt: number;
  warningFlags: Record<string, number>;
}

export type MarketEventId = keyof typeof marketConfig.marketEvents;

export interface MarketActionResult {
  success: boolean;
  reason?: string;
  message: string;
  nextState?: AnyRecord;
  playerState?: AnyRecord;
  resourceId?: MarketResourceId;
  amount?: number;
  marketType?: MarketType | "player";
  paymentType?: MarketPaymentType;
  unitPrice?: number;
  baseUnitPrice?: number;
  totalPrice?: number;
  shoppingMallDiscountPct?: number;
  shoppingMallDiscountAmount?: number;
  marketFeeReductionPct?: number;
  heatAdded?: number;
  policeSuspicionAdded?: number;
  auditTriggered?: boolean;
  transactionId?: string;
  listingId?: string;
}

const marketResourceIds = ["metalParts", "techCore", "chemicals", "biomass"] as const;

export const marketConfig = Object.freeze({
  id: "server_market",
  freeModeEconomyBaseline: Object.freeze({
    expectedPlayers: 20,
    baselineCleanCashPerPlayer: 2500,
    baselineDirtyCashPerPlayer: 1500,
    baselineTotalMoney: 80000,
    inflationNeutralPoint: 80000,
    inflationSoftCap: 140000,
    inflationHardCap: 220000
  }),
  warModeEconomyBaseline: Object.freeze({
    expectedPlayers: 50,
    baselineCleanCashPerPlayer: 12000,
    baselineDirtyCashPerPlayer: 8000,
    baselineTotalMoney: 1000000,
    inflationNeutralPoint: 1000000,
    inflationSoftCap: 1800000,
    inflationHardCap: 3000000
  }),
  resources: Object.freeze({
    metalParts: Object.freeze({
      name: "Metal Parts",
      basePrice: 18,
      normalMarketStartStock: 900,
      normalMarketMaxStock: 1400,
      minPriceMultiplier: 0.55,
      maxPriceMultiplier: 3.2,
      blackMarketMarkup: 1.35,
      volatility: 0.7,
      category: "combat_material"
    }),
    techCore: Object.freeze({
      name: "Tech Core",
      basePrice: 85,
      normalMarketStartStock: 260,
      normalMarketMaxStock: 420,
      minPriceMultiplier: 0.65,
      maxPriceMultiplier: 4,
      blackMarketMarkup: 1.55,
      volatility: 1.1,
      category: "advanced_component"
    }),
    chemicals: Object.freeze({
      name: "Chemicals",
      basePrice: 28,
      normalMarketStartStock: 700,
      normalMarketMaxStock: 1100,
      minPriceMultiplier: 0.55,
      maxPriceMultiplier: 3.5,
      blackMarketMarkup: 1.45,
      volatility: 0.9,
      category: "drug_material"
    }),
    biomass: Object.freeze({
      name: "Biomass",
      basePrice: 16,
      normalMarketStartStock: 1000,
      normalMarketMaxStock: 1600,
      minPriceMultiplier: 0.5,
      maxPriceMultiplier: 2.8,
      blackMarketMarkup: 1.3,
      volatility: 0.6,
      category: "drug_material"
    })
  } satisfies Record<MarketResourceId, AnyRecord>),
  warModePriceMultipliers: Object.freeze({
    basePriceMultiplier: 3.5,
    stockMultiplier: 4,
    maxStockMultiplier: 5,
    blackMarketMarkupMultiplier: 1.15,
    stockRegenMultiplier: 4
  }),
  baselineVolume: Object.freeze({
    metalParts: 300,
    techCore: 80,
    chemicals: 220,
    biomass: 350
  } satisfies Record<MarketResourceId, number>),
  demand: Object.freeze({
    rollingWindowFreeSeconds: 600,
    minFactor: 0.75,
    maxFactor: 1.85
  }),
  scarcity: Object.freeze({
    minFactor: 0.85,
    maxFactor: 2.25
  }),
  chaos: Object.freeze({
    heistBonus: 0.01,
    attackBonus: 0.02,
    policeRaidBonus: 0.03,
    minFactor: 1,
    maxFactor: 1.75
  }),
  inflation: Object.freeze({
    minFactor: 0.85,
    maxFactor: 2.4
  }),
  blackMarket: Object.freeze({
    dirtyCashPaymentMultiplier: 1.25,
    minRiskFactor: 1,
    maxRiskFactor: 2.2
  }),
  shoppingMallBonus: Object.freeze({
    buildingTypeId: "shopping_mall",
    discountPctPerMall: 2,
    maxDiscountPct: 14,
    regularMarketWeight: 1,
    blackMarketWeight: 0.4,
    playerMarketWeight: 0,
    emergencyMarketWeight: 0,
    minFinalPriceMultiplier: 0.7,
    feeReductionPctPerMall: 5,
    maxFeeReductionPct: 30
  }),
  playerMarket: Object.freeze({
    listingLimitPerSeller: 5,
    listingTtlSecondsFree: 45 * 60,
    listingTtlSecondsWar: 6 * 60 * 60,
    minUnitPrice: 1,
    maxUnitPriceMultiplier: 8,
    dirtyTradeHeat: 2,
    dirtyTradePoliceSuspicion: 1
  }),
  stockRegenPerMinute: Object.freeze({
    metalParts: 35,
    techCore: 8,
    chemicals: 28,
    biomass: 45
  } satisfies Record<MarketResourceId, number>),
  marketEvents: Object.freeze({
    police_crackdown: Object.freeze({
      affectedCategories: ["drug_material", "advanced_component"],
      priceMultiplier: 1.25,
      stockRegenMultiplier: 0.7,
      durationSecondsFree: 600
    }),
    supply_drop: Object.freeze({
      affectedCategories: ["combat_material", "drug_material"],
      priceMultiplier: 0.8,
      stockRegenMultiplier: 1.4,
      durationSecondsFree: 420
    }),
    gang_war: Object.freeze({
      affectedCategories: ["combat_material", "advanced_component"],
      priceMultiplier: 1.35,
      stockRegenMultiplier: 0.85,
      durationSecondsFree: 480
    }),
    lab_shortage: Object.freeze({
      affectedResources: ["chemicals", "biomass"],
      priceMultiplier: 1.3,
      stockRegenMultiplier: 0.65,
      durationSecondsFree: 480
    })
  }),
  largeTransactionValueFree: Object.freeze({
    medium: 750,
    high: 1800,
    extreme: 3500
  }),
  largeTransactionRisk: Object.freeze({
    normal: Object.freeze({
      medium: 0.05,
      high: 0.12,
      extreme: 0.22
    }),
    black: Object.freeze({
      medium: 0.12,
      high: 0.25,
      extreme: 0.4
    })
  }),
  priceHistory: Object.freeze({
    freeSnapshotSeconds: 60,
    freeLimit: 60,
    warSnapshotSeconds: 600,
    warLimit: 200
  }),
  transactionLogLimit: 120
});

const CLEAN_CASH_KEYS = ["cleanCash", "cleanMoney", "cash"];
const DIRTY_CASH_KEYS = ["dirtyCash", "dirtyMoney", "dirty-cash"];
const RESOURCE_ALIASES: Record<MarketResourceId, string[]> = {
  metalParts: ["metalParts", "metal-parts"],
  techCore: ["techCore", "tech-core"],
  chemicals: ["chemicals"],
  biomass: ["biomass"]
};

export const initializeServerMarket = <T extends object>(
  serverState: T,
  now = Date.now()
): T & { market: ServerMarketState } => {
  const state = serverState as T & { market?: Partial<ServerMarketState>; mode?: string; serverInstance?: { mode?: string } };
  const mode = resolveMarketMode(state);
  const existing = state.market;
  const defaultMarket = createDefaultMarketState(mode, now);

  const market: ServerMarketState = {
    mode,
    stock: sanitizeStock(existing?.stock, mode),
    rollingVolume: sanitizeRollingVolume(existing?.rollingVolume),
    volumeEvents: Array.isArray(existing?.volumeEvents) ? existing.volumeEvents.filter(isVolumeEvent) : [],
    priceHistory: sanitizePriceHistory(existing?.priceHistory),
    transactions: Array.isArray(existing?.transactions) ? existing.transactions.filter(isMarketTransaction).slice(-marketConfig.transactionLogLimit) : [],
    playerListings: sanitizePlayerMarketListings(existing?.playerListings, now),
    activeMarketEvents: Array.isArray(existing?.activeMarketEvents) ? existing.activeMarketEvents.filter(isActiveMarketEvent) : [],
    lastStockRegenAt: safeTimestamp(existing?.lastStockRegenAt) || defaultMarket.lastStockRegenAt,
    lastPriceSnapshotAt: safeTimestamp(existing?.lastPriceSnapshotAt) || defaultMarket.lastPriceSnapshotAt,
    warningFlags: sanitizeTimestampMap(existing?.warningFlags)
  };

  state.market = market;
  updateRollingVolume(market, now);
  return state as T & { market: ServerMarketState };
};

export const calculateMarketPrice = (
  serverState: AnyRecord,
  resourceId: MarketResourceId,
  marketType: MarketType
): MarketPriceResult => {
  const state = serverState.market ? serverState as AnyRecord & { market: ServerMarketState } : initializeServerMarket(serverState);
  const resourceConfig = marketConfig.resources[resourceId];
  if (!resourceConfig) {
    return createInvalidPrice(resourceId, marketType);
  }

  const mode = state.market.mode;
  const basePrice = getModeBasePrice(resourceId, mode);
  const demandFactor = getDemandFactor(state, resourceId);
  const scarcityFactor = getScarcityFactor(state, resourceId);
  const chaosFactor = getChaosFactor(state);
  const inflationFactor = getInflationFactor(state);
  const eventFactor = getEventPriceFactor(state, resourceId);
  const normalRawPrice = basePrice * demandFactor * scarcityFactor * chaosFactor * inflationFactor * eventFactor;
  const normalPrice = clamp(
    normalRawPrice,
    basePrice * resourceConfig.minPriceMultiplier,
    basePrice * resourceConfig.maxPriceMultiplier
  );
  const marketTypeFactor = marketType === "black" ? getBlackMarketTypeFactor(state, resourceId) : 1;
  const finalPrice = marketType === "black"
    ? Math.ceil(normalPrice * marketTypeFactor)
    : Math.ceil(normalPrice);

  return {
    resourceId,
    marketType,
    basePrice,
    finalPrice: Math.max(1, safeInteger(finalPrice)),
    factors: {
      demandFactor,
      scarcityFactor,
      chaosFactor,
      inflationFactor,
      eventFactor,
      marketTypeFactor
    }
  };
};

export const buyResource = (
  serverState: AnyRecord,
  playerState: AnyRecord,
  resourceId: MarketResourceId,
  amount: number,
  marketType: MarketType,
  paymentType: MarketPaymentType
): MarketActionResult => {
  const now = Date.now();
  const nextState = cloneServerState(serverState);
  const state = initializeServerMarket(nextState, now);
  const player = resolvePlayerForMutation(state, playerState);
  const safeAmount = safeInteger(amount);

  if (!marketConfig.resources[resourceId]) {
    return failMarketAction("UNKNOWN_RESOURCE", "Resource na marketu neexistuje.");
  }
  if (safeAmount <= 0) {
    return failMarketAction("INVALID_AMOUNT", "Množství musí být větší než nula.");
  }
  if (marketType !== "normal" && marketType !== "black") {
    return failMarketAction("INVALID_MARKET_TYPE", "Neznámý typ marketu.");
  }
  if (paymentType === "dirtyCash" && marketType !== "black") {
    return failMarketAction("DIRTY_CASH_NOT_ALLOWED", "Dirty cash lze použít jen na black marketu.");
  }
  if (marketType === "normal" && state.market.stock[resourceId] < safeAmount) {
    return failMarketAction("NOT_ENOUGH_STOCK", "Normal market nemá dost stocku. Zkus black market.", { nextState: state });
  }

  const baseUnitPrice = calculateMarketPrice(state, resourceId, marketType).finalPrice;
  const marketBonus = resolveShoppingMallMarketBonusForMarket(state, player, marketType, resourceId);
  const unitPrice = applyShoppingMallDiscount(baseUnitPrice, marketBonus);
  const paymentMultiplier = paymentType === "dirtyCash" ? marketConfig.blackMarket.dirtyCashPaymentMultiplier : 1;
  const totalPrice = Math.ceil(unitPrice * safeAmount * paymentMultiplier);
  if (!hasPlayerCash(state, player, paymentType, totalPrice)) {
    return failMarketAction("NOT_ENOUGH_CASH", "Nemáš dost cash na nákup.", { nextState: state });
  }

  debitPlayerCash(state, player, paymentType, totalPrice);
  creditPlayerResource(state, player, resourceId, safeAmount);
  if (marketType === "normal") {
    state.market.stock[resourceId] = clampStock(state.market.stock[resourceId] - safeAmount, resourceId, state.market.mode);
  }

  addRollingVolume(state.market, resourceId, "buy", safeAmount, now);
  const risk = applyTransactionRisk(state, player, marketType, totalPrice, now);
  const blackMarketHeat = marketType === "black" ? applyBlackMarketHeat(state, player, totalPrice, now) : { heatAdded: 0, policeSuspicionAdded: 0 };
  const transaction = appendMarketTransaction(state, {
    id: createMarketTransactionId(now, player),
    timestamp: now,
    playerId: getPlayerId(player),
    resourceId,
    marketType,
    type: "buy",
    amount: safeAmount,
    unitPrice,
    totalPrice,
    paymentType,
    auditTriggered: risk.auditTriggered
  });

  maybeAddTransactionRumors(state, player, resourceId, marketType, totalPrice, safeAmount, now);
  appendGameLog(state, "market", `${marketType === "black" ? "Black market" : "Normal market"} nákup: ${safeAmount} ${resourceId}.`, {
    playerId: getPlayerId(player),
    resourceId,
    amount: safeAmount,
    marketType,
    totalPrice
  });

  return {
    success: true,
    nextState: state,
    playerState: player,
    resourceId,
    amount: safeAmount,
    marketType,
    paymentType,
    unitPrice,
    baseUnitPrice,
    totalPrice,
    shoppingMallDiscountPct: marketBonus.discountPct,
    shoppingMallDiscountAmount: Math.max(0, baseUnitPrice - unitPrice) * safeAmount,
    marketFeeReductionPct: marketBonus.marketFeeReductionPct,
    heatAdded: blackMarketHeat.heatAdded,
    policeSuspicionAdded: blackMarketHeat.policeSuspicionAdded + risk.policeSuspicionAdded,
    auditTriggered: risk.auditTriggered,
    transactionId: transaction.id,
    message: "Nákup na server marketu proběhl."
  };
};

export const sellResource = (
  serverState: AnyRecord,
  playerState: AnyRecord,
  resourceId: MarketResourceId,
  amount: number
): MarketActionResult => {
  const now = Date.now();
  const nextState = cloneServerState(serverState);
  const state = initializeServerMarket(nextState, now);
  const player = resolvePlayerForMutation(state, playerState);
  const safeAmount = safeInteger(amount);

  if (!marketConfig.resources[resourceId]) {
    return failMarketAction("UNKNOWN_RESOURCE", "Resource na marketu neexistuje.");
  }
  if (safeAmount <= 0) {
    return failMarketAction("INVALID_AMOUNT", "Množství musí být větší než nula.");
  }
  if (getPlayerResourceAmount(state, player, resourceId) < safeAmount) {
    return failMarketAction("NOT_ENOUGH_RESOURCE", "Nemáš dost resource na prodej.", { nextState: state });
  }

  const normalPrice = calculateMarketPrice(state, resourceId, "normal").finalPrice;
  const sellMultiplier = getSellMultiplier(state, resourceId);
  const unitPrice = Math.max(1, Math.floor(normalPrice * sellMultiplier));
  const totalPrice = unitPrice * safeAmount;

  debitPlayerResource(state, player, resourceId, safeAmount);
  creditPlayerCash(state, player, "cleanCash", totalPrice);
  state.market.stock[resourceId] = clampStock(state.market.stock[resourceId] + safeAmount, resourceId, state.market.mode);
  addRollingVolume(state.market, resourceId, "sell", safeAmount, now);
  const risk = applyTransactionRisk(state, player, "normal", totalPrice, now);
  const transaction = appendMarketTransaction(state, {
    id: createMarketTransactionId(now, player),
    timestamp: now,
    playerId: getPlayerId(player),
    resourceId,
    marketType: "normal",
    type: "sell",
    amount: safeAmount,
    unitPrice,
    totalPrice,
    paymentType: "cleanCash",
    auditTriggered: risk.auditTriggered
  });

  appendGameLog(state, "market", `Normal market výkup: ${safeAmount} ${resourceId}.`, {
    playerId: getPlayerId(player),
    resourceId,
    amount: safeAmount,
    totalPrice
  });

  return {
    success: true,
    nextState: state,
    playerState: player,
    resourceId,
    amount: safeAmount,
    marketType: "normal",
    paymentType: "cleanCash",
    unitPrice,
    totalPrice,
    policeSuspicionAdded: risk.policeSuspicionAdded,
    auditTriggered: risk.auditTriggered,
    transactionId: transaction.id,
    message: "Prodej na server marketu proběhl."
  };
};

export const createPlayerMarketListing = (
  serverState: AnyRecord,
  sellerState: AnyRecord,
  resourceId: MarketResourceId,
  amount: number,
  unitPrice: number,
  paymentType: MarketPaymentType = "cleanCash"
): MarketActionResult => {
  const now = Date.now();
  const nextState = cloneServerState(serverState);
  const state = initializeServerMarket(nextState, now);
  const seller = resolvePlayerForMutation(state, sellerState);
  const sellerPlayerId = getPlayerId(seller);
  const safeAmount = safeInteger(amount);
  const safeUnitPrice = safeInteger(unitPrice);

  if (!sellerPlayerId) {
    return failMarketAction("UNKNOWN_SELLER", "Prodejce na serveru neexistuje.", { nextState: state });
  }
  if (!marketConfig.resources[resourceId]) {
    return failMarketAction("UNKNOWN_RESOURCE", "Resource na hráčském bazaru neexistuje.", { nextState: state });
  }
  if (safeAmount <= 0) {
    return failMarketAction("INVALID_AMOUNT", "Množství musí být větší než nula.", { nextState: state });
  }
  if (safeUnitPrice < marketConfig.playerMarket.minUnitPrice || safeUnitPrice > getMaxPlayerListingUnitPrice(state, resourceId)) {
    return failMarketAction("INVALID_PRICE", "Cena nabídky je mimo povolený rozsah.", { nextState: state });
  }
  if (paymentType !== "cleanCash" && paymentType !== "dirtyCash") {
    return failMarketAction("INVALID_PAYMENT_TYPE", "Neznámá měna hráčského bazaru.", { nextState: state });
  }
  if (getPlayerResourceAmount(state, seller, resourceId) < safeAmount) {
    return failMarketAction("NOT_ENOUGH_RESOURCE", "Nemáš dost resource pro vystavení nabídky.", { nextState: state });
  }
  if (getActivePlayerListingCount(state.market, sellerPlayerId, now) >= marketConfig.playerMarket.listingLimitPerSeller) {
    return failMarketAction("LISTING_LIMIT_REACHED", "Máš už moc aktivních nabídek na hráčském bazaru.", { nextState: state });
  }

  debitPlayerResource(state, seller, resourceId, safeAmount);
  const ttlSeconds = state.market.mode === "war"
    ? marketConfig.playerMarket.listingTtlSecondsWar
    : marketConfig.playerMarket.listingTtlSecondsFree;
  const listing: PlayerMarketListing = {
    id: createPlayerMarketListingId(now, seller),
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
    sellerPlayerId,
    sellerName: getPlayerLabel(seller),
    resourceId,
    amount: safeAmount,
    unitPrice: safeUnitPrice,
    paymentType,
    status: "active"
  };

  state.market.playerListings.unshift(listing);
  state.market.playerListings = sanitizePlayerMarketListings(state.market.playerListings, now);
  appendGameLog(state, "market", `Hráčský bazar: vystaveno ${safeAmount} ${resourceId}.`, {
    playerId: sellerPlayerId,
    resourceId,
    amount: safeAmount,
    unitPrice: safeUnitPrice,
    paymentType,
    listingId: listing.id
  });

  return {
    success: true,
    nextState: state,
    playerState: seller,
    resourceId,
    amount: safeAmount,
    marketType: "player",
    paymentType,
    unitPrice: safeUnitPrice,
    totalPrice: safeUnitPrice * safeAmount,
    listingId: listing.id,
    message: "Nabídka byla vystavena na hráčský bazar serveru."
  };
};

export const buyPlayerMarketListing = (
  serverState: AnyRecord,
  buyerState: AnyRecord,
  listingId: string
): MarketActionResult => {
  const now = Date.now();
  const nextState = cloneServerState(serverState);
  const state = initializeServerMarket(nextState, now);
  const buyer = resolvePlayerForMutation(state, buyerState);
  const buyerPlayerId = getPlayerId(buyer);
  const normalizedListingId = String(listingId || "").trim();
  const listing = state.market.playerListings.find((entry) => entry.id === normalizedListingId && entry.status === "active");

  if (!buyerPlayerId) {
    return failMarketAction("UNKNOWN_BUYER", "Kupující na serveru neexistuje.", { nextState: state });
  }
  if (!listing || listing.expiresAt <= now) {
    return failMarketAction("LISTING_NOT_FOUND", "Nabídka už na hráčském bazaru není aktivní.", { nextState: state });
  }
  if (listing.sellerPlayerId === buyerPlayerId) {
    return failMarketAction("CANNOT_BUY_OWN_LISTING", "Vlastní nabídku nelze koupit.", { nextState: state });
  }

  const seller = findPlayer(state, listing.sellerPlayerId);
  if (!seller) {
    return failMarketAction("SELLER_NOT_FOUND", "Prodejce už není na serveru dostupný.", { nextState: state });
  }

  const totalPrice = safeInteger(listing.unitPrice * listing.amount);
  if (!hasPlayerCash(state, buyer, listing.paymentType, totalPrice)) {
    return failMarketAction("NOT_ENOUGH_CASH", "Nemáš dost cash na nákup nabídky.", { nextState: state });
  }

  debitPlayerCash(state, buyer, listing.paymentType, totalPrice);
  creditPlayerCash(state, seller, listing.paymentType, totalPrice);
  creditPlayerResource(state, buyer, listing.resourceId, listing.amount);
  addRollingVolume(state.market, listing.resourceId, "buy", listing.amount, now);

  const dirtyTradeRisk = listing.paymentType === "dirtyCash"
    ? applyPlayerMarketDirtyTradeRisk(state, buyer, totalPrice, now)
    : { heatAdded: 0, policeSuspicionAdded: 0 };
  const risk = applyTransactionRisk(state, buyer, "normal", totalPrice, now);
  const transaction = appendMarketTransaction(state, {
    id: createMarketTransactionId(now, buyer),
    timestamp: now,
    playerId: buyerPlayerId,
    resourceId: listing.resourceId,
    marketType: "player",
    type: "buy",
    amount: listing.amount,
    unitPrice: listing.unitPrice,
    totalPrice,
    paymentType: listing.paymentType,
    auditTriggered: risk.auditTriggered
  });

  state.market.playerListings = state.market.playerListings.filter((entry) => entry.id !== listing.id);
  maybeAddTransactionRumors(state, buyer, listing.resourceId, "normal", totalPrice, listing.amount, now);
  appendGameLog(state, "market", `Hráčský bazar: koupeno ${listing.amount} ${listing.resourceId}.`, {
    playerId: buyerPlayerId,
    sellerPlayerId: listing.sellerPlayerId,
    resourceId: listing.resourceId,
    amount: listing.amount,
    totalPrice,
    paymentType: listing.paymentType,
    listingId: listing.id
  });

  return {
    success: true,
    nextState: state,
    playerState: buyer,
    resourceId: listing.resourceId,
    amount: listing.amount,
    marketType: "player",
    paymentType: listing.paymentType,
    unitPrice: listing.unitPrice,
    totalPrice,
    heatAdded: dirtyTradeRisk.heatAdded,
    policeSuspicionAdded: dirtyTradeRisk.policeSuspicionAdded + risk.policeSuspicionAdded,
    auditTriggered: risk.auditTriggered,
    transactionId: transaction.id,
    listingId: listing.id,
    message: "Nabídka z hráčského bazaru byla koupena."
  };
};

export const cancelPlayerMarketListing = (
  serverState: AnyRecord,
  sellerState: AnyRecord,
  listingId: string
): MarketActionResult => {
  const now = Date.now();
  const nextState = cloneServerState(serverState);
  const state = initializeServerMarket(nextState, now);
  const seller = resolvePlayerForMutation(state, sellerState);
  const sellerPlayerId = getPlayerId(seller);
  const normalizedListingId = String(listingId || "").trim();
  const listing = state.market.playerListings.find((entry) => entry.id === normalizedListingId && entry.status === "active");

  if (!listing || listing.sellerPlayerId !== sellerPlayerId) {
    return failMarketAction("LISTING_NOT_FOUND", "Tuhle nabídku nemůžeš stáhnout.", { nextState: state });
  }

  creditPlayerResource(state, seller, listing.resourceId, listing.amount);
  state.market.playerListings = state.market.playerListings.filter((entry) => entry.id !== listing.id);
  appendGameLog(state, "market", `Hráčský bazar: staženo ${listing.amount} ${listing.resourceId}.`, {
    playerId: sellerPlayerId,
    resourceId: listing.resourceId,
    amount: listing.amount,
    marketType: "player",
    listingId: listing.id
  });

  return {
    success: true,
    nextState: state,
    playerState: seller,
    resourceId: listing.resourceId,
    amount: listing.amount,
    paymentType: listing.paymentType,
    unitPrice: listing.unitPrice,
    totalPrice: listing.unitPrice * listing.amount,
    listingId: listing.id,
    message: "Nabídka byla stažena a resource se vrátil do skladu."
  };
};

export const tickMarket = (
  serverState: AnyRecord,
  now = Date.now()
): { nextState: AnyRecord; snapshots: number; expiredEvents: string[]; expiredPlayerListings: string[]; warnings: string[] } => {
  const nextState = cloneServerState(serverState);
  const state = initializeServerMarket(nextState, now);
  const expiredEvents = expireMarketEvents(state, now);
  const expiredPlayerListings = expirePlayerMarketListings(state, now);
  regenerateStock(state, now);
  updateRollingVolume(state.market, now);
  const snapshots = maybeSnapshotPrices(state, now);
  const warnings = generateMarketWarnings(state, now);

  return {
    nextState: state,
    snapshots,
    expiredEvents,
    expiredPlayerListings,
    warnings
  };
};

export const getMarketViewModel = (serverState: AnyRecord, playerState: AnyRecord): AnyRecord => {
  const state = initializeServerMarket(serverState);
  const player = resolvePlayerForRead(state, playerState);
  const totalMoneyInServer = getServerTotalMoney(state);
  const inflationFactor = getInflationFactor(state);
  const inflationLevel = getInflationLevel(state, totalMoneyInServer);

  return {
    mode: state.market.mode,
    inflation: {
      totalMoneyInServer,
      inflationFactor,
      level: inflationLevel.level,
      message: inflationLevel.message
    },
    resources: marketResourceIds.map((resourceId) => {
      const resourceConfig = marketConfig.resources[resourceId];
      const baseNormalPrice = calculateMarketPrice(state, resourceId, "normal").finalPrice;
      const baseBlackPrice = calculateMarketPrice(state, resourceId, "black").finalPrice;
      const normalBonus = resolveShoppingMallMarketBonusForMarket(state, player, "normal", resourceId);
      const blackBonus = resolveShoppingMallMarketBonusForMarket(state, player, "black", resourceId);
      const normalPrice = applyShoppingMallDiscount(baseNormalPrice, normalBonus);
      const blackPrice = applyShoppingMallDiscount(baseBlackPrice, blackBonus);
      const maxStock = getMaxStock(resourceId, state.market.mode);
      const stock = clampStock(state.market.stock[resourceId], resourceId, state.market.mode);
      const stockPercent = maxStock > 0 ? Math.round((stock / maxStock) * 100) : 0;
      const sellPrice = Math.max(1, Math.floor(normalPrice * getSellMultiplier(state, resourceId)));
      const trend = getResourceTrend(state, resourceId);

      return {
        id: resourceId,
        name: resourceConfig.name,
        category: resourceConfig.category,
        normalMarket: {
          basePrice: baseNormalPrice,
          price: normalPrice,
          shoppingMallDiscountPct: normalBonus.discountPct,
          shoppingMallDiscountAmount: Math.max(0, baseNormalPrice - normalPrice),
          marketFeeReductionPct: normalBonus.marketFeeReductionPct,
          sellPrice,
          stock,
          maxStock,
          stockPercent,
          canBuy: stock > 0 && hasPlayerCash(state, player, "cleanCash", normalPrice),
          canSell: getPlayerResourceAmount(state, player, resourceId) > 0
        },
        blackMarket: {
          basePrice: baseBlackPrice,
          price: blackPrice,
          shoppingMallDiscountPct: blackBonus.discountPct,
          shoppingMallDiscountAmount: Math.max(0, baseBlackPrice - blackPrice),
          marketFeeReductionPct: blackBonus.marketFeeReductionPct,
          available: true,
          markup: roundRatio(calculateMarketPrice(state, resourceId, "black").factors.marketTypeFactor),
          heatRisk: getBlackMarketHeatForValue(blackPrice),
          policeRisk: Math.ceil(getBlackMarketHeatForValue(blackPrice) * 0.5),
          canBuyWithDirtyCash: hasPlayerCash(state, player, "dirtyCash", Math.ceil(blackPrice * marketConfig.blackMarket.dirtyCashPaymentMultiplier))
        },
        trend,
        warnings: getResourceWarnings(state, resourceId, normalPrice, blackPrice)
      };
    }),
    activeMarketEvents: state.market.activeMarketEvents.map((event) => ({ ...event })),
    playerMarket: {
      listings: state.market.playerListings
        .filter((listing) => listing.status === "active" && listing.expiresAt > Date.now())
        .map((listing) => ({
          ...listing,
          totalPrice: listing.unitPrice * listing.amount,
          isOwn: listing.sellerPlayerId === getPlayerId(player),
          canBuy: listing.sellerPlayerId !== getPlayerId(player)
            && hasPlayerCash(state, player, listing.paymentType, listing.unitPrice * listing.amount)
        })),
      ownListingCount: getActivePlayerListingCount(state.market, getPlayerId(player), Date.now()),
      listingLimitPerSeller: marketConfig.playerMarket.listingLimitPerSeller
    },
    recentTransactions: [...state.market.transactions].slice(-10).reverse(),
    priceHistory: clonePriceHistory(state.market.priceHistory)
  };
};

export const getServerTotalMoney = (serverState: AnyRecord): number => {
  const players = getAllPlayers(serverState);
  const seenResourceStates = new Set<string>();

  return Math.floor(players.reduce((total, player) => {
    const clean = getPlayerCash(serverState, player, "cleanCash", seenResourceStates);
    const dirty = getPlayerCash(serverState, player, "dirtyCash", seenResourceStates);
    return total + clean + dirty * 0.7;
  }, 0));
};

export const getInflationFactor = (serverState: AnyRecord): number => {
  const mode = resolveMarketMode(serverState);
  const baseline = getEconomyBaseline(mode);
  const totalMoney = getServerTotalMoney(serverState);
  const neutral = baseline.inflationNeutralPoint;
  const rawFactor = totalMoney <= neutral
    ? 1 + ((totalMoney / neutral) - 1) * 0.15
    : 1 + ((totalMoney - neutral) / neutral) * 0.45;

  return roundRatio(clamp(rawFactor, marketConfig.inflation.minFactor, marketConfig.inflation.maxFactor));
};

export const applyMarketEvent = (
  serverState: AnyRecord,
  eventType: MarketEventId,
  now = Date.now()
): { success: boolean; reason?: string; message: string; nextState?: AnyRecord; event?: AnyRecord } => {
  const eventConfig = marketConfig.marketEvents[eventType];
  if (!eventConfig) {
    return {
      success: false,
      reason: "UNKNOWN_MARKET_EVENT",
      message: "Neznámý market event."
    };
  }

  const nextState = cloneServerState(serverState);
  const state = initializeServerMarket(nextState, now);
  const durationMultiplier = state.market.mode === "war" ? marketConfig.warModePriceMultipliers.stockRegenMultiplier : 1;
  const event = {
    id: `market-event:${eventType}:${now}:${Math.random().toString(36).slice(2, 8)}`,
    eventType,
    startedAt: now,
    expiresAt: now + Math.ceil(eventConfig.durationSecondsFree * durationMultiplier) * 1000
  };

  state.market.activeMarketEvents.push(event);
  appendGameLog(state, "market", `Market event aktivní: ${eventType}.`, { eventType, expiresAt: event.expiresAt });

  return {
    success: true,
    nextState: state,
    event,
    message: "Market event byl aplikován."
  };
};

export const getResourceTrend = (serverState: AnyRecord, resourceId: MarketResourceId): MarketTrend => {
  const state = initializeServerMarket(serverState);
  const history = state.market.priceHistory[resourceId] ?? [];
  if (history.length < 2) {
    return "stable";
  }

  const previous = history[history.length - 2]?.normalPrice ?? 0;
  const current = history[history.length - 1]?.normalPrice ?? 0;
  if (previous <= 0 || current <= 0) {
    return "stable";
  }

  const change = (current - previous) / previous;
  if (change < -0.08) {
    return "down";
  }
  if (change > 0.2) {
    return "spike";
  }
  if (change > 0.08) {
    return "up";
  }
  return "stable";
};

const createDefaultMarketState = (mode: MarketModeId, now: number): ServerMarketState => ({
  mode,
  stock: Object.fromEntries(marketResourceIds.map((resourceId) => [resourceId, getStartStock(resourceId, mode)])) as Record<MarketResourceId, number>,
  rollingVolume: createEmptyRollingVolume(),
  volumeEvents: [],
  priceHistory: Object.fromEntries(marketResourceIds.map((resourceId) => [resourceId, []])) as unknown as ServerMarketState["priceHistory"],
  transactions: [],
  playerListings: [],
  activeMarketEvents: [],
  lastStockRegenAt: now,
  lastPriceSnapshotAt: now,
  warningFlags: {}
});

const createEmptyRollingVolume = (): Record<MarketResourceId, { buy: number; sell: number }> =>
  Object.fromEntries(marketResourceIds.map((resourceId) => [resourceId, { buy: 0, sell: 0 }])) as Record<MarketResourceId, { buy: number; sell: number }>;

const getExistingOrInitializedMarket = (serverState: AnyRecord): ServerMarketState =>
  serverState.market && typeof serverState.market === "object" && serverState.market.stock
    ? serverState.market as ServerMarketState
    : initializeServerMarket(serverState).market;

const sanitizeStock = (stock: unknown, mode: MarketModeId): Record<MarketResourceId, number> =>
  Object.fromEntries(marketResourceIds.map((resourceId) => [
    resourceId,
    clampStock((stock as AnyRecord | undefined)?.[resourceId] ?? getStartStock(resourceId, mode), resourceId, mode)
  ])) as Record<MarketResourceId, number>;

const sanitizeRollingVolume = (rollingVolume: unknown): Record<MarketResourceId, { buy: number; sell: number }> =>
  Object.fromEntries(marketResourceIds.map((resourceId) => {
    const volume = (rollingVolume as AnyRecord | undefined)?.[resourceId];
    return [
      resourceId,
      {
        buy: safeInteger(volume?.buy),
        sell: safeInteger(volume?.sell)
      }
    ];
  })) as Record<MarketResourceId, { buy: number; sell: number }>;

const sanitizePriceHistory = (history: unknown): ServerMarketState["priceHistory"] =>
  Object.fromEntries(marketResourceIds.map((resourceId) => {
    const entries = (history as AnyRecord | undefined)?.[resourceId];
    return [
      resourceId,
      Array.isArray(entries) ? entries.filter(isPriceSnapshot).map((entry) => ({
        timestamp: safeTimestamp(entry.timestamp),
        normalPrice: safeInteger(entry.normalPrice),
        blackMarketPrice: safeInteger(entry.blackMarketPrice),
        stock: safeInteger(entry.stock),
        inflationFactor: safeNumber(entry.inflationFactor)
      })) : []
    ];
  })) as ServerMarketState["priceHistory"];

const sanitizeTimestampMap = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, safeTimestamp(entry)]));
};

const sanitizePlayerMarketListings = (listings: unknown, now: number): PlayerMarketListing[] => {
  if (!Array.isArray(listings)) {
    return [];
  }

  return listings
    .filter(isPlayerMarketListing)
    .map((listing): PlayerMarketListing => ({
      id: listing.id,
      createdAt: safeTimestamp(listing.createdAt) || now,
      expiresAt: safeTimestamp(listing.expiresAt) || now,
      sellerPlayerId: listing.sellerPlayerId,
      sellerName: typeof listing.sellerName === "string" ? listing.sellerName : undefined,
      resourceId: listing.resourceId,
      amount: safeInteger(listing.amount),
      unitPrice: safeInteger(listing.unitPrice),
      paymentType: listing.paymentType === "dirtyCash" ? "dirtyCash" : "cleanCash",
      status: listing.status
    }))
    .filter((listing) =>
      listing.status === "active"
      && listing.amount > 0
      && listing.unitPrice >= marketConfig.playerMarket.minUnitPrice
    )
    .slice(0, marketConfig.transactionLogLimit);
};

const getStartStock = (resourceId: MarketResourceId, mode: MarketModeId): number => {
  const base = marketConfig.resources[resourceId].normalMarketStartStock;
  return safeInteger(base * (mode === "war" ? marketConfig.warModePriceMultipliers.stockMultiplier : 1));
};

const getMaxStock = (resourceId: MarketResourceId, mode: MarketModeId): number => {
  const base = marketConfig.resources[resourceId].normalMarketMaxStock;
  return safeInteger(base * (mode === "war" ? marketConfig.warModePriceMultipliers.maxStockMultiplier : 1));
};

const getModeBasePrice = (resourceId: MarketResourceId, mode: MarketModeId): number => {
  const base = marketConfig.resources[resourceId].basePrice;
  return Math.max(1, Math.ceil(base * (mode === "war" ? marketConfig.warModePriceMultipliers.basePriceMultiplier : 1)));
};

const getEconomyBaseline = (mode: MarketModeId) =>
  mode === "war" ? marketConfig.warModeEconomyBaseline : marketConfig.freeModeEconomyBaseline;

const getDemandFactor = (serverState: AnyRecord, resourceId: MarketResourceId): number => {
  const market = getExistingOrInitializedMarket(serverState);
  const volume = market.rollingVolume[resourceId] ?? { buy: 0, sell: 0 };
  const baselineVolume = marketConfig.baselineVolume[resourceId];
  const volatility = marketConfig.resources[resourceId].volatility;
  const raw = 1 + ((volume.buy - volume.sell) / baselineVolume) * 0.25 * volatility;
  return roundRatio(clamp(raw, marketConfig.demand.minFactor, marketConfig.demand.maxFactor));
};

const getScarcityFactor = (serverState: AnyRecord, resourceId: MarketResourceId): number => {
  const market = getExistingOrInitializedMarket(serverState);
  const maxStock = getMaxStock(resourceId, market.mode);
  const currentStock = clampStock(market.stock[resourceId], resourceId, market.mode);
  const scarcityRatio = maxStock > 0 ? 1 - currentStock / maxStock : 1;
  const raw = 1 + scarcityRatio * 0.9 * marketConfig.resources[resourceId].volatility;
  return roundRatio(clamp(raw, marketConfig.scarcity.minFactor, marketConfig.scarcity.maxFactor));
};

const getChaosFactor = (serverState: AnyRecord): number => {
  const mode = resolveMarketMode(serverState);
  const baseline = getEconomyBaseline(mode);
  const totalHeat = getServerTotalHeat(serverState);
  const normalizedTotalHeat = totalHeat / Math.max(1, baseline.expectedPlayers * 20);
  const recentViolenceBonus = getRecentViolenceBonus(serverState);
  const raw = 1 + (normalizedTotalHeat + recentViolenceBonus) * 0.45;
  return roundRatio(clamp(raw, marketConfig.chaos.minFactor, marketConfig.chaos.maxFactor));
};

const getServerTotalHeat = (serverState: AnyRecord): number => {
  const playerHeat = getAllPlayers(serverState).reduce((total, player) => {
    const policeState = player?.policeStateId ? serverState.policeStatesById?.[player.policeStateId] : null;
    return total
      + safeNumber(player?.heat)
      + safeNumber(player?.gang?.heat)
      + safeNumber(player?.police?.heat)
      + safeNumber(policeState?.heat);
  }, 0);
  const districtHeat = serverState.districtsById && typeof serverState.districtsById === "object"
    ? Object.values(serverState.districtsById).reduce((total: number, district: any) => total + safeNumber(district?.heat), 0)
    : 0;
  return Math.max(0, playerHeat + districtHeat);
};

const getRecentViolenceBonus = (serverState: AnyRecord, now = Date.now()): number => {
  const windowStart = now - marketConfig.demand.rollingWindowFreeSeconds * 1000;
  const records = collectRecentEventRecords(serverState, windowStart);
  return records.reduce((total, record) => {
    const type = String(record.type ?? record.eventTypeId ?? record.payload?.type ?? "").toLowerCase();
    if (type.includes("heist")) {
      return total + marketConfig.chaos.heistBonus;
    }
    if (type.includes("attack") || type.includes("combat")) {
      return total + marketConfig.chaos.attackBonus;
    }
    if (type.includes("police") || type.includes("raid")) {
      return total + marketConfig.chaos.policeRaidBonus;
    }
    return total;
  }, 0);
};

const collectRecentEventRecords = (serverState: AnyRecord, windowStart: number): AnyRecord[] => {
  const records: AnyRecord[] = [];
  if (Array.isArray(serverState.eventLog)) {
    records.push(...serverState.eventLog.filter((entry: AnyRecord) => safeTimestamp(entry?.createdAt ?? entry?.timestamp) >= windowStart));
  }
  if (serverState.eventsById && typeof serverState.eventsById === "object") {
    records.push(...Object.values(serverState.eventsById).filter((entry: any) => {
      const timestamp = safeTimestamp(entry?.timestamp ?? entry?.createdAt);
      return timestamp === 0 || timestamp >= windowStart;
    }) as AnyRecord[]);
  }
  return records;
};

const getEventPriceFactor = (serverState: AnyRecord, resourceId: MarketResourceId): number => {
  const market = getExistingOrInitializedMarket(serverState);
  const resource = marketConfig.resources[resourceId];
  const eventFactor = market.activeMarketEvents.reduce((factor, activeEvent) => {
    const config = marketConfig.marketEvents[activeEvent.eventType];
    return isResourceAffectedByEvent(resourceId, resource.category, config)
      ? factor * safePositiveNumber(config.priceMultiplier, 1)
      : factor;
  }, 1);
  return eventFactor * getStockExchangeMarketPressureFactor(serverState, resourceId, "normal");
};

const getEventStockRegenFactor = (serverState: AnyRecord, resourceId: MarketResourceId): number => {
  const market = getExistingOrInitializedMarket(serverState);
  const resource = marketConfig.resources[resourceId];
  return market.activeMarketEvents.reduce((factor, activeEvent) => {
    const config = marketConfig.marketEvents[activeEvent.eventType];
    return isResourceAffectedByEvent(resourceId, resource.category, config)
      ? factor * safePositiveNumber(config.stockRegenMultiplier, 1)
      : factor;
  }, 1);
};

const isResourceAffectedByEvent = (resourceId: MarketResourceId, category: string, eventConfig: AnyRecord): boolean =>
  Boolean(
    eventConfig?.affectedResources?.includes?.(resourceId)
    || eventConfig?.affectedCategories?.includes?.(category)
  );

const getBlackMarketTypeFactor = (serverState: AnyRecord, resourceId: MarketResourceId): number => {
  const state = serverState.market ? serverState : initializeServerMarket(serverState);
  const resource = marketConfig.resources[resourceId];
  const warMarkup = state.market.mode === "war" ? marketConfig.warModePriceMultipliers.blackMarketMarkupMultiplier : 1;
  const maxStock = getMaxStock(resourceId, state.market.mode);
  const scarcityRatio = maxStock > 0 ? 1 - clampStock(state.market.stock[resourceId], resourceId, state.market.mode) / maxStock : 1;
  const inflationRisk = Math.max(0, getInflationFactor(state) - 1);
  const chaosRisk = Math.max(0, getChaosFactor(state) - 1);
  const riskFactor = clamp(
    1 + scarcityRatio * 0.35 + inflationRisk * 0.5 + chaosRisk * 0.45,
    marketConfig.blackMarket.minRiskFactor,
    marketConfig.blackMarket.maxRiskFactor
  );
  return roundRatio(resource.blackMarketMarkup * warMarkup * riskFactor * getStockExchangeMarketPressureFactor(serverState, resourceId, "black"));
};

const getSellMultiplier = (serverState: AnyRecord, resourceId: MarketResourceId): number => {
  const state = serverState.market ? serverState : initializeServerMarket(serverState);
  const maxStock = getMaxStock(resourceId, state.market.mode);
  const stockRatio = maxStock > 0 ? state.market.stock[resourceId] / maxStock : 1;
  const overstockPenalty = clamp((stockRatio - 0.85) / 0.15, 0, 1);
  return roundRatio(0.72 - overstockPenalty * 0.17);
};

const resolveShoppingMallMarketBonusForMarket = (
  serverState: AnyRecord,
  player: AnyRecord,
  marketType: MarketType | "player" | "emergency",
  resourceId?: MarketResourceId
): { discountPct: number; marketFeeReductionPct: number; minFinalPriceMultiplier: number } => {
  const config = resolveShoppingMallMarketConfig(serverState);
  const count = getOwnedShoppingMallCountForMarket(serverState, getPlayerId(player), config.buildingTypeId);
  const baseDiscountPct = Math.min(config.maxDiscountPct, count * config.discountPctPerMall);
  const stockExchangeFeeReductionPct = getStockExchangeMarketFeeReductionPct(serverState, getPlayerId(player), marketType);
  const centralBankFeeReductionPct = getCentralBankMarketFeeReductionPct(serverState, getPlayerId(player));
  const airportImportDiscountPct = resourceId
    ? getAirportImportDiscountPct(serverState, getPlayerId(player), marketType, resourceId)
    : 0;
  const marketWeight = marketType === "normal"
    ? config.regularMarketWeight
    : marketType === "black"
      ? config.blackMarketWeight
      : marketType === "player"
        ? config.playerMarketWeight
        : config.emergencyMarketWeight;
  return {
    discountPct: baseDiscountPct * marketWeight + airportImportDiscountPct,
    marketFeeReductionPct: Math.min(config.maxFeeReductionPct, count * config.feeReductionPctPerMall) + stockExchangeFeeReductionPct + centralBankFeeReductionPct,
    minFinalPriceMultiplier: config.minFinalPriceMultiplier
  };
};

const applyShoppingMallDiscount = (
  basePrice: number,
  bonus: { discountPct: number; minFinalPriceMultiplier: number }
): number => {
  const safeBasePrice = Math.max(1, safeInteger(basePrice));
  const discounted = safeBasePrice * (1 - Math.max(0, Number(bonus.discountPct || 0)) / 100);
  return Math.max(1, Math.ceil(Math.max(discounted, safeBasePrice * Math.max(0, Number(bonus.minFinalPriceMultiplier || 0.7)))));
};

const resolveShoppingMallMarketConfig = (serverState: AnyRecord): {
  buildingTypeId: string;
  discountPctPerMall: number;
  maxDiscountPct: number;
  regularMarketWeight: number;
  blackMarketWeight: number;
  playerMarketWeight: number;
  emergencyMarketWeight: number;
  minFinalPriceMultiplier: number;
  feeReductionPctPerMall: number;
  maxFeeReductionPct: number;
} => {
  const configured = serverState?.config?.balance?.shoppingMall ?? serverState?.balance?.shoppingMall ?? {};
  const marketDiscount = configured.marketDiscount ?? {};
  const marketFeeReduction = configured.marketFeeReduction ?? {};
  return {
    buildingTypeId: String(configured.buildingTypeId || marketConfig.shoppingMallBonus.buildingTypeId),
    discountPctPerMall: safePositiveNumber(marketDiscount.discountPctPerMall, marketConfig.shoppingMallBonus.discountPctPerMall),
    maxDiscountPct: safePositiveNumber(marketDiscount.maxDiscountPct, marketConfig.shoppingMallBonus.maxDiscountPct),
    regularMarketWeight: safeNumberWithDefault(marketDiscount.regularMarketWeight, marketConfig.shoppingMallBonus.regularMarketWeight),
    blackMarketWeight: safeNumberWithDefault(marketDiscount.blackMarketWeight, marketConfig.shoppingMallBonus.blackMarketWeight),
    playerMarketWeight: safeNumberWithDefault(marketDiscount.playerMarketWeight, marketConfig.shoppingMallBonus.playerMarketWeight),
    emergencyMarketWeight: safeNumberWithDefault(marketDiscount.emergencyMarketWeight, marketConfig.shoppingMallBonus.emergencyMarketWeight),
    minFinalPriceMultiplier: safePositiveNumber(marketDiscount.minFinalPriceMultiplier, marketConfig.shoppingMallBonus.minFinalPriceMultiplier),
    feeReductionPctPerMall: safePositiveNumber(marketFeeReduction.feeReductionPctPerMall, marketConfig.shoppingMallBonus.feeReductionPctPerMall),
    maxFeeReductionPct: safePositiveNumber(marketFeeReduction.maxFeeReductionPct, marketConfig.shoppingMallBonus.maxFeeReductionPct)
  };
};

const getOwnedShoppingMallCountForMarket = (
  serverState: AnyRecord,
  playerId: string,
  buildingTypeId: string
): number => {
  if (!playerId) return 0;
  return Object.values(serverState?.buildingsById ?? {}).filter((building: any) =>
    building?.buildingTypeId === buildingTypeId
    && building?.ownerPlayerId === playerId
    && building?.status === "active"
  ).length;
};

const isPlainObject = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getStockExchangeMarketFeeReductionPct = (
  serverState: AnyRecord,
  playerId: string,
  marketType: MarketType | "player" | "emergency"
): number => {
  if (!playerId) return 0;
  const config = serverState?.config?.balance?.stockExchange ?? serverState?.balance?.stockExchange;
  if (!config) return 0;
  const tick = Number(serverState?.root?.tick ?? serverState?.serverInstance?.currentTick ?? 0);
  const building = Object.values(serverState?.buildingsById ?? {}).find((candidate: any) =>
    candidate?.buildingTypeId === (config.buildingTypeId ?? "stock_exchange")
    && candidate?.ownerPlayerId === playerId
    && candidate?.status === "active"
  ) as AnyRecord | undefined;
  if (!building) return 0;
  const metadata = isPlainObject(building.metadata?.stockExchange) ? building.metadata.stockExchange : {};
  if (Number(metadata.feeReductionDisabledUntilTick || 0) > tick) return 0;
  const base = marketType === "black"
    ? Number(config.marketFeeReduction?.blackMarketPct || 0)
    : marketType === "player"
      ? Number(config.marketFeeReduction?.playerMarketPct || 0)
      : Number(config.marketFeeReduction?.regularMarketPct || 0);
  const extra = Number(metadata.insiderWindowExpiresAtTick || 0) > tick
    ? Number(config.marketFeeReduction?.insiderExtraPct || 0)
    : 0;
  return Math.max(0, base + extra);
};

const getCentralBankMarketFeeReductionPct = (
  serverState: AnyRecord,
  playerId: string
): number => {
  if (!playerId) return 0;
  const config = serverState?.config?.balance?.centralBank ?? serverState?.balance?.centralBank;
  if (!config) return 0;
  const tick = Number(serverState?.root?.tick ?? serverState?.serverInstance?.currentTick ?? 0);
  const buildings = Object.values(serverState?.buildingsById ?? {}).filter((candidate: any) =>
    candidate?.buildingTypeId === (config.buildingTypeId ?? "central_bank")
    && candidate?.ownerPlayerId === playerId
    && candidate?.status === "active"
  ) as AnyRecord[];
  if (buildings.length <= 0) return 0;
  const tier = resolveCentralBankTierForMarket(config, buildings.length);
  if (!tier) return 0;
  const metadata = isPlainObject(buildings[0]?.metadata?.centralBank) ? buildings[0].metadata.centralBank : {};
  if (Number(metadata.feeReductionDisabledUntilTick || 0) > tick) return 0;
  const hasShoppingMall = getOwnedShoppingMallCountForMarket(serverState, playerId, "shopping_mall") > 0;
  const shoppingMallBonus = hasShoppingMall ? Number(config.synergies?.shoppingMallMarketFeeReductionPct || 0) : 0;
  const interventionBonus = Array.isArray(metadata.currencyInterventions) && metadata.currencyInterventions.some((effect: any) => Number(effect?.expiresAtTick || 0) > tick)
    ? Number(config.currencyIntervention?.holderMarketFeeReductionPct || 0)
    : 0;
  const frozenPenalty = Number(metadata.frozenAccountsExpiresAtTick || 0) > tick
    ? Number(config.frozenAccounts?.marketFeePenaltyPct || 0)
    : 0;
  return Math.max(0, Number(tier.marketFeeReductionPct || 0) + shoppingMallBonus + interventionBonus - frozenPenalty);
};

const getCentralBankMarketPressureReductionPct = (
  serverState: AnyRecord,
  category: string
): number => {
  const config = serverState?.config?.balance?.centralBank ?? serverState?.balance?.centralBank;
  if (!config) return 0;
  const tick = Number(serverState?.root?.tick ?? serverState?.serverInstance?.currentTick ?? 0);
  return Object.values(serverState?.buildingsById ?? {}).reduce((maxReduction: number, building: any) => {
    if (building?.buildingTypeId !== (config.buildingTypeId ?? "central_bank") || !building?.ownerPlayerId || building?.status !== "active") {
      return maxReduction;
    }
    const metadata = isPlainObject(building.metadata?.centralBank) ? building.metadata.centralBank : {};
    const active = Array.isArray(metadata.currencyInterventions)
      && metadata.currencyInterventions.some((effect: any) => String(effect?.category || "") === category && Number(effect?.expiresAtTick || 0) > tick);
    if (!active) return maxReduction;
    const hasStockExchange = Object.values(serverState?.buildingsById ?? {}).some((candidate: any) =>
      candidate?.buildingTypeId === "stock_exchange"
      && candidate?.ownerPlayerId === building.ownerPlayerId
      && candidate?.status === "active"
    );
    return Math.max(
      maxReduction,
      Number(config.currencyIntervention?.stockExchangeEffectReductionPct || 0)
        + (hasStockExchange ? Number(config.currencyIntervention?.stockExchangeSynergyEffectBonusPct || 0) : 0)
    );
  }, 0);
};

const resolveCentralBankTierForMarket = (config: AnyRecord, ownedCount: number): AnyRecord | null => {
  const tiers = Array.isArray(config.reserveTiers) ? config.reserveTiers : [];
  return tiers.find((tier: any) => ownedCount >= Number(tier?.minOwned || 0) && ownedCount <= Number(tier?.maxOwned || 0))
    ?? tiers.find((tier: any) => ownedCount >= Number(tier?.minOwned || 0))
    ?? null;
};

const getAirportImportDiscountPct = (
  serverState: AnyRecord,
  playerId: string,
  marketType: MarketType | "player" | "emergency",
  resourceId: MarketResourceId
): number => {
  if (!playerId) return 0;
  const config = serverState?.config?.balance?.airport ?? serverState?.balance?.airport;
  if (!config) return 0;
  const tick = Number(serverState?.root?.tick ?? serverState?.serverInstance?.currentTick ?? 0);
  const building = Object.values(serverState?.buildingsById ?? {}).find((candidate: any) =>
    candidate?.buildingTypeId === (config.buildingTypeId ?? "airport")
    && candidate?.ownerPlayerId === playerId
    && candidate?.status === "active"
  ) as AnyRecord | undefined;
  if (!building) return 0;
  const metadata = isPlainObject(building.metadata?.airport) ? building.metadata.airport : {};
  if (Number(metadata.discountDisabledUntilTick || 0) > tick) return 0;
  if (marketType === "black") return Math.max(0, Number(config.importDiscount?.blackMarketItemsPct || 0));
  if (marketType !== "normal") return 0;
  const category = getAirportImportCategoryForResource(resourceId);
  const shoppingMallBonus = category === "materials" && getOwnedShoppingMallCountForMarket(serverState, playerId, "shopping_mall") > 0
    ? Number(config.importDiscount?.shoppingMallMaterialsSynergyPct || 0)
    : 0;
  if (category === "materials") return Math.max(0, Number(config.importDiscount?.materialsPct || 0) + shoppingMallBonus);
  if (category === "rareComponents") return Math.max(0, Number(config.importDiscount?.rareComponentsPct || 0));
  return 0;
};

const getAirportImportCategoryForResource = (resourceId: MarketResourceId): string => {
  if (resourceId === "techCore") return "rareComponents";
  return "materials";
};

const getStockExchangeMarketPressureFactor = (
  serverState: AnyRecord,
  resourceId: MarketResourceId,
  marketType: MarketType
): number => {
  const tick = Number(serverState?.root?.tick ?? serverState?.serverInstance?.currentTick ?? 0);
  return Object.values(serverState?.buildingsById ?? {}).reduce((factor: number, building: any) => {
    const metadata = isPlainObject(building?.metadata?.stockExchange) ? building.metadata.stockExchange : {};
    const effects = Array.isArray(metadata.marketEffects) ? metadata.marketEffects : [];
    return effects.reduce((nextFactor: number, effect: any) => {
      if (Number(effect?.expiresAtTick || 0) <= tick || !isStockExchangeEffectCategoryForResource(String(effect?.category || ""), resourceId)) {
        return nextFactor;
      }
      const pct = marketType === "black"
        ? Number(effect.blackMarketPriceModifierPct || 0)
        : Number(effect.regularPriceModifierPct || 0);
      const centralBankReductionPct = getCentralBankMarketPressureReductionPct(serverState, String(effect.category || ""));
      return nextFactor * Math.max(0.1, 1 + pct * (1 - centralBankReductionPct / 100) / 100);
    }, factor);
  }, 1);
};

const isStockExchangeEffectCategoryForResource = (category: string, resourceId: MarketResourceId): boolean => {
  if (category === "materials") return resourceId === "metalParts" || resourceId === "chemicals" || resourceId === "biomass";
  if (category === "rareComponents") return resourceId === "techCore";
  if (category === "drugsAndBoosts") return resourceId === "chemicals" || resourceId === "biomass";
  if (category === "weapons" || category === "defenseItems") return resourceId === "metalParts" || resourceId === "techCore";
  return false;
};

const getMaxPlayerListingUnitPrice = (serverState: AnyRecord, resourceId: MarketResourceId): number =>
  Math.max(
    marketConfig.playerMarket.minUnitPrice,
    calculateMarketPrice(serverState, resourceId, "black").finalPrice * marketConfig.playerMarket.maxUnitPriceMultiplier
  );

const getActivePlayerListingCount = (market: ServerMarketState, sellerPlayerId: string, now: number): number =>
  market.playerListings.filter((listing) =>
    listing.status === "active"
    && listing.sellerPlayerId === sellerPlayerId
    && listing.expiresAt > now
  ).length;

const createPlayerMarketListingId = (now: number, seller: AnyRecord): string =>
  `player-market:${now}:${getPlayerId(seller) || "seller"}:${Math.random().toString(36).slice(2, 8)}`;

const getPlayerLabel = (player: AnyRecord): string => {
  const label = String(player?.name ?? player?.displayName ?? player?.identity ?? player?.username ?? player?.id ?? "Hráč").trim();
  return label || "Hráč";
};

const updateRollingVolume = (market: ServerMarketState, now: number): void => {
  const windowStart = now - marketConfig.demand.rollingWindowFreeSeconds * 1000;
  market.volumeEvents = market.volumeEvents.filter((event) => event.timestamp >= windowStart);
  market.rollingVolume = createEmptyRollingVolume();
  for (const event of market.volumeEvents) {
    market.rollingVolume[event.resourceId][event.type] += safeInteger(event.amount);
  }
};

const addRollingVolume = (
  market: ServerMarketState,
  resourceId: MarketResourceId,
  type: "buy" | "sell",
  amount: number,
  timestamp: number
): void => {
  market.volumeEvents.push({ timestamp, resourceId, type, amount: safeInteger(amount) });
  updateRollingVolume(market, timestamp);
};

const regenerateStock = (serverState: AnyRecord, now: number): void => {
  const market = (serverState.market && typeof serverState.market === "object")
    ? serverState.market as ServerMarketState
    : initializeServerMarket(serverState, now).market;
  const elapsedMinutes = Math.floor((now - market.lastStockRegenAt) / 60000);
  if (elapsedMinutes <= 0) {
    return;
  }

  const modeMultiplier = market.mode === "war" ? marketConfig.warModePriceMultipliers.stockRegenMultiplier : 1;
  const chaosPenalty = clamp(1 - Math.max(0, getChaosFactor(serverState) - 1) / (marketConfig.chaos.maxFactor - 1) * 0.3, 0.7, 1);
  for (const resourceId of marketResourceIds) {
    const regen = Math.floor(
      marketConfig.stockRegenPerMinute[resourceId]
      * elapsedMinutes
      * modeMultiplier
      * getEventStockRegenFactor(serverState, resourceId)
      * chaosPenalty
    );
    market.stock[resourceId] = clampStock(market.stock[resourceId] + regen, resourceId, market.mode);
  }
  market.lastStockRegenAt += elapsedMinutes * 60000;
};

const maybeSnapshotPrices = (serverState: AnyRecord, now: number): number => {
  const market = initializeServerMarket(serverState, now).market;
  const snapshotSeconds = market.mode === "war"
    ? marketConfig.priceHistory.warSnapshotSeconds
    : marketConfig.priceHistory.freeSnapshotSeconds;
  if (now - market.lastPriceSnapshotAt < snapshotSeconds * 1000) {
    return 0;
  }

  for (const resourceId of marketResourceIds) {
    market.priceHistory[resourceId].push({
      timestamp: now,
      normalPrice: calculateMarketPrice(serverState, resourceId, "normal").finalPrice,
      blackMarketPrice: calculateMarketPrice(serverState, resourceId, "black").finalPrice,
      stock: market.stock[resourceId],
      inflationFactor: getInflationFactor(serverState)
    });
    const limit = market.mode === "war" ? marketConfig.priceHistory.warLimit : marketConfig.priceHistory.freeLimit;
    market.priceHistory[resourceId] = market.priceHistory[resourceId].slice(-limit);
  }
  market.lastPriceSnapshotAt = now;
  return marketResourceIds.length;
};

const expireMarketEvents = (serverState: AnyRecord, now: number): string[] => {
  const market = initializeServerMarket(serverState, now).market;
  const expired = market.activeMarketEvents.filter((event) => event.expiresAt <= now).map((event) => event.id);
  if (expired.length > 0) {
    market.activeMarketEvents = market.activeMarketEvents.filter((event) => event.expiresAt > now);
  }
  return expired;
};

const expirePlayerMarketListings = (serverState: AnyRecord, now: number): string[] => {
  const state = initializeServerMarket(serverState, now);
  const expiredListings = state.market.playerListings.filter((listing) => listing.status === "active" && listing.expiresAt <= now);

  if (expiredListings.length <= 0) {
    return [];
  }

  for (const listing of expiredListings) {
    const seller = findPlayer(state, listing.sellerPlayerId);
    if (seller) {
      creditPlayerResource(state, seller, listing.resourceId, listing.amount);
    }
    appendGameLog(state, "market", `Hráčský bazar: nabídka ${listing.resourceId} expirovala.`, {
      playerId: listing.sellerPlayerId,
      resourceId: listing.resourceId,
      amount: listing.amount,
      listingId: listing.id
    });
  }

  state.market.playerListings = state.market.playerListings.filter((listing) => listing.status === "active" && listing.expiresAt > now);
  return expiredListings.map((listing) => listing.id);
};

const generateMarketWarnings = (serverState: AnyRecord, now: number): string[] => {
  const state = initializeServerMarket(serverState, now);
  const warnings: string[] = [];
  for (const resourceId of marketResourceIds) {
    const maxStock = getMaxStock(resourceId, state.market.mode);
    const stockRatio = maxStock > 0 ? state.market.stock[resourceId] / maxStock : 1;
    if (stockRatio < 0.15 && shouldEmitMarketWarning(state.market, `${resourceId}:low-stock`, now)) {
      const message = getLowStockRumor(resourceId);
      warnings.push(message);
      addRumor(state, message, { type: "market", resourceId, truth: 0.8, spread: 0.65, source: "system" });
    }

    const history = state.market.priceHistory[resourceId];
    const previous = history.at(-2);
    const current = history.at(-1);
    if (previous && current && previous.normalPrice > 0 && (current.normalPrice - previous.normalPrice) / previous.normalPrice >= 0.25 && shouldEmitMarketWarning(state.market, `${resourceId}:price-spike`, now)) {
      const message = `${marketConfig.resources[resourceId].name} mizí z trhu. Někdo staví něco velkého.`;
      warnings.push(message);
      addRumor(state, message, { type: "market", resourceId, truth: 0.7, spread: 0.6, source: "system" });
    }
  }
  return warnings;
};

const shouldEmitMarketWarning = (market: ServerMarketState, key: string, now: number): boolean => {
  const lastAt = safeTimestamp(market.warningFlags[key]);
  if (lastAt && now - lastAt < 5 * 60000) {
    return false;
  }
  market.warningFlags[key] = now;
  return true;
};

const getResourceWarnings = (
  serverState: AnyRecord,
  resourceId: MarketResourceId,
  normalPrice: number,
  blackPrice: number
): string[] => {
  const state = initializeServerMarket(serverState);
  const warnings: string[] = [];
  const maxStock = getMaxStock(resourceId, state.market.mode);
  const stockPercent = maxStock > 0 ? state.market.stock[resourceId] / maxStock : 1;
  const inflationLevel = getInflationLevel(state, getServerTotalMoney(state));
  if (stockPercent < 0.2) {
    warnings.push("Stock dochází");
  }
  if (inflationLevel.level === "rising" || inflationLevel.level === "high" || inflationLevel.level === "critical") {
    warnings.push("Cena roste kvůli inflaci");
  }
  if (blackPrice > normalPrice) {
    warnings.push("Black market je drahý, ale dostupný");
  }
  if (normalPrice * 100 >= marketConfig.largeTransactionValueFree.medium) {
    warnings.push("Velký nákup může přitáhnout policii");
  }
  if (resourceId === "techCore" && stockPercent < 0.35) {
    warnings.push("Tech Core je na serveru nedostatkové zboží");
  }
  return warnings;
};

const getInflationLevel = (serverState: AnyRecord, totalMoney: number): { level: "stable" | "rising" | "high" | "critical"; message: string } => {
  const baseline = getEconomyBaseline(resolveMarketMode(serverState));
  if (totalMoney >= baseline.inflationHardCap) {
    return {
      level: "critical",
      message: "Ekonomika je přehřátá. Black market diktuje město."
    };
  }
  if (totalMoney >= baseline.inflationSoftCap) {
    return {
      level: "high",
      message: "Inflace roste. Ceny na serveru se začínají trhat."
    };
  }
  if (totalMoney > baseline.inflationNeutralPoint) {
    return {
      level: "rising",
      message: "Ceny se zvedají s množstvím peněz na serveru."
    };
  }
  return {
    level: "stable",
    message: "Serverová ekonomika je stabilní."
  };
};

const applyBlackMarketHeat = (serverState: AnyRecord, player: AnyRecord, totalPrice: number, now: number): { heatAdded: number; policeSuspicionAdded: number } => {
  const heatAdded = getBlackMarketHeatForValue(totalPrice);
  const policeSuspicionAdded = Math.ceil(heatAdded * 0.5);
  addHeatToPlayer(serverState, player, heatAdded, "black_market_buy");
  addPoliceSuspicionToPlayer(serverState, player, policeSuspicionAdded, "black_market_buy");
  appendGameLog(serverState, "market", `Black market zvýšil heat o ${heatAdded}.`, {
    playerId: getPlayerId(player),
    heatAdded,
    policeSuspicionAdded,
    timestamp: now
  });
  return { heatAdded, policeSuspicionAdded };
};

const applyPlayerMarketDirtyTradeRisk = (serverState: AnyRecord, player: AnyRecord, totalPrice: number, now: number): { heatAdded: number; policeSuspicionAdded: number } => {
  const tierHeat = getBlackMarketHeatForValue(totalPrice);
  const heatAdded = Math.max(marketConfig.playerMarket.dirtyTradeHeat, Math.ceil(tierHeat * 0.35));
  const policeSuspicionAdded = Math.max(marketConfig.playerMarket.dirtyTradePoliceSuspicion, Math.ceil(heatAdded * 0.5));
  addHeatToPlayer(serverState, player, heatAdded, "player_market_dirty_trade");
  addPoliceSuspicionToPlayer(serverState, player, policeSuspicionAdded, "player_market_dirty_trade");
  appendGameLog(serverState, "market", "Hráčský bazar: dirty trade zvýšil heat.", {
    playerId: getPlayerId(player),
    totalPrice,
    heatAdded,
    policeSuspicionAdded,
    timestamp: now
  });
  return { heatAdded, policeSuspicionAdded };
};

const getBlackMarketHeatForValue = (totalPrice: number): number => {
  const tier = getTransactionTier(totalPrice);
  if (tier === "extreme") {
    return 10;
  }
  if (tier === "high") {
    return 6;
  }
  if (tier === "medium") {
    return 3;
  }
  return 1;
};

const applyTransactionRisk = (
  serverState: AnyRecord,
  player: AnyRecord,
  marketType: MarketType,
  totalPrice: number,
  now: number
): { auditTriggered: boolean; policeSuspicionAdded: number } => {
  const tier = getTransactionTier(totalPrice);
  if (tier === "small") {
    return { auditTriggered: false, policeSuspicionAdded: 0 };
  }

  const chance = marketConfig.largeTransactionRisk[marketType][tier];
  const roll = consumeMarketRandomRoll(serverState);
  if (roll > chance) {
    return { auditTriggered: false, policeSuspicionAdded: 0 };
  }

  const suspicion = marketType === "black"
    ? Math.ceil(getBlackMarketHeatForValue(totalPrice) * 0.75)
    : tier === "extreme" ? 5 : tier === "high" ? 3 : 1;
  addPoliceSuspicionToPlayer(serverState, player, suspicion, marketType === "black" ? "black_market_exposure" : "market_audit");
  notifyPoliceOfMarketActivity(serverState, player, {
    playerId: getPlayerId(player),
    marketType,
    totalPrice,
    tier,
    timestamp: now
  });
  addRumor(serverState, marketType === "black"
    ? "Black market zvedá ceny. Město smrdí panikou."
    : "Velký obchod přitáhl audit. Někdo nechal stopu v účetnictví.", {
    type: "market",
    playerId: getPlayerId(player),
    marketType,
    truth: marketType === "black" ? 0.7 : 0.5,
    spread: marketType === "black" ? 0.7 : 0.35,
    source: "system"
  });

  return { auditTriggered: true, policeSuspicionAdded: suspicion };
};

const getTransactionTier = (totalPrice: number): "small" | "medium" | "high" | "extreme" => {
  const safeTotal = safeInteger(totalPrice);
  if (safeTotal >= marketConfig.largeTransactionValueFree.extreme) {
    return "extreme";
  }
  if (safeTotal >= marketConfig.largeTransactionValueFree.high) {
    return "high";
  }
  if (safeTotal >= marketConfig.largeTransactionValueFree.medium) {
    return "medium";
  }
  return "small";
};

const maybeAddTransactionRumors = (
  serverState: AnyRecord,
  player: AnyRecord,
  resourceId: MarketResourceId,
  marketType: MarketType,
  totalPrice: number,
  amount: number,
  now: number
): void => {
  const tier = getTransactionTier(totalPrice);
  const state = initializeServerMarket(serverState, now);
  const maxStock = getMaxStock(resourceId, state.market.mode);
  const stockRatio = maxStock > 0 ? state.market.stock[resourceId] / maxStock : 1;
  if (stockRatio < 0.15) {
    addRumor(state, getLowStockRumor(resourceId), {
      type: "market",
      resourceId,
      truth: 0.8,
      spread: 0.65,
      source: "system"
    });
  }
  if (tier === "extreme") {
    addRumor(state, `${marketConfig.resources[resourceId].name} zmizelo ve velkém objemu. Někdo chystá tah.`, {
      type: "market",
      playerId: getPlayerId(player),
      resourceId,
      marketType,
      amount,
      truth: 0.65,
      spread: 0.7,
      source: "system"
    });
  }
};

const getLowStockRumor = (resourceId: MarketResourceId): string => {
  if (resourceId === "techCore") {
    return "Tech Core mizí z trhu. Někdo staví něco velkého.";
  }
  if (resourceId === "chemicals") {
    return "Chemicals jsou nedostatkové. Laboratoře začínají hladovět.";
  }
  if (resourceId === "biomass") {
    return "Biomass dochází. Levné vstupy najednou nejsou levné.";
  }
  return "Metal Parts mizí ze skladů. Ulice se připravuje na zbraně.";
};

const appendMarketTransaction = (serverState: AnyRecord, transaction: MarketTransaction): MarketTransaction => {
  const market = initializeServerMarket(serverState, transaction.timestamp).market;
  market.transactions.push(transaction);
  market.transactions = market.transactions.slice(-marketConfig.transactionLogLimit);
  return transaction;
};

const createInvalidPrice = (resourceId: MarketResourceId, marketType: MarketType): MarketPriceResult => ({
  resourceId,
  marketType,
  basePrice: 0,
  finalPrice: 0,
  factors: {
    demandFactor: 1,
    scarcityFactor: 1,
    chaosFactor: 1,
    inflationFactor: 1,
    eventFactor: 1,
    marketTypeFactor: 1
  }
});

const failMarketAction = (
  reason: string,
  message: string,
  extra: Partial<MarketActionResult> = {}
): MarketActionResult => ({
  success: false,
  reason,
  message,
  ...extra
});

const addHeatToPlayer = (serverState: AnyRecord, player: AnyRecord, amount: number, reason: string): void => {
  const safeAmount = safeInteger(amount);
  if (safeAmount <= 0) {
    return;
  }
  player.heat = safeInteger(player.heat) + safeAmount;
  player.heatLog = [...(Array.isArray(player.heatLog) ? player.heatLog : []), { reason, amount: safeAmount }];
  if (player.gang && typeof player.gang === "object") {
    player.gang.heat = safeInteger(player.gang.heat) + safeAmount;
  }
  if (player.policeStateId && serverState.policeStatesById) {
    const current = serverState.policeStatesById[player.policeStateId] ?? {
      id: player.policeStateId,
      ownerPlayerId: getPlayerId(player),
      heat: 0,
      wantedLevel: 0,
      lastDecayTick: serverState.root?.tick ?? 0,
      activeFlags: [],
      version: 0
    };
    serverState.policeStatesById[player.policeStateId] = {
      ...current,
      heat: safeInteger(current.heat) + safeAmount,
      version: safeInteger(current.version) + 1
    };
  }
};

const addPoliceSuspicionToPlayer = (serverState: AnyRecord, player: AnyRecord, amount: number, reason: string): void => {
  const safeAmount = safeInteger(amount);
  if (safeAmount <= 0) {
    return;
  }
  player.policeSuspicion = safeInteger(player.policeSuspicion) + safeAmount;
  player.policeSuspicionLog = [
    ...(Array.isArray(player.policeSuspicionLog) ? player.policeSuspicionLog : []),
    { reason, amount: safeAmount }
  ];
  if (player.police && typeof player.police === "object") {
    player.police.suspicion = safeInteger(player.police.suspicion) + safeAmount;
  }
};

const notifyPoliceOfMarketActivity = (serverState: AnyRecord, player: AnyRecord, payload: AnyRecord): void => {
  const handler = typeof serverState.notifyPoliceOfMarketActivity === "function"
    ? serverState.notifyPoliceOfMarketActivity
    : typeof serverState.policeAI?.notifyPoliceOfMarketActivity === "function"
      ? serverState.policeAI.notifyPoliceOfMarketActivity
      : null;

  if (handler) {
    try {
      handler(serverState, player, payload);
    } catch (error) {
      appendGameLog(serverState, "police", "Police market hook selhal bezpečně.", {
        ...payload,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return;
  }

  appendGameLog(serverState, "police", "Policie zaznamenala podezřelou market aktivitu.", payload);
};

const appendGameLog = (serverState: AnyRecord, type: string, message: string, payload: AnyRecord = {}): void => {
  const entry = { type, message, payload, createdAt: Date.now() };
  if (Array.isArray(serverState.eventLog)) {
    serverState.eventLog.push(entry);
  } else {
    serverState.eventLog = [entry];
  }
  if (serverState.eventsById && serverState.root) {
    const eventIds = Array.isArray(serverState.root.eventIds) ? serverState.root.eventIds : [];
    const tick = safeInteger(serverState.root.tick);
    const id = `event:market:${tick}:${eventIds.length}:${Math.random().toString(36).slice(2, 8)}`;
    eventIds.push(id);
    serverState.root.eventIds = eventIds;
    serverState.eventsById[id] = {
      id,
      serverInstanceId: serverState.serverInstance?.id ?? "local",
      eventTypeId: type,
      status: "resolved",
      scope: "server",
      targetIds: [payload.playerId, payload.resourceId].filter(Boolean),
      startTick: tick,
      endTick: tick,
      payload: { message, ...payload },
      version: 1
    };
  }
};

const addRumor = (serverState: AnyRecord, message: string, payload: AnyRecord): void => {
  const rumor = {
    id: `rumor:market:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    message,
    payload,
    createdAt: Date.now()
  };
  if (Array.isArray(serverState.rumors)) {
    serverState.rumors.push(rumor);
    return;
  }
  appendGameLog(serverState, "rumor", message, payload);
};

const consumeMarketRandomRoll = (serverState: AnyRecord): number => {
  const market = initializeServerMarket(serverState).market as ServerMarketState & { nextAuditRoll?: number; testRandomRoll?: number };
  const serverRoll = Number(serverState.marketAuditRoll ?? serverState.testRandomRoll);
  const roll = Number.isFinite(serverRoll)
    ? serverRoll
    : Number.isFinite(market.nextAuditRoll)
    ? Number(market.nextAuditRoll)
    : Number.isFinite(market.testRandomRoll)
      ? Number(market.testRandomRoll)
      : Math.random();
  delete serverState.marketAuditRoll;
  delete serverState.testRandomRoll;
  delete market.nextAuditRoll;
  delete market.testRandomRoll;
  return clamp(roll, 0, 1);
};

const resolveMarketMode = (serverState: AnyRecord): MarketModeId => {
  const mode = String(serverState.market?.mode ?? serverState.mode ?? serverState.serverInstance?.mode ?? serverState.root?.mode ?? "free").toLowerCase();
  return mode === "war" ? "war" : "free";
};

const clampStock = (stock: number, resourceId: MarketResourceId, mode: MarketModeId): number =>
  clamp(safeInteger(stock), 0, getMaxStock(resourceId, mode));

const createMarketTransactionId = (now: number, player: AnyRecord): string =>
  `market:${now}:${getPlayerId(player) || "player"}:${Math.random().toString(36).slice(2, 8)}`;

const safeInteger = (value: unknown): number =>
  Math.max(0, Math.floor(Number(value) || 0));

const safeNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const safePositiveNumber = (value: unknown, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const safeNumberWithDefault = (value: unknown, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const safeTimestamp = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const roundRatio = (value: number): number =>
  Math.round(value * 10000) / 10000;

const isVolumeEvent = (value: unknown): value is ServerMarketState["volumeEvents"][number] => {
  const event = value as Partial<ServerMarketState["volumeEvents"][number]>;
  return Boolean(event && marketResourceIds.includes(event.resourceId as MarketResourceId) && (event.type === "buy" || event.type === "sell"));
};

const isPriceSnapshot = (value: unknown): boolean => {
  const snapshot = value as AnyRecord;
  return Boolean(snapshot && Number.isFinite(Number(snapshot.timestamp)));
};

const isMarketTransaction = (value: unknown): value is MarketTransaction => {
  const transaction = value as Partial<MarketTransaction>;
  return Boolean(transaction && typeof transaction.id === "string" && marketResourceIds.includes(transaction.resourceId as MarketResourceId));
};

const isPlayerMarketListing = (value: unknown): value is PlayerMarketListing => {
  const listing = value as Partial<PlayerMarketListing>;
  return Boolean(
    listing
    && typeof listing.id === "string"
    && typeof listing.sellerPlayerId === "string"
    && marketResourceIds.includes(listing.resourceId as MarketResourceId)
    && (listing.paymentType === "cleanCash" || listing.paymentType === "dirtyCash")
    && (listing.status === "active" || listing.status === "sold" || listing.status === "cancelled" || listing.status === "expired")
  );
};

const isActiveMarketEvent = (value: unknown): value is ServerMarketState["activeMarketEvents"][number] => {
  const event = value as Partial<ServerMarketState["activeMarketEvents"][number]>;
  return Boolean(event && typeof event.id === "string" && typeof event.eventType === "string" && Number.isFinite(Number(event.expiresAt)));
};
