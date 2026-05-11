import type {
  MarketResourceId,
  ServerMarketState
} from "./serverMarketSystem";

type AnyRecord = Record<string, any>;

const marketResourceIds = ["metalParts", "techCore", "chemicals", "biomass"] as const;
export const cloneServerState = <T extends AnyRecord>(state: T): T => {
  const next: AnyRecord = { ...state };
  cloneRecordMap(next, state, "playersById", cloneEntity);
  cloneRecordMap(next, state, "resourceStatesById", cloneResourceState);
  cloneRecordMap(next, state, "policeStatesById", cloneEntity);
  cloneRecordMap(next, state, "districtsById", cloneEntity);
  cloneRecordMap(next, state, "eventsById", cloneEntity);
  if (Array.isArray(state.players)) {
    next.players = state.players.map(cloneEntity);
  }
  if (Array.isArray(state.eventLog)) {
    next.eventLog = state.eventLog.map(cloneEntity);
  }
  if (Array.isArray(state.rumors)) {
    next.rumors = state.rumors.map(cloneEntity);
  }
  if (state.market && typeof state.market === "object") {
    next.market = cloneMarketState(state.market);
  }
  if (state.root && typeof state.root === "object") {
    next.root = {
      ...state.root,
      eventIds: Array.isArray(state.root.eventIds) ? [...state.root.eventIds] : state.root.eventIds
    };
  }
  return next as T;
};

const cloneRecordMap = (
  next: AnyRecord,
  state: AnyRecord,
  key: string,
  cloneValue: (value: AnyRecord) => AnyRecord
): void => {
  const record = state[key];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return;
  }
  next[key] = Object.fromEntries(Object.entries(record).map(([entryKey, value]) => [
    entryKey,
    value && typeof value === "object" ? cloneValue(value as AnyRecord) : value
  ]));
};

export const cloneEntity = <T extends AnyRecord>(entity: T): T => {
  const next: AnyRecord = { ...entity };
  if (entity.resources && typeof entity.resources === "object") {
    next.resources = { ...entity.resources };
  }
  if (entity.economy && typeof entity.economy === "object") {
    next.economy = { ...entity.economy };
  }
  if (entity.gang && typeof entity.gang === "object") {
    next.gang = { ...entity.gang };
  }
  if (entity.police && typeof entity.police === "object") {
    next.police = { ...entity.police };
  }
  return next as T;
};

const cloneResourceState = <T extends AnyRecord>(resourceState: T): T => ({
  ...resourceState,
  balances: resourceState.balances && typeof resourceState.balances === "object"
    ? { ...resourceState.balances }
    : resourceState.balances
});

const cloneMarketState = (market: Partial<ServerMarketState>): ServerMarketState => ({
  mode: market.mode === "war" ? "war" : "free",
  stock: { ...(market.stock ?? {}) } as Record<MarketResourceId, number>,
  rollingVolume: Object.fromEntries(marketResourceIds.map((resourceId) => [
    resourceId,
    { ...(market.rollingVolume?.[resourceId] ?? { buy: 0, sell: 0 }) }
  ])) as Record<MarketResourceId, { buy: number; sell: number }>,
  volumeEvents: Array.isArray(market.volumeEvents) ? market.volumeEvents.map((event) => ({ ...event })) : [],
  priceHistory: clonePriceHistory(market.priceHistory),
  transactions: Array.isArray(market.transactions) ? market.transactions.map((transaction) => ({ ...transaction })) : [],
  playerListings: Array.isArray(market.playerListings) ? market.playerListings.map((listing) => ({ ...listing })) : [],
  activeMarketEvents: Array.isArray(market.activeMarketEvents) ? market.activeMarketEvents.map((event) => ({ ...event })) : [],
  lastStockRegenAt: safeTimestamp(market.lastStockRegenAt),
  lastPriceSnapshotAt: safeTimestamp(market.lastPriceSnapshotAt),
  warningFlags: { ...(market.warningFlags ?? {}) }
});

export const clonePriceHistory = (priceHistory: Partial<ServerMarketState["priceHistory"]> | undefined): ServerMarketState["priceHistory"] =>
  Object.fromEntries(marketResourceIds.map((resourceId) => [
    resourceId,
    Array.isArray(priceHistory?.[resourceId]) ? priceHistory[resourceId]!.map((entry) => ({ ...entry })) : []
  ])) as ServerMarketState["priceHistory"];
const safeTimestamp = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};
