import type { CarDealerBalanceConfig, FixedBuildingBalanceConfig, GarageBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import {
  getOwnedGarageCount,
  resolveGarageCooldownStats,
  type GarageCooldownCategory
} from "./garageBuildingActions";

export type CarDealerCooldownCategory =
  | GarageCooldownCategory
  | "retreatReturn"
  | "attackTravelTime"
  | "defenseReposition"
  | "clinicEvacuationRecovery"
  | "recyclingSalvageTransport"
  | "intelScan";

export interface CarDealerNetworkMultipliers {
  cleanIncomeMultiplier: number;
  dirtyIncomeMultiplier: number;
  heatMultiplier: number;
}

export interface CarDealerSupportStats {
  ownedCount: number;
  mobilityBonusPct: number;
  cooldownReductionPct: number;
  escapeChanceBonusPct: number;
  combinedGarageDealerCooldownReductionPct: number;
  combinedGarageDealerMaxReductionPct: number;
  fullBonusCategories: string[];
  halfBonusCategories: string[];
  smallBonusCategories: string[];
  excludedCategories: string[];
  escapeAppliesTo: string[];
}

const isCarDealerBuildingType = (buildingTypeId: string, config: CarDealerBalanceConfig): boolean =>
  buildingTypeId === config.buildingTypeId || (config.legacyBuildingTypeIds ?? []).includes(buildingTypeId);

const resolveScaleForCategory = (
  category: string,
  config: CarDealerBalanceConfig
): number =>
  config.cooldownReduction.fullBonusActionCategories.includes(category)
    ? 1
    : config.cooldownReduction.halfBonusActionCategories.includes(category)
      ? 0.5
      : config.cooldownReduction.smallBonusActionCategories.includes(category)
        ? 0.25
        : 0;

const resolveGarageReductionPctForCategory = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: GarageBalanceConfig;
  category: string;
}): number => {
  if (!input.config || !input.playerId) {
    return 0;
  }
  const garageCategory = input.category === "clinicEvacuationRecovery" ? "clinicRecovery" : input.category;
  const scale = input.config.cooldownReduction.fullBonusActionCategories.includes(garageCategory)
    ? 1
    : input.config.cooldownReduction.halfBonusActionCategories.includes(garageCategory)
      ? 0.5
      : 0;
  return Math.min(
    input.config.cooldownReduction.maxReductionPct,
    getOwnedGarageCount(input.state, input.playerId, input.config) * input.config.cooldownReduction.reductionPctPerGarage * scale
  );
};

export const getOwnedCarDealerCount = (
  state: CoreGameState,
  playerId: string,
  config: CarDealerBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    isCarDealerBuildingType(building.buildingTypeId, config)
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveCarDealerNetworkMultipliers = (
  count: number,
  config: CarDealerBalanceConfig
): CarDealerNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    cleanIncomeMultiplier: Math.min(config.network.maxCleanIncomeMultiplier, 1 + extra * config.network.cleanIncomeBonusPctPerExtraDealer / 100),
    dirtyIncomeMultiplier: Math.min(config.network.maxDirtyIncomeMultiplier, 1 + extra * config.network.dirtyIncomeBonusPctPerExtraDealer / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraDealer / 100)
  };
};

export const resolveCarDealerSupportStats = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: CarDealerBalanceConfig;
  garageConfig?: GarageBalanceConfig;
}): CarDealerSupportStats => {
  if (!input.config || !input.playerId) {
    return {
      ownedCount: 0,
      mobilityBonusPct: 0,
      cooldownReductionPct: 0,
      escapeChanceBonusPct: 0,
      combinedGarageDealerCooldownReductionPct: 0,
      combinedGarageDealerMaxReductionPct: input.config?.cooldownReduction.combinedGarageDealerMaxReductionPct ?? 22,
      fullBonusCategories: [],
      halfBonusCategories: [],
      smallBonusCategories: [],
      excludedCategories: [],
      escapeAppliesTo: []
    };
  }

  const ownedCount = getOwnedCarDealerCount(input.state, input.playerId, input.config);
  const cooldownReductionPct = Math.min(
    input.config.cooldownReduction.maxReductionPct,
    ownedCount * input.config.cooldownReduction.reductionPctPerDealer
  );
  const garageStats = input.garageConfig
    ? resolveGarageCooldownStats({
        state: input.state,
        playerId: input.playerId,
        config: input.garageConfig
      })
    : null;

  return {
    ownedCount,
    mobilityBonusPct: Math.min(input.config.mobility.maxBonusPct, ownedCount * input.config.mobility.bonusPctPerDealer),
    cooldownReductionPct,
    escapeChanceBonusPct: Math.min(input.config.escapeChance.maxBonusPct, ownedCount * input.config.escapeChance.bonusPctPerDealer),
    combinedGarageDealerCooldownReductionPct: Math.min(
      input.config.cooldownReduction.combinedGarageDealerMaxReductionPct,
      cooldownReductionPct + (garageStats?.cooldownReductionPct ?? 0)
    ),
    combinedGarageDealerMaxReductionPct: input.config.cooldownReduction.combinedGarageDealerMaxReductionPct,
    fullBonusCategories: [...input.config.cooldownReduction.fullBonusActionCategories],
    halfBonusCategories: [...input.config.cooldownReduction.halfBonusActionCategories],
    smallBonusCategories: [...input.config.cooldownReduction.smallBonusActionCategories],
    excludedCategories: [...input.config.cooldownReduction.excludedActionCategories],
    escapeAppliesTo: [...input.config.escapeChance.appliesTo]
  };
};

export const resolveCarDealerCooldownMultiplier = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: CarDealerBalanceConfig;
  garageConfig?: GarageBalanceConfig;
  category: CarDealerCooldownCategory;
}): number => {
  if (!input.playerId) {
    return 1;
  }
  if (!input.config) {
    const garageReductionPct = resolveGarageReductionPctForCategory({
      state: input.state,
      playerId: input.playerId,
      config: input.garageConfig,
      category: input.category
    });
    return 1 - garageReductionPct / 100;
  }
  if (input.config.cooldownReduction.excludedActionCategories.includes(input.category)) {
    return 1;
  }

  const stats = resolveCarDealerSupportStats({
    state: input.state,
    playerId: input.playerId,
    config: input.config,
    garageConfig: input.garageConfig
  });
  const scale = resolveScaleForCategory(input.category, input.config);
  if (scale <= 0) {
    return 1;
  }

  const dealerReductionPct = Math.min(input.config.cooldownReduction.maxReductionPct, stats.cooldownReductionPct * scale);
  const garageReductionPct = resolveGarageReductionPctForCategory({
    state: input.state,
    playerId: input.playerId,
    config: input.garageConfig,
    category: input.category
  });
  const combinedReductionPct = Math.min(
    input.config.cooldownReduction.combinedGarageDealerMaxReductionPct,
    dealerReductionPct + garageReductionPct
  );
  return Math.max(1 - input.config.cooldownReduction.combinedGarageDealerMaxReductionPct / 100, 1 - combinedReductionPct / 100);
};

export const applyCarDealerCooldownReductionTicks = (input: {
  baseTicks: number;
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: CarDealerBalanceConfig;
  garageConfig?: GarageBalanceConfig;
  category: CarDealerCooldownCategory;
}): number => {
  const baseTicks = Math.max(0, Math.ceil(Number(input.baseTicks || 0)));
  if (baseTicks <= 0) {
    return 0;
  }
  const multiplier = resolveCarDealerCooldownMultiplier({
    state: input.state,
    playerId: input.playerId,
    config: input.config,
    garageConfig: input.garageConfig,
    category: input.category
  });
  return Math.max(1, Math.ceil(baseTicks * multiplier));
};

export const resolveCarDealerCategoryForBuildingAction = (
  buildingTypeId: string,
  actionId: string
): CarDealerCooldownCategory | null => {
  if (buildingTypeId === "clinic" && actionId === "stabilization_protocol") {
    return "clinicEvacuationRecovery";
  }
  if (buildingTypeId === "recycling_center" && actionId === "extract_losses") {
    return "recyclingSalvageTransport";
  }
  return null;
};

export const resolveCarDealerEscapeChanceBonusPct = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: CarDealerBalanceConfig;
}): number => {
  if (!input.config || !input.playerId) {
    return 0;
  }
  const ownedCount = getOwnedCarDealerCount(input.state, input.playerId, input.config);
  return Math.min(input.config.escapeChance.maxBonusPct, ownedCount * input.config.escapeChance.bonusPctPerDealer);
};

export const applyCarDealerIncomeModifiers = (input: {
  config: CarDealerBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  if (!isCarDealerBuildingType(input.building.buildingTypeId, input.config) || !input.building.ownerPlayerId) {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay,
      maxLevel: 1
    };
  }
  const network = resolveCarDealerNetworkMultipliers(getOwnedCarDealerCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * network.cleanIncomeMultiplier,
    dirtyPerHour: input.dirtyPerHour * network.dirtyIncomeMultiplier,
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: input.influencePerDay,
    maxLevel: 1
  };
};
