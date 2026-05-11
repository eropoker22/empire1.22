import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, CentralBankBalanceConfig, FixedBuildingBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { CentralBankActionResolution, CentralBankIntervention } from "./centralBankTypes";
import {
  appendRiskEvent,
  countOwnedBuildings,
  getCentralBankMetadata,
  getOwnedCentralBankCount,
  hasOwnedBuilding,
  minutesToTicks,
  resolveCategory,
  resolveCategoryOrNull,
  resolveCentralBankTier,
  withCentralBankMetadata
} from "./centralBankMetadata";
import { resolveCentralBankReserveStats } from "./centralBankReserveStats";

export type { CentralBankActionResolution, CentralBankInterestEvent, CentralBankIntervention, CentralBankMarketCategory, CentralBankMetadata, CentralBankOversightEvent, CentralBankRiskEvent } from "./centralBankTypes";
export { applyCentralBankPassiveInterestAndOversight, applyProtectedCleanCashLoss } from "./centralBankPassive";
export { getCentralBankMetadata, getOwnedCentralBankCount } from "./centralBankMetadata";
export { resolveCentralBankReserveStats } from "./centralBankReserveStats";

export const applyCentralBankIncomeModifiers = (input: {
  config: CentralBankBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  tick: number;
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  const playerId = input.building.ownerPlayerId;
  const ownedCount = getOwnedCentralBankCount(input.state, playerId, input.config);
  const tier = resolveCentralBankTier(ownedCount, input.config);
  const hasBank = Boolean(tier && playerId);
  const isCentralBank = input.building.buildingTypeId === input.config.buildingTypeId;
  const shoppingMallBoost = hasBank && input.building.buildingTypeId === "shopping_mall"
    ? 1 + input.config.synergies.shoppingMallCleanIncomeBonusPct / 100
    : 1;
  return {
    cleanPerHour: isCentralBank ? input.cleanPerHour * (tier?.incomeMultiplier ?? 1) : input.cleanPerHour * shoppingMallBoost,
    dirtyPerHour: isCentralBank ? 0 : input.dirtyPerHour,
    heatPerDay: isCentralBank ? input.heatPerDay * (tier?.heatMultiplier ?? 1) : input.heatPerDay,
    influencePerDay: isCentralBank ? input.influencePerDay * (tier?.influenceMultiplier ?? 1) : input.influencePerDay,
    maxLevel: 1
  };
};

export const resolveCentralBankInfluenceActionCostReductionPct = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: CentralBankBalanceConfig;
}): number =>
  input.config && input.playerId && hasOwnedBuilding(input.state, input.playerId, "city_hall") && getOwnedCentralBankCount(input.state, input.playerId, input.config) > 0
    ? input.config.synergies.cityHallInfluenceActionCostReductionPct
    : 0;

export const resolveCentralBankStockExchangeEffectReductionPct = (input: {
  state: CoreGameState;
  category: string;
  config?: CentralBankBalanceConfig;
  tick: number;
}): number => {
  const config = input.config;
  if (!config) return 0;
  return Object.values(input.state.buildingsById).reduce((maxReduction, building) => {
    if (building.buildingTypeId !== config.buildingTypeId || !building.ownerPlayerId || building.status !== "active") return maxReduction;
    const metadata = getCentralBankMetadata(building, input.tick);
    const active = metadata.currencyInterventions.some((effect) => effect.category === input.category && effect.expiresAtTick > input.tick);
    if (!active) return maxReduction;
    const synergy = hasOwnedBuilding(input.state, building.ownerPlayerId, "stock_exchange")
      ? config.currencyIntervention.stockExchangeSynergyEffectBonusPct
      : 0;
    return Math.max(maxReduction, config.currencyIntervention.stockExchangeEffectReductionPct + synergy);
  }, 0);
};

export const resolveCentralBankAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
  config: CentralBankBalanceConfig;
  tickRateMs: number;
  commandId: string;
  payload: RunBuildingActionCommand["payload"];
}): CentralBankActionResolution | null => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId) return null;
  const metadata = getCentralBankMetadata(input.building, input.state.root.tick);
  const actionId = input.action.actionId;

  if (actionId === input.config.liquidityInjection.actionId) {
    const cleanEconomyBuildingCount = countOwnedBuildings(input.state, input.building.ownerPlayerId, input.config.liquidityInjection.cleanEconomyBuildingTypeIds);
    const baseReward = Math.min(
      input.config.liquidityInjection.maxRewardCleanCash,
      input.config.liquidityInjection.baseRewardCleanCash + cleanEconomyBuildingCount * input.config.liquidityInjection.rewardPerCleanEconomyBuilding
    );
    const hasShoppingMall = hasOwnedBuilding(input.state, input.building.ownerPlayerId, "shopping_mall");
    const reward = Math.floor(baseReward * (hasShoppingMall ? 1 + input.config.liquidityInjection.shoppingMallRewardBonusPct / 100 : 1));
    const riskExpiresAtTick = input.state.root.tick + minutesToTicks(input.config.liquidityInjection.riskDurationMinutes, input.tickRateMs);
    const nextMetadata = appendRiskEvent(metadata, actionId, input.config.liquidityInjection.riskPct, riskExpiresAtTick, input.state.root.tick);
    return {
      balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) + reward) },
      buildingMetadata: withCentralBankMetadata(input.building, nextMetadata),
      heatGain: input.config.liquidityInjection.heatGain,
      influenceChange: -input.config.liquidityInjection.costInfluence,
      inputCost: {},
      outputGain: { cash: reward },
      reportText: `Likviditní injekce přidala ${reward} clean cash za ${cleanEconomyBuildingCount} čistých ekonomických budov.`,
      centralBankResult: {
        type: "liquidity_injection",
        cleanEconomyBuildingCount,
        baseRewardCleanCash: input.config.liquidityInjection.baseRewardCleanCash,
        rewardPerCleanEconomyBuilding: input.config.liquidityInjection.rewardPerCleanEconomyBuilding,
        maxRewardCleanCash: input.config.liquidityInjection.maxRewardCleanCash,
        shoppingMallSynergyApplied: hasShoppingMall,
        rewardCleanCash: reward,
        influenceCost: input.config.liquidityInjection.costInfluence,
        financialOversightRiskAddedPct: input.config.liquidityInjection.riskPct,
        riskExpiresAtTick
      }
    };
  }

  if (actionId === input.config.frozenAccounts.actionId) {
    const expiresAtTick = input.state.root.tick + minutesToTicks(input.config.frozenAccounts.durationMinutes, input.tickRateMs);
    const nextMetadata = appendRiskEvent({
      ...metadata,
      frozenAccountsExpiresAtTick: expiresAtTick
    }, actionId, input.config.frozenAccounts.riskPct, expiresAtTick, input.state.root.tick);
    return {
      balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) - input.config.frozenAccounts.costCleanCash) },
      buildingMetadata: withCentralBankMetadata(input.building, nextMetadata),
      heatGain: input.config.frozenAccounts.heatGain,
      influenceChange: 0,
      inputCost: { cash: input.config.frozenAccounts.costCleanCash },
      outputGain: {},
      reportText: "Zmrazené účty jsou aktivní. Rezervy jsou chráněné, ale market fee je dočasně horší.",
      centralBankResult: {
        type: "frozen_accounts",
        activeUntilTick: expiresAtTick,
        cleanCashProtectionBonusPct: input.config.frozenAccounts.cleanCashProtectionBonusPct,
        dirtyCashProtectionPct: input.config.frozenAccounts.dirtyCashProtectionPct,
        fineReductionPct: input.config.frozenAccounts.fineReductionPct,
        financialEventLossReductionPct: input.config.frozenAccounts.financialEventLossReductionPct,
        marketFeePenaltyPct: input.config.frozenAccounts.marketFeePenaltyPct,
        financialOversightRiskAddedPct: input.config.frozenAccounts.riskPct
      }
    };
  }

  if (actionId === input.config.currencyIntervention.actionId) {
    const category = resolveCategory(input.payload.targetCategory ?? input.payload.category, input.config.currencyIntervention.targetCategories);
    const expiresAtTick = input.state.root.tick + minutesToTicks(input.config.currencyIntervention.durationMinutes, input.tickRateMs);
    const effect: CentralBankIntervention = {
      id: `central-bank-intervention:${input.commandId}`,
      category,
      startedAtTick: input.state.root.tick,
      expiresAtTick,
      volatilityReductionPct: input.config.currencyIntervention.volatilityReductionPct,
      priceMoveCapPct: input.config.currencyIntervention.priceMoveCapPct,
      holderMarketFeeReductionPct: input.config.currencyIntervention.holderMarketFeeReductionPct,
      stockExchangeEffectReductionPct: input.config.currencyIntervention.stockExchangeEffectReductionPct,
      ownerPlayerId: input.building.ownerPlayerId ?? ""
    };
    const nextMetadata = appendRiskEvent({
      ...metadata,
      currencyInterventions: [...metadata.currencyInterventions, effect].slice(-8)
    }, actionId, input.config.currencyIntervention.riskPct, expiresAtTick, input.state.root.tick);
    return {
      balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) - input.config.currencyIntervention.costCleanCash) },
      buildingMetadata: withCentralBankMetadata(input.building, nextMetadata),
      heatGain: input.config.currencyIntervention.heatGain,
      influenceChange: -input.config.currencyIntervention.costInfluence,
      inputCost: { cash: input.config.currencyIntervention.costCleanCash },
      outputGain: {},
      reportText: `Kurzovní intervence stabilizuje kategorii ${category}.`,
      centralBankResult: {
        type: "currency_intervention",
        category,
        activeUntilTick: expiresAtTick,
        volatilityReductionPct: input.config.currencyIntervention.volatilityReductionPct,
        priceMoveCapPct: input.config.currencyIntervention.priceMoveCapPct,
        marketFeeReductionPct: input.config.currencyIntervention.holderMarketFeeReductionPct,
        stockExchangeEffectReductionPct: input.config.currencyIntervention.stockExchangeEffectReductionPct,
        influenceCost: input.config.currencyIntervention.costInfluence,
        financialOversightRiskAddedPct: input.config.currencyIntervention.riskPct
      }
    };
  }

  return null;
};

export const validateCentralBankAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  districtInfluence: number;
  config?: CentralBankBalanceConfig;
  payload: RunBuildingActionCommand["payload"];
}): string | null => {
  const config = input.config;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getCentralBankMetadata(input.building, input.state.root.tick);
  if (input.actionId === config.liquidityInjection.actionId) {
    if (Number(metadata.liquidityBlockedUntilTick || 0) > input.state.root.tick) return "central_bank_liquidity_blocked";
    if (Math.max(0, Number(input.districtInfluence || 0)) < config.liquidityInjection.costInfluence) return "central_bank_insufficient_influence";
  }
  if (input.actionId === config.frozenAccounts.actionId) {
    if (Number(metadata.frozenAccountsExpiresAtTick || 0) > input.state.root.tick) return "central_bank_frozen_accounts_active";
    if (Math.max(0, Number(input.balances.cash || 0)) < config.frozenAccounts.costCleanCash) return "central_bank_insufficient_clean_cash";
  }
  if (input.actionId === config.currencyIntervention.actionId) {
    const category = resolveCategoryOrNull(input.payload.targetCategory ?? input.payload.category, config.currencyIntervention.targetCategories);
    if (!category) return "central_bank_invalid_market_category";
    if (metadata.currencyInterventions.some((effect) => effect.category === category && effect.expiresAtTick > input.state.root.tick)) return "central_bank_currency_intervention_active";
    if (Math.max(0, Number(input.balances.cash || 0)) < config.currencyIntervention.costCleanCash) return "central_bank_insufficient_clean_cash";
    if (Math.max(0, Number(input.districtInfluence || 0)) < config.currencyIntervention.costInfluence) return "central_bank_insufficient_influence";
  }
  return null;
};
