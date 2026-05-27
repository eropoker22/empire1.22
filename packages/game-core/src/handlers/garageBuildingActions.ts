import type { FixedBuildingBalanceConfig, GarageBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";

export type GarageCooldownCategory =
  | "gangMovement"
  | "attackPreparation"
  | "districtOccupy"
  | "districtRobbery"
  | "equipmentTransfer"
  | "resourceTransfer"
  | "defenseRepair"
  | "defenseRestore"
  | "districtSpy"
  | "trapDetection"
  | "clinicRecovery"
  | "factoryProductionActions"
  | "armoryProductionActions"
  | "moneyLaundering"
  | "casinoActions"
  | "exchangeOfficeActions"
  | "arcadeLaunderingActions"
  | "vipBoosts"
  | "rumorGeneration"
  | "passiveProduction";

export interface GarageNetworkMultipliers {
  incomeMultiplier: number;
  heatMultiplier: number;
}

export interface GarageCooldownStats {
  ownedCount: number;
  cooldownReductionPct: number;
  fullBonusCategories: string[];
  halfBonusCategories: string[];
  excludedCategories: string[];
}

export const getOwnedGarageCount = (
  state: CoreGameState,
  playerId: string,
  config: GarageBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveGarageNetworkMultipliers = (
  count: number,
  config: GarageBalanceConfig
): GarageNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    incomeMultiplier: Math.min(config.network.maxIncomeMultiplier, 1 + extra * config.network.incomeBonusPctPerExtraGarage / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraGarage / 100)
  };
};

export const resolveGarageCooldownStats = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: GarageBalanceConfig;
}): GarageCooldownStats => {
  if (!input.config || !input.playerId) {
    return {
      ownedCount: 0,
      cooldownReductionPct: 0,
      fullBonusCategories: [],
      halfBonusCategories: [],
      excludedCategories: []
    };
  }
  const ownedCount = getOwnedGarageCount(input.state, input.playerId, input.config);
  return {
    ownedCount,
    cooldownReductionPct: Math.min(
      input.config.cooldownReduction.maxReductionPct,
      ownedCount * input.config.cooldownReduction.reductionPctPerGarage
    ),
    fullBonusCategories: [...input.config.cooldownReduction.fullBonusActionCategories],
    halfBonusCategories: [...input.config.cooldownReduction.halfBonusActionCategories],
    excludedCategories: [...input.config.cooldownReduction.excludedActionCategories]
  };
};

export const resolveGarageCooldownMultiplier = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: GarageBalanceConfig;
  category: GarageCooldownCategory;
}): number => {
  if (!input.config || !input.playerId) {
    return 1;
  }
  const stats = resolveGarageCooldownStats({
    state: input.state,
    playerId: input.playerId,
    config: input.config
  });
  const category = input.category;
  const reductionScale = input.config.cooldownReduction.fullBonusActionCategories.includes(category)
    ? 1
    : input.config.cooldownReduction.halfBonusActionCategories.includes(category)
      ? 0.5
      : 0;
  const reductionPct = Math.min(input.config.cooldownReduction.maxReductionPct, stats.cooldownReductionPct * reductionScale);
  return Math.max(1 - input.config.cooldownReduction.maxReductionPct / 100, 1 - reductionPct / 100);
};

export const applyGarageCooldownReductionTicks = (input: {
  baseTicks: number;
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: GarageBalanceConfig;
  category: GarageCooldownCategory;
}): number => {
  const baseTicks = Math.max(0, Math.ceil(Number(input.baseTicks || 0)));
  if (baseTicks <= 0) {
    return 0;
  }
  const multiplier = resolveGarageCooldownMultiplier({
    state: input.state,
    playerId: input.playerId,
    config: input.config,
    category: input.category
  });
  return Math.max(1, Math.ceil(baseTicks * multiplier));
};

export const resolveGarageCategoryForBuildingAction = (
  buildingTypeId: string,
  actionId: string
): GarageCooldownCategory | null => {
  if (buildingTypeId === "clinic" && actionId === "stabilization_protocol") {
    return "clinicRecovery";
  }
  return null;
};

export const applyGarageIncomeModifiers = (input: {
  config: GarageBalanceConfig;
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
  const network = resolveGarageNetworkMultipliers(getOwnedGarageCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * network.incomeMultiplier,
    dirtyPerHour: 0,
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: 0,
    maxLevel: 1
  };
};
