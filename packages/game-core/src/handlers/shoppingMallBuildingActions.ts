import type { FixedBuildingBalanceConfig, ShoppingMallBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";

export interface ShoppingMallNetworkMultipliers {
  cleanIncomeMultiplier: number;
  dirtyIncomeMultiplier: number;
  influenceMultiplier: number;
  heatMultiplier: number;
}

export interface ShoppingMallMarketBonuses {
  ownedCount: number;
  regularMarketDiscountPct: number;
  blackMarketDiscountPct: number;
  playerMarketDiscountPct: number;
  emergencyMarketDiscountPct: number;
  marketFeeReductionPct: number;
  minFinalPriceMultiplier: number;
}

export const getOwnedShoppingMallCount = (
  state: CoreGameState,
  playerId: string,
  config: ShoppingMallBalanceConfig
): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === config.buildingTypeId
    && building.ownerPlayerId === playerId
    && building.status === "active"
  ).length;

export const resolveShoppingMallNetworkMultipliers = (
  count: number,
  config: ShoppingMallBalanceConfig
): ShoppingMallNetworkMultipliers => {
  const extra = Math.max(0, Math.floor(Number(count || 0)) - 1);
  return {
    cleanIncomeMultiplier: Math.min(config.network.maxCleanIncomeMultiplier, 1 + extra * config.network.cleanIncomeBonusPctPerExtraMall / 100),
    dirtyIncomeMultiplier: Math.min(config.network.maxDirtyIncomeMultiplier, 1 + extra * config.network.dirtyIncomeBonusPctPerExtraMall / 100),
    influenceMultiplier: Math.min(config.network.maxInfluenceMultiplier, 1 + extra * config.network.influenceBonusPctPerExtraMall / 100),
    heatMultiplier: Math.min(config.network.maxHeatMultiplier, 1 + extra * config.network.heatBonusPctPerExtraMall / 100)
  };
};

export const resolveShoppingMallMarketBonuses = (
  count: number,
  config: ShoppingMallBalanceConfig
): ShoppingMallMarketBonuses => {
  const baseDiscountPct = Math.min(
    config.marketDiscount.maxDiscountPct,
    Math.max(0, Math.floor(Number(count || 0))) * config.marketDiscount.discountPctPerMall
  );
  return {
    ownedCount: Math.max(0, Math.floor(Number(count || 0))),
    regularMarketDiscountPct: baseDiscountPct * config.marketDiscount.regularMarketWeight,
    blackMarketDiscountPct: baseDiscountPct * config.marketDiscount.blackMarketWeight,
    playerMarketDiscountPct: baseDiscountPct * config.marketDiscount.playerMarketWeight,
    emergencyMarketDiscountPct: baseDiscountPct * config.marketDiscount.emergencyMarketWeight,
    marketFeeReductionPct: Math.min(
      config.marketFeeReduction.maxFeeReductionPct,
      Math.max(0, Math.floor(Number(count || 0))) * config.marketFeeReduction.feeReductionPctPerMall
    ),
    minFinalPriceMultiplier: config.marketDiscount.minFinalPriceMultiplier
  };
};

export const resolveShoppingMallMarketBonusesForPlayer = (input: {
  state: CoreGameState;
  playerId: string;
  config?: ShoppingMallBalanceConfig;
}): ShoppingMallMarketBonuses => {
  const config = input.config;
  if (!config) {
    return {
      ownedCount: 0,
      regularMarketDiscountPct: 0,
      blackMarketDiscountPct: 0,
      playerMarketDiscountPct: 0,
      emergencyMarketDiscountPct: 0,
      marketFeeReductionPct: 0,
      minFinalPriceMultiplier: 0.7
    };
  }
  return resolveShoppingMallMarketBonuses(getOwnedShoppingMallCount(input.state, input.playerId, config), config);
};

export const applyShoppingMallIncomeModifiers = (input: {
  config: ShoppingMallBalanceConfig;
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
  const network = resolveShoppingMallNetworkMultipliers(getOwnedShoppingMallCount(input.state, input.building.ownerPlayerId, input.config), input.config);
  return {
    cleanPerHour: input.cleanPerHour * network.cleanIncomeMultiplier,
    dirtyPerHour: input.dirtyPerHour * network.dirtyIncomeMultiplier,
    heatPerDay: input.heatPerDay * network.heatMultiplier,
    influencePerDay: input.influencePerDay * network.influenceMultiplier,
    maxLevel: 1
  };
};
