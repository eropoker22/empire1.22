import type { PlayerSalvagePoolEntry } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, FixedBuildingBalanceConfig, PowerStationBalanceConfig, RecyclingCenterBalanceConfig, WarehouseBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { getWarehouseCapacityForResource, resolveWarehouseStorageCapacity } from "./warehouseBuilding";

export interface RecyclingCenterNetworkMultipliers {
  incomeMultiplier: number;
  heatMultiplier: number;
}

export interface RecyclingCenterSalvageStats {
  ownedCount: number;
  salvageRatePct: number;
  freshPool: PlayerSalvagePoolEntry[];
  expiredPool: PlayerSalvagePoolEntry[];
}

export interface RecyclingCenterActionResolution {
  balances: Record<string, number>;
  playerSalvagePool: PlayerSalvagePoolEntry[];
  buildingMetadata?: CoreGameState["buildingsById"][string]["metadata"];
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  heatGain: number;
  influenceChange: number;
  inputCost: Record<string, number>;
  outputGain: Record<string, number>;
  reportText: string;
  recyclingResult: Record<string, unknown>;
}

export const getOwnedRecyclingCenterCount = (
  state: CoreGameState,
  playerId: string,
  config: RecyclingCenterBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveRecyclingCenterNetworkMultipliers = (
  count: number,
  config: RecyclingCenterBalanceConfig
): RecyclingCenterNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraCenter / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraCenter / 100)
  };
};

export const resolveRecyclingCenterSalvageRatePct = (
  count: number,
  config: RecyclingCenterBalanceConfig
): number => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return Math.min(config.salvage.maxRatePct, config.salvage.baseRatePct + extra * config.salvage.ratePctPerExtraCenter);
};

export const resolveRecyclingCenterSalvageStats = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: RecyclingCenterBalanceConfig;
  tickRateMs: number;
}): RecyclingCenterSalvageStats => {
  if (!input.config || !input.playerId) {
    return { ownedCount: 0, salvageRatePct: 0, freshPool: [], expiredPool: [] };
  }
  const config = input.config;
  const player = input.state.playersById[input.playerId];
  const pool = player?.salvagePool ?? [];
  const ttlTicks = Math.ceil(config.salvage.poolTtlMinutes * 60000 / Math.max(1, input.tickRateMs));
  const ttlMs = config.salvage.poolTtlMinutes * 60000;
  const freshEntries = pool.filter((entry) => isSalvageEntryFresh(entry, input.state.root.tick, ttlTicks, ttlMs));
  const freshPool = freshEntries.filter((entry) => isRecyclingRecoverableItem(entry.itemId, config));
  const expiredPool = pool.filter((entry) => !freshEntries.includes(entry));
  const ownedCount = getOwnedRecyclingCenterCount(input.state, input.playerId, config);
  return {
    ownedCount,
    salvageRatePct: resolveRecyclingCenterSalvageRatePct(ownedCount, config),
    freshPool,
    expiredPool
  };
};

export const appendSalvagePoolEntries = (
  state: CoreGameState,
  playerId: string | null | undefined,
  entries: Array<Omit<PlayerSalvagePoolEntry, "id" | "lostAtTick" | "lostAt">>,
  sourceId = "loss"
): CoreGameState => {
  if (!playerId || entries.length <= 0) return state;
  const player = state.playersById[playerId];
  if (!player) return state;
  const safeEntries = entries
    .filter((entry) => Math.floor(Number(entry.amount || 0)) > 0 && entry.itemId)
    .map((entry, index) => ({
      ...entry,
      amount: Math.floor(Number(entry.amount || 0)),
      id: `salvage:${state.root.tick}:${sourceId}:${index}:${entry.itemId}`,
      lostAtTick: state.root.tick,
      lostAt: new Date(0).toISOString()
    }));
  if (safeEntries.length <= 0) return state;
  return {
    ...state,
    playersById: {
      ...state.playersById,
      [player.id]: {
        ...player,
        salvagePool: [...(player.salvagePool ?? []), ...safeEntries],
        version: player.version + 1
      }
    }
  };
};

export const createSalvageEntriesFromLosses = (
  losses: Record<string, unknown> | undefined,
  source: string,
  config?: RecyclingCenterBalanceConfig
): Array<Omit<PlayerSalvagePoolEntry, "id" | "lostAtTick" | "lostAt">> =>
  Object.entries(losses ?? {}).flatMap(([itemId, amount]) => {
    const item = config?.salvage.recoverableItems[itemId];
    const safeAmount = Math.floor(Number(amount || 0));
    if (!item || safeAmount <= 0) {
      return [];
    }
    return [{
      itemId,
      itemName: item.itemName,
      category: item.category,
      amount: safeAmount,
      source
    }];
  });

export const resolveRecyclingCenterAction = (input: {
  state: CoreGameState;
  playerId: string;
  actionId: string;
  balances: Record<string, number>;
  recyclingCenterConfig: RecyclingCenterBalanceConfig;
  warehouseConfig?: WarehouseBalanceConfig;
  powerStationConfig?: PowerStationBalanceConfig;
  tickRateMs: number;
  random?: () => number;
}): RecyclingCenterActionResolution | null => {
  const config = input.recyclingCenterConfig;
  if (input.actionId !== config.extractLosses.actionId) return null;
  const stats = resolveRecyclingCenterSalvageStats({
    state: input.state,
    playerId: input.playerId,
    config,
    tickRateMs: input.tickRateMs
  });
  const nextBalances: Record<string, number> = {
    ...input.balances,
    cash: Math.max(0, Number(input.balances.cash || 0) - config.extractLosses.cleanCashCost)
  };
  const random = input.random ?? Math.random;
  const recovered: Record<string, number> = {};
  const recoveredByCategory: Record<string, number> = {};
  const lostByCapacity: Record<string, number> = {};
  const capacity = input.warehouseConfig
    ? resolveWarehouseStorageCapacity(input.state, input.playerId, input.warehouseConfig, input.powerStationConfig)
    : null;
  const rate = stats.salvageRatePct / 100;

  for (const entry of stats.freshPool) {
    const raw = Math.max(0, Number(entry.amount || 0)) * rate;
    let amount = Math.floor(raw);
    if (config.salvage.rareItems.includes(entry.itemId) && random() < raw - amount) {
      amount += 1;
    }
    if (amount <= 0) continue;
    const cap = capacity ? getWarehouseCapacityForResource(capacity, entry.itemId) : Number.POSITIVE_INFINITY;
    const current = Math.max(0, Number(nextBalances[entry.itemId] || 0));
    const accepted = Number.isFinite(cap) ? Math.max(0, Math.min(amount, cap - current)) : amount;
    const overflow = Math.max(0, amount - accepted);
    if (accepted > 0) {
      nextBalances[entry.itemId] = current + accepted;
      recovered[entry.itemId] = Math.max(0, Number(recovered[entry.itemId] || 0) + accepted);
      recoveredByCategory[entry.category] = Math.max(0, Number(recoveredByCategory[entry.category] || 0) + accepted);
    }
    if (overflow > 0) {
      lostByCapacity[entry.itemId] = Math.max(0, Number(lostByCapacity[entry.itemId] || 0) + overflow);
    }
  }

  return {
    balances: nextBalances,
    playerSalvagePool: [],
    heatGain: config.extractLosses.heatGain,
    influenceChange: 0,
    inputCost: { cash: config.extractLosses.cleanCashCost },
    outputGain: recovered,
    reportText: "Recyklační centrum vytěžilo část ztracených itemů ze šrotu.",
    recyclingResult: {
      type: "salvage_recovery",
      salvageRatePct: stats.salvageRatePct,
      recovered,
      recoveredByCategory,
      lostByCapacity,
      expiredCount: stats.expiredPool.reduce((total, entry) => total + Math.max(0, Number(entry.amount || 0)), 0),
      cleanCashCost: config.extractLosses.cleanCashCost,
      heatGain: config.extractLosses.heatGain,
      noPopulationRecovery: true
    }
  };
};

export const validateRecyclingCenterAction = (input: {
  state: CoreGameState;
  playerId: string;
  actionId: string;
  balances: Record<string, number>;
  recyclingCenterConfig?: RecyclingCenterBalanceConfig;
  tickRateMs: number;
}): string | null => {
  const config = input.recyclingCenterConfig;
  if (!config || input.actionId !== config.extractLosses.actionId) return null;
  if (Math.max(0, Number(input.balances.cash || 0)) < config.extractLosses.cleanCashCost) return "recycling_insufficient_clean_cash";
  const stats = resolveRecyclingCenterSalvageStats({
    state: input.state,
    playerId: input.playerId,
    config,
    tickRateMs: input.tickRateMs
  });
  return stats.freshPool.length > 0 ? null : "recycling_salvage_pool_empty";
};

export const applyRecyclingCenterIncomeModifiers = (input: {
  config: RecyclingCenterBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay,
      maxLevel: 1
    };
  }
  const network = resolveRecyclingCenterNetworkMultipliers(getOwnedRecyclingCenterCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
    dirtyPerHour: 0,
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: 0,
    maxLevel: 1
  };
};

const isSalvageEntryFresh = (
  entry: PlayerSalvagePoolEntry,
  nowTick: number,
  ttlTicks: number,
  ttlMs: number
): boolean => {
  const lostAtTick = Number(entry.lostAtTick);
  if (Number.isFinite(lostAtTick)) {
    return nowTick - Math.max(0, lostAtTick) <= ttlTicks;
  }
  const lostAtMs = entry.lostAt ? Date.parse(entry.lostAt) : Number.NaN;
  return Number.isFinite(lostAtMs) ? Date.now() - lostAtMs <= ttlMs : true;
};

const isRecyclingRecoverableItem = (
  itemId: string,
  config: RecyclingCenterBalanceConfig
): boolean =>
  Boolean(config.salvage.recoverableItems[String(itemId || "")]);
