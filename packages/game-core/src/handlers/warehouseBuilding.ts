import type { PowerStationBalanceConfig, WarehouseBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { FixedBuildingBalanceConfig } from "../contracts";
import { resolvePowerStationInfrastructureMultiplier } from "./powerStationBuildingActions";

export interface WarehouseNetworkMultipliers {
  incomeMultiplier: number;
  storageCapacityMultiplier: number;
  heatMultiplier: number;
}

export interface WarehouseStorageCapacity {
  genericResources: number;
  chemicals: number;
  biomass: number;
  metalParts: number;
  techCore: number;
  combatModule: number;
  drugsAndBoosts: number;
  weaponsAndDefense: number;
  storageCapacityBonus: number;
}

export const getOwnedWarehouseCount = (
  state: CoreGameState,
  playerId: string,
  config: WarehouseBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveWarehouseNetworkMultipliers = (
  count: number,
  config: WarehouseBalanceConfig
): WarehouseNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    incomeMultiplier: Math.min(
      config.network.maxIncomeMultiplier,
      1 + extra * config.network.incomeBonusPctPerExtraWarehouse / 100
    ),
    storageCapacityMultiplier: Math.min(
      config.network.maxStorageCapacityMultiplier,
      1 + extra * config.network.storageCapacityBonusPctPerExtraWarehouse / 100
    ),
    heatMultiplier: Math.min(
      config.network.maxHeatMultiplier,
      1 + extra * config.network.heatBonusPctPerExtraWarehouse / 100
    )
  };
};

export const resolveWarehouseStorageCapacity = (
  state: CoreGameState,
  playerId: string,
  config: WarehouseBalanceConfig,
  powerStationConfig?: PowerStationBalanceConfig
): WarehouseStorageCapacity => {
  const ownedWarehouses = Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  );
  const multiplier = resolveWarehouseNetworkMultipliers(ownedWarehouses.length, config).storageCapacityMultiplier;
  const infrastructureMultiplier = resolvePowerStationInfrastructureMultiplier({
    state,
    playerId,
    config: powerStationConfig,
    tick: state.root.tick,
    target: "warehouseStorageCapacity"
  });
  const upgradeMultiplierTotal = ownedWarehouses.reduce(
    (total, building) => total + (1 + getWarehouseUpgrade(config, building.level).storageBonusPct / 100),
    0
  );
  const scale = (amount: number) => Math.floor(Math.max(0, amount) * upgradeMultiplierTotal * multiplier * infrastructureMultiplier);
  return {
    genericResources: scale(config.storageCapacities.genericResources),
    chemicals: scale(config.storageCapacities.chemicals),
    biomass: scale(config.storageCapacities.biomass),
    metalParts: scale(config.storageCapacities.metalParts),
    techCore: scale(config.storageCapacities.techCore),
    combatModule: scale(config.storageCapacities.combatModule),
    drugsAndBoosts: scale(config.storageCapacities.drugsAndBoosts),
    weaponsAndDefense: scale(config.storageCapacities.weaponsAndDefense),
    storageCapacityBonus: scale(config.storageCapacityBonus)
  };
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
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay,
      maxLevel: 4
    };
  }
  const count = getOwnedWarehouseCount(input.state, input.building.ownerPlayerId, input.config);
  const network = resolveWarehouseNetworkMultipliers(count, input.config);
  const upgrade = getWarehouseUpgrade(input.config, input.building.level);
  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier * (1 + upgrade.incomeBonusPct / 100),
    dirtyPerHour: 0,
    heatPerDay: input.heatPerDay * network.heatMultiplier * (1 - upgrade.heatReductionPct / 100),
    influencePerDay: 0,
    maxLevel: 4
  };
};

const getWarehouseUpgrade = (
  config: WarehouseBalanceConfig,
  level: unknown
): { incomeBonusPct: number; storageBonusPct: number; heatReductionPct: number } => {
  const safeLevel = Math.max(1, Math.min(4, Math.floor(Number(level || 1))));
  const upgrade = config.upgrades?.[safeLevel];
  return {
    incomeBonusPct: Math.max(0, Number(upgrade?.incomeBonusPct || 0)),
    storageBonusPct: Math.max(0, Number(upgrade?.storageBonusPct || 0)),
    heatReductionPct: Math.max(0, Number(upgrade?.heatReductionPct || 0))
  };
};

export const getWarehouseCapacityForResource = (
  capacity: WarehouseStorageCapacity,
  resourceKey: string
): number => {
  switch (resourceKey) {
    case "chemicals":
      return capacity.chemicals;
    case "biomass":
      return capacity.biomass;
    case "metal-parts":
      return capacity.metalParts;
    case "tech-core":
      return capacity.techCore;
    case "combat-module":
    case "combatModule":
      return capacity.combatModule;
    case "stim-pack":
    case "neon-dust":
    case "pulse-shot":
    case "velvet-smoke":
    case "ghost-serum":
    case "overdrive-x":
      return capacity.drugsAndBoosts;
    case "pistol":
    case "smg":
    case "grenade":
    case "vest":
    case "barricades":
    case "cameras":
    case "defense-tower":
    case "alarm":
      return capacity.weaponsAndDefense;
    default:
      return capacity.genericResources || capacity.storageCapacityBonus;
  }
};
