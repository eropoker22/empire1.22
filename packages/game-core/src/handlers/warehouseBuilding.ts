import type { WarehouseBalanceConfig } from "../contracts";
import type { FixedBuildingBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import {
  getOwnedWarehouseCount,
  resolvePlayerStorageCapacitySummary,
  resolveWarehouseCountMultiplier
} from "./storageCapacityResolver";
import {
  normalizeStorageResourceKey,
  StorageCapacityError,
  type PlayerStorageCapacitySummary
} from "./storageCapacityTypes";

export * from "./storageCapacityTypes";
export * from "./storageCapacityResolver";
export * from "./storageCapacityCredit";
export * from "./storageCapacityMigration";

export interface WarehouseNetworkMultipliers {
  incomeMultiplier: number;
  /** Compatibility value only. Global capacity uses the canonical storage summary. */
  storageCapacityMultiplier: number;
  heatMultiplier: number;
}

/** Compatibility alias. The old flat capacity map is no longer authoritative. */
export type WarehouseStorageCapacity = PlayerStorageCapacitySummary;

export const resolveWarehouseNetworkMultipliers = (
  count: number,
  config: WarehouseBalanceConfig
): WarehouseNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraWarehouse / 100),
    storageCapacityMultiplier: resolveWarehouseCountMultiplier(count, config),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraWarehouse / 100)
  };
};

export const resolveWarehouseStorageCapacity = (
  state: CoreGameState,
  playerId: string,
  config: WarehouseBalanceConfig
): WarehouseStorageCapacity => resolvePlayerStorageCapacitySummary(state, playerId, config);

export const getWarehouseCapacityForResource = (
  summary: WarehouseStorageCapacity,
  resourceKey: string
): number => {
  const canonicalKey = normalizeStorageResourceKey(resourceKey);
  const item = summary.groups.flatMap((group) => group.items).find((candidate) => candidate.resourceKey === canonicalKey);
  if (!item) {
    throw new StorageCapacityError(canonicalKey);
  }
  return item.maxAmount;
};

export const applyWarehouseIncomeModifiers = (input: {
  config: WarehouseBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId || !input.building.ownerPlayerId) {
    return { cleanPerHour: input.cleanPerHour, dirtyPerHour: input.dirtyPerHour, heatPerDay: input.heatPerDay, influencePerDay: input.influencePerDay, maxLevel: 4 };
  }
  const network = resolveWarehouseNetworkMultipliers(getOwnedWarehouseCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  const upgrade = input.config.upgrades?.[Math.max(1, Math.min(4, Math.floor(Number(input.building.level || 1))))];
  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier * (1 + Math.max(0, Number(upgrade?.incomeBonusPct || 0)) / 100),
    dirtyPerHour: 0,
    heatPerDay: input.heatPerDay * network.heatMultiplier * (1 - Math.max(0, Number(upgrade?.heatReductionPct || 0)) / 100),
    influencePerDay: 0,
    maxLevel: 4
  };
};
