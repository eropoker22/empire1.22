import type { WarehouseBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import {
  getStorageResourceLabel,
  normalizeStorageBalances,
  normalizeStorageResourceKey,
  PlayerStorageCapacitySummary,
  PlayerStorageItemSummary,
  STORAGE_CAPACITY_GROUP_IDS,
  StorageCapacityError,
  WarehouseUpgradeCapacityPreview
} from "./storageCapacityTypes";

export const getOwnedWarehouseCount = (
  state: CoreGameState,
  playerId: string,
  config: WarehouseBalanceConfig
): number => getActiveOwnedWarehouses(state, playerId, config).length;

export const resolveWarehouseCountMultiplier = (
  warehouseCount: number,
  config: WarehouseBalanceConfig
): number => {
  const tier = Math.min(5, Math.max(0, Math.floor(Number(warehouseCount || 0)))) as 0 | 1 | 2 | 3 | 4 | 5;
  return Number(config.warehouseCountMultipliers[tier]);
};

export const resolveHighestWarehouseLevelMultiplier = (
  highestLevel: number,
  config: WarehouseBalanceConfig
): number => {
  const level = Math.min(4, Math.max(1, Math.floor(Number(highestLevel || 1)))) as 1 | 2 | 3 | 4;
  return Number(config.warehouseLevelMultipliers[level]);
};

export const resolvePlayerStorageCapacitySummary = (
  state: CoreGameState,
  playerId: string,
  config: WarehouseBalanceConfig
): PlayerStorageCapacitySummary => {
  const warehouses = getActiveOwnedWarehouses(state, playerId, config);
  const ownedWarehouseCount = warehouses.length;
  const highestWarehouseLevel = warehouses.reduce(
    (highest, building) => Math.max(highest, Math.max(1, Math.floor(Number(building.level || 1)))),
    0
  );
  const warehouseCountMultiplier = resolveWarehouseCountMultiplier(ownedWarehouseCount, config);
  const warehouseLevelMultiplier = resolveHighestWarehouseLevelMultiplier(highestWarehouseLevel || 1, config);
  const totalCapacityMultiplier = warehouseCountMultiplier * warehouseLevelMultiplier;
  const player = state.playersById[playerId];
  const balances = normalizeStorageBalances(player ? state.resourceStatesById[player.resourceStateId]?.balances ?? {} : {});

  return {
    warehouseSummary: { ownedWarehouseCount, highestWarehouseLevel, warehouseCountMultiplier, warehouseLevelMultiplier, totalCapacityMultiplier },
    groups: STORAGE_CAPACITY_GROUP_IDS.map((groupId) => {
      const group = config.storageCapacityGroups[groupId];
      const currentCapacity = Math.ceil(group.baseCapacity * totalCapacityMultiplier);
      return {
        id: groupId,
        label: group.label,
        baseCapacity: group.baseCapacity,
        currentCapacity,
        items: group.resourceKeys.map((resourceKey) => createStorageItemSummary(
          normalizeStorageResourceKey(resourceKey), balances, currentCapacity
        ))
      };
    })
  };
};

export const resolveResourceCapacity = (
  state: CoreGameState,
  playerId: string,
  resourceKey: string,
  config: WarehouseBalanceConfig
): number => {
  const canonicalKey = normalizeStorageResourceKey(resourceKey);
  const summary = resolvePlayerStorageCapacitySummary(state, playerId, config);
  for (const group of summary.groups) {
    const item = group.items.find((candidate) => candidate.resourceKey === canonicalKey);
    if (item) return item.maxAmount;
  }
  throw new StorageCapacityError(canonicalKey);
};

export const resolveWarehouseUpgradeCapacityPreview = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  config: WarehouseBalanceConfig
): WarehouseUpgradeCapacityPreview | null => {
  if (building.buildingTypeId !== config.buildingTypeId || !building.ownerPlayerId || building.status !== "active" || building.level >= 4) {
    return null;
  }
  const beforeSummary = resolvePlayerStorageCapacitySummary(state, building.ownerPlayerId, config);
  const futureState: CoreGameState = {
    ...state,
    buildingsById: { ...state.buildingsById, [building.id]: { ...building, level: Math.min(4, Math.max(1, building.level + 1)) } }
  };
  const afterSummary = resolvePlayerStorageCapacitySummary(futureState, building.ownerPlayerId, config);
  const before = beforeSummary.groups.map((group) => ({ id: group.id, label: group.label, capacity: group.currentCapacity }));
  const after = afterSummary.groups.map((group) => ({ id: group.id, label: group.label, capacity: group.currentCapacity }));
  const capacityIncreases = after.some((group, index) => group.capacity > before[index]!.capacity);
  return {
    before,
    after,
    capacityIncreases,
    noIncreaseReason: capacityIncreases ? null : "Kapacita se tímto upgradem nyní nezvýší, protože jiné aktivní Skladiště už má vyšší level."
  };
};

const getActiveOwnedWarehouses = (
  state: CoreGameState,
  playerId: string,
  config: WarehouseBalanceConfig
) => Object.values(state.buildingsById).filter((building) =>
  building.buildingTypeId === config.buildingTypeId && building.ownerPlayerId === playerId && building.status === "active"
);

const createStorageItemSummary = (
  resourceKey: string,
  balances: Record<string, number>,
  maxAmount: number
): PlayerStorageItemSummary => {
  const currentAmount = Math.max(0, Number(balances[resourceKey] || 0));
  const fillPercent = maxAmount <= 0 ? 0 : currentAmount / maxAmount * 100;
  return {
    resourceKey,
    label: getStorageResourceLabel(resourceKey),
    currentAmount,
    maxAmount,
    fillPercent,
    isNearCapacity: currentAmount >= maxAmount * 0.8 && currentAmount < maxAmount,
    isFull: currentAmount === maxAmount,
    isOverCapacity: currentAmount > maxAmount
  };
};
