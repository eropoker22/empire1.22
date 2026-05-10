import type { CityFeedEvent, RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, CentralBankBalanceConfig, FixedBuildingBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";

export type CentralBankMarketCategory = "materials" | "weapons" | "defenseItems" | "rareComponents" | "drugsAndBoosts";

export interface CentralBankRiskEvent {
  actionId: string;
  riskPct: number;
  expiresAtTick: number;
  tick: number;
}

export interface CentralBankIntervention {
  id: string;
  category: CentralBankMarketCategory;
  startedAtTick: number;
  expiresAtTick: number;
  volatilityReductionPct: number;
  priceMoveCapPct: number;
  holderMarketFeeReductionPct: number;
  stockExchangeEffectReductionPct: number;
  ownerPlayerId: string;
}

export interface CentralBankOversightEvent {
  type: string;
  tick: number;
  label: string;
  riskPct: number;
  cleanCashLost?: number;
  rumorText?: string;
}

export interface CentralBankInterestEvent {
  tick: number;
  amount: number;
  cleanCashBefore: number;
  interestPct: number;
}

export interface CentralBankMetadata {
  frozenAccountsExpiresAtTick?: number;
  interestDisabledUntilTick?: number;
  liquidityBlockedUntilTick?: number;
  feeReductionDisabledUntilTick?: number;
  lastInterestTick?: number;
  lastOversightTick?: number;
  riskEvents: CentralBankRiskEvent[];
  currencyInterventions: CentralBankIntervention[];
  oversightEvents: CentralBankOversightEvent[];
  interestEvents: CentralBankInterestEvent[];
}

export interface CentralBankActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  centralBankResult: Record<string, unknown>;
}

export const getCentralBankMetadata = (
  building: CoreGameState["buildingsById"][string],
  tick = 0
): CentralBankMetadata => cleanupCentralBankMetadata(readCentralBankMetadata(building), tick);

export const getOwnedCentralBankCount = (
  state: CoreGameState,
  playerId: string | null | undefined,
  config: CentralBankBalanceConfig
): number =>
  playerId
    ? Object.values(state.buildingsById).filter((building) =>
        building.buildingTypeId === config.buildingTypeId && building.ownerPlayerId === playerId && building.status === "active"
      ).length
    : 0;

export const resolveCentralBankReserveStats = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: CentralBankBalanceConfig;
  tick: number;
}): {
  ownedCount: number;
  tier: CentralBankBalanceConfig["reserveTiers"][number] | null;
  cleanCashProtectionPct: number;
  dirtyCashProtectionPct: number;
  fineReductionPct: number;
  financialEventLossReductionPct: number;
  financialInspectionPenaltyReductionPct: number;
  economicCrisisImpactReductionPct: number;
  marketFeeReductionPct: number;
  interestPct: number;
  interestIntervalMinutes: number;
  maxInterestCleanCash: number;
  interestDisabled: boolean;
  liquidityBlocked: boolean;
  frozenAccountsActive: boolean;
  activeCurrencyInterventions: CentralBankIntervention[];
} => {
  const config = input.config;
  if (!config || !input.playerId) {
    return emptyCentralBankStats();
  }
  const ownedCount = getOwnedCentralBankCount(input.state, input.playerId, config);
  const tier = resolveCentralBankTier(ownedCount, config);
  const bank = getOwnedCentralBank(input.state, input.playerId, config);
  if (!tier || !bank) {
    return emptyCentralBankStats(ownedCount);
  }
  const metadata = getCentralBankMetadata(bank, input.tick);
  const frozenAccountsActive = Number(metadata.frozenAccountsExpiresAtTick || 0) > input.tick;
  const interestDisabled = Number(metadata.interestDisabledUntilTick || 0) > input.tick;
  const liquidityBlocked = Number(metadata.liquidityBlockedUntilTick || 0) > input.tick;
  const feeDisabled = Number(metadata.feeReductionDisabledUntilTick || 0) > input.tick;
  const shoppingMallBonus = hasOwnedBuilding(input.state, input.playerId, "shopping_mall")
    ? config.synergies.shoppingMallMarketFeeReductionPct
    : 0;
  const interventionFeeReduction = metadata.currencyInterventions.some((effect) => effect.expiresAtTick > input.tick)
    ? config.currencyIntervention.holderMarketFeeReductionPct
    : 0;
  const frozenFeePenalty = frozenAccountsActive ? config.frozenAccounts.marketFeePenaltyPct : 0;
  return {
    ownedCount,
    tier,
    cleanCashProtectionPct: tier.cleanCashProtectionPct + (frozenAccountsActive ? config.frozenAccounts.cleanCashProtectionBonusPct : 0),
    dirtyCashProtectionPct: frozenAccountsActive ? config.frozenAccounts.dirtyCashProtectionPct : 0,
    fineReductionPct: tier.fineReductionPct + (frozenAccountsActive ? config.frozenAccounts.fineReductionPct : 0),
    financialEventLossReductionPct: frozenAccountsActive ? config.frozenAccounts.financialEventLossReductionPct : 0,
    financialInspectionPenaltyReductionPct: tier.financialInspectionPenaltyReductionPct,
    economicCrisisImpactReductionPct: tier.economicCrisisImpactReductionPct,
    marketFeeReductionPct: feeDisabled ? 0 : Math.max(0, tier.marketFeeReductionPct + shoppingMallBonus + interventionFeeReduction - frozenFeePenalty),
    interestPct: tier.interestPct,
    interestIntervalMinutes: tier.interestIntervalMinutes,
    maxInterestCleanCash: tier.maxInterestCleanCash,
    interestDisabled,
    liquidityBlocked,
    frozenAccountsActive,
    activeCurrencyInterventions: metadata.currencyInterventions.filter((effect) => effect.expiresAtTick > input.tick)
  };
};

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

export const applyCentralBankPassiveInterestAndOversight = (
  state: CoreGameState,
  config: CentralBankBalanceConfig,
  tickRateMs: number
): CoreGameState => {
  let nextState = state;
  const processedPlayerIds = new Set<string>();
  const activeBanks = Object.values(nextState.buildingsById)
    .filter((building) => building.buildingTypeId === config.buildingTypeId && building.ownerPlayerId && building.status === "active")
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const initialBank of activeBanks) {
    const playerId = initialBank.ownerPlayerId;
    if (!playerId || processedPlayerIds.has(playerId)) continue;
    processedPlayerIds.add(playerId);
    const bank = getOwnedCentralBank(nextState, playerId, config);
    if (!bank) continue;
    const ownedCount = getOwnedCentralBankCount(nextState, playerId, config);
    const tier = resolveCentralBankTier(ownedCount, config);
    if (!tier) continue;
    let metadata = getCentralBankMetadata(bank, nextState.root.tick);
    let changed = false;

    const interestIntervalTicks = minutesToTicks(tier.interestIntervalMinutes, tickRateMs);
    if (metadata.lastInterestTick === undefined) {
      metadata = { ...metadata, lastInterestTick: nextState.root.tick };
      changed = true;
    } else if (metadata.lastInterestTick + interestIntervalTicks <= nextState.root.tick) {
      const player = nextState.playersById[playerId];
      const resourceState = player ? nextState.resourceStatesById[player.resourceStateId] : undefined;
      const disabled = Number(metadata.interestDisabledUntilTick || 0) > nextState.root.tick;
      if (resourceState && !disabled) {
        const cleanCashBefore = Math.max(0, Number(resourceState.balances.cash || 0));
        const amount = Math.min(tier.maxInterestCleanCash, Math.floor(cleanCashBefore * tier.interestPct / 100));
        if (amount > 0) {
          nextState = {
            ...nextState,
            resourceStatesById: {
              ...nextState.resourceStatesById,
              [resourceState.id]: {
                ...resourceState,
                balances: {
                  ...resourceState.balances,
                  cash: cleanCashBefore + amount
                },
                version: resourceState.version + 1
              }
            }
          };
          metadata = {
            ...metadata,
            interestEvents: [...metadata.interestEvents, { tick: nextState.root.tick, amount, cleanCashBefore, interestPct: tier.interestPct }].slice(-8)
          };
        }
      }
      metadata = { ...metadata, lastInterestTick: nextState.root.tick };
      changed = true;
    }

    const oversightIntervalTicks = minutesToTicks(config.financialOversight.intervalMinutes, tickRateMs);
    if (metadata.lastOversightTick === undefined) {
      metadata = { ...metadata, lastOversightTick: nextState.root.tick };
      changed = true;
    } else if (metadata.lastOversightTick + oversightIntervalTicks <= nextState.root.tick) {
      const riskPct = resolveFinancialOversightRiskPct({ state: nextState, building: bank, config, tick: nextState.root.tick });
      metadata = { ...metadata, lastOversightTick: nextState.root.tick };
      const roll = deterministicUnitInterval(`${nextState.serverInstance.worldSeed}:central-bank-oversight:${bank.id}:${nextState.root.tick}`);
      if (roll < riskPct / 100) {
        const consequence = resolveOversightConsequence(nextState, bank, config, riskPct, tickRateMs);
        nextState = consequence.state;
        metadata = { ...metadata, ...consequence.metadataPatch, oversightEvents: [...metadata.oversightEvents, consequence.event].slice(-8) };
      }
      changed = true;
    }

    if (changed) {
      const currentBank = nextState.buildingsById[bank.id] ?? bank;
      nextState = {
        ...nextState,
        buildingsById: {
          ...nextState.buildingsById,
          [bank.id]: {
            ...currentBank,
            metadata: withCentralBankMetadata(currentBank, metadata),
            version: currentBank.version + 1
          }
        }
      };
    }
  }
  return nextState;
};

const resolveFinancialOversightRiskPct = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  config: CentralBankBalanceConfig;
  tick: number;
}): number => {
  const metadata = getCentralBankMetadata(input.building, input.tick);
  const playerId = input.building.ownerPlayerId;
  const player = playerId ? input.state.playersById[playerId] : undefined;
  const policeState = player ? input.state.policeStatesById[player.policeStateId] : undefined;
  const eventRisk = metadata.riskEvents.reduce((total, event) => total + Math.max(0, Number(event.riskPct || 0)), 0);
  const heatRisk = Number(policeState?.heat || 0) > input.config.financialOversight.heatThreshold
    ? input.config.financialOversight.heatRiskPct
    : 0;
  const stockRisk = playerId && hasOwnedBuilding(input.state, playerId, "stock_exchange")
    ? input.config.financialOversight.stockExchangeRiskPct
    : 0;
  const cityHallReduction = playerId && hasOwnedBuilding(input.state, playerId, "city_hall")
    ? input.config.financialOversight.cityHallRiskReductionPct
    : 0;
  return Math.max(0, Math.min(100, input.config.financialOversight.passiveRiskPct + eventRisk + heatRisk + stockRisk - cityHallReduction));
};

const resolveOversightConsequence = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  config: CentralBankBalanceConfig,
  riskPct: number,
  tickRateMs: number
): { state: CoreGameState; metadataPatch: Partial<CentralBankMetadata>; event: CentralBankOversightEvent } => {
  const type = ["reserve_check", "banking_stop", "regulatory_fine", "data_leak", "market_restriction"][Math.min(4, Math.floor(deterministicUnitInterval(`${state.serverInstance.worldSeed}:central-bank-oversight-type:${building.id}:${state.root.tick}`) * 5))];
  const labelByType: Record<string, string> = {
    reserve_check: "Kontrola rezerv",
    banking_stop: "Bankovní stopka",
    regulatory_fine: "Regulační pokuta",
    data_leak: "Únik dat",
    market_restriction: "Omezení trhu"
  };
  let nextState = state;
  const metadataPatch: Partial<CentralBankMetadata> = {};
  let cleanCashLost: number | undefined;
  let rumorText: string | undefined;
  if (type === "reserve_check") {
    metadataPatch.interestDisabledUntilTick = state.root.tick + minutesToTicks(config.financialOversight.interestDisabledMinutes, tickRateMs);
  } else if (type === "banking_stop") {
    metadataPatch.liquidityBlockedUntilTick = state.root.tick + minutesToTicks(config.financialOversight.liquidityBlockedMinutes, tickRateMs);
  } else if (type === "regulatory_fine" && building.ownerPlayerId) {
    const result = applyProtectedCleanCashLoss(nextState, building.ownerPlayerId, config, config.financialOversight.regulatoryFineCleanCash, state.root.tick);
    nextState = result.state;
    cleanCashLost = result.cleanCashLost;
  } else if (type === "data_leak") {
    rumorText = "Městem unikl drb o finančních vazbách Centrální banky. Někdo prý drží rezervy pevněji než vlastní alibi.";
    nextState = appendCentralBankRumor(nextState, building, rumorText);
  } else if (type === "market_restriction") {
    metadataPatch.feeReductionDisabledUntilTick = state.root.tick + minutesToTicks(config.financialOversight.feeReductionDisabledMinutes, tickRateMs);
  }
  return {
    state: nextState,
    metadataPatch,
    event: { type, tick: state.root.tick, label: labelByType[type] ?? type, riskPct, cleanCashLost, rumorText }
  };
};

const applyProtectedCleanCashLoss = (
  state: CoreGameState,
  playerId: string,
  config: CentralBankBalanceConfig,
  baseLoss: number,
  tick: number
): { state: CoreGameState; cleanCashLost: number } => {
  const player = state.playersById[playerId];
  const resourceState = player ? state.resourceStatesById[player.resourceStateId] : undefined;
  if (!player || !resourceState) return { state, cleanCashLost: 0 };
  const stats = resolveCentralBankReserveStats({ state, playerId, config, tick });
  const multiplier = (1 - Math.min(95, stats.cleanCashProtectionPct) / 100)
    * (1 - Math.min(95, stats.fineReductionPct) / 100)
    * (1 - Math.min(95, stats.financialInspectionPenaltyReductionPct) / 100);
  const cleanCashLost = Math.max(0, Math.ceil(baseLoss * Math.max(0, multiplier)));
  return {
    state: {
      ...state,
      resourceStatesById: {
        ...state.resourceStatesById,
        [resourceState.id]: {
          ...resourceState,
          balances: {
            ...resourceState.balances,
            cash: Math.max(0, Number(resourceState.balances.cash || 0) - cleanCashLost)
          },
          version: resourceState.version + 1
        }
      }
    },
    cleanCashLost
  };
};

const appendRiskEvent = (
  metadata: CentralBankMetadata,
  actionId: string,
  riskPct: number,
  expiresAtTick: number,
  tick: number
): CentralBankMetadata => ({
  ...metadata,
  riskEvents: [...metadata.riskEvents, { actionId, riskPct, expiresAtTick, tick }].slice(-12)
});

const resolveCentralBankTier = (
  ownedCount: number,
  config: CentralBankBalanceConfig
): CentralBankBalanceConfig["reserveTiers"][number] | null =>
  config.reserveTiers.find((tier) => ownedCount >= tier.minOwned && ownedCount <= tier.maxOwned)
    ?? config.reserveTiers.find((tier) => ownedCount >= tier.minOwned)
    ?? null;

const getOwnedCentralBank = (
  state: CoreGameState,
  playerId: string | null | undefined,
  config: CentralBankBalanceConfig
): CoreGameState["buildingsById"][string] | undefined =>
  playerId
    ? Object.values(state.buildingsById)
        .filter((building) => building.buildingTypeId === config.buildingTypeId && building.ownerPlayerId === playerId && building.status === "active")
        .sort((a, b) => a.id.localeCompare(b.id))[0]
    : undefined;

const countOwnedBuildings = (state: CoreGameState, playerId: string | null | undefined, buildingTypeIds: string[]): number =>
  playerId
    ? Object.values(state.buildingsById).filter((building) =>
        building.ownerPlayerId === playerId && building.status === "active" && buildingTypeIds.includes(building.buildingTypeId)
      ).length
    : 0;

const hasOwnedBuilding = (state: CoreGameState, playerId: string | null | undefined, buildingTypeId: string): boolean =>
  Boolean(playerId) && Object.values(state.buildingsById).some((building) =>
    building.ownerPlayerId === playerId && building.status === "active" && building.buildingTypeId === buildingTypeId
  );

const emptyCentralBankStats = (ownedCount = 0): ReturnType<typeof resolveCentralBankReserveStats> => ({
  ownedCount,
  tier: null,
  cleanCashProtectionPct: 0,
  dirtyCashProtectionPct: 0,
  fineReductionPct: 0,
  financialEventLossReductionPct: 0,
  financialInspectionPenaltyReductionPct: 0,
  economicCrisisImpactReductionPct: 0,
  marketFeeReductionPct: 0,
  interestPct: 0,
  interestIntervalMinutes: 0,
  maxInterestCleanCash: 0,
  interestDisabled: false,
  liquidityBlocked: false,
  frozenAccountsActive: false,
  activeCurrencyInterventions: []
});

const readCentralBankMetadata = (building: CoreGameState["buildingsById"][string]): CentralBankMetadata => {
  const raw = isRecord(building.metadata?.centralBank) ? building.metadata.centralBank : {};
  return {
    frozenAccountsExpiresAtTick: asOptionalTick(raw.frozenAccountsExpiresAtTick),
    interestDisabledUntilTick: asOptionalTick(raw.interestDisabledUntilTick),
    liquidityBlockedUntilTick: asOptionalTick(raw.liquidityBlockedUntilTick),
    feeReductionDisabledUntilTick: asOptionalTick(raw.feeReductionDisabledUntilTick),
    lastInterestTick: asOptionalTick(raw.lastInterestTick),
    lastOversightTick: asOptionalTick(raw.lastOversightTick),
    riskEvents: Array.isArray(raw.riskEvents) ? raw.riskEvents.filter(isRecord).map((entry) => ({ actionId: String(entry.actionId || ""), riskPct: Number(entry.riskPct || 0), expiresAtTick: Math.floor(Number(entry.expiresAtTick || 0)), tick: Math.floor(Number(entry.tick || 0)) })).filter((entry) => entry.actionId) : [],
    currencyInterventions: Array.isArray(raw.currencyInterventions) ? raw.currencyInterventions.filter(isRecord).map(readIntervention).filter((entry): entry is CentralBankIntervention => Boolean(entry)) : [],
    oversightEvents: Array.isArray(raw.oversightEvents) ? raw.oversightEvents.filter(isRecord).map((entry) => ({ type: String(entry.type || ""), tick: Math.floor(Number(entry.tick || 0)), label: String(entry.label || entry.type || ""), riskPct: Number(entry.riskPct || 0), cleanCashLost: entry.cleanCashLost === undefined ? undefined : Number(entry.cleanCashLost || 0), rumorText: entry.rumorText ? String(entry.rumorText) : undefined })).filter((entry) => entry.type) : [],
    interestEvents: Array.isArray(raw.interestEvents) ? raw.interestEvents.filter(isRecord).map((entry) => ({ tick: Math.floor(Number(entry.tick || 0)), amount: Math.max(0, Math.floor(Number(entry.amount || 0))), cleanCashBefore: Math.max(0, Math.floor(Number(entry.cleanCashBefore || 0))), interestPct: Number(entry.interestPct || 0) })).filter((entry) => entry.amount > 0) : []
  };
};

const cleanupCentralBankMetadata = (metadata: CentralBankMetadata, tick: number): CentralBankMetadata => ({
  ...metadata,
  frozenAccountsExpiresAtTick: Number(metadata.frozenAccountsExpiresAtTick || 0) > tick ? metadata.frozenAccountsExpiresAtTick : undefined,
  interestDisabledUntilTick: Number(metadata.interestDisabledUntilTick || 0) > tick ? metadata.interestDisabledUntilTick : undefined,
  liquidityBlockedUntilTick: Number(metadata.liquidityBlockedUntilTick || 0) > tick ? metadata.liquidityBlockedUntilTick : undefined,
  feeReductionDisabledUntilTick: Number(metadata.feeReductionDisabledUntilTick || 0) > tick ? metadata.feeReductionDisabledUntilTick : undefined,
  riskEvents: metadata.riskEvents.filter((event) => event.expiresAtTick > tick),
  currencyInterventions: metadata.currencyInterventions.filter((effect) => effect.expiresAtTick > tick),
  oversightEvents: metadata.oversightEvents.slice(-8),
  interestEvents: metadata.interestEvents.slice(-8)
});

const readIntervention = (entry: Record<string, unknown>): CentralBankIntervention | null => {
  const category = resolveCategoryOrNull(entry.category, ["materials", "weapons", "defenseItems", "rareComponents", "drugsAndBoosts"]);
  if (!category) return null;
  return {
    id: String(entry.id || ""),
    category,
    startedAtTick: Math.floor(Number(entry.startedAtTick || 0)),
    expiresAtTick: Math.floor(Number(entry.expiresAtTick || 0)),
    volatilityReductionPct: Number(entry.volatilityReductionPct || 0),
    priceMoveCapPct: Number(entry.priceMoveCapPct || 0),
    holderMarketFeeReductionPct: Number(entry.holderMarketFeeReductionPct || 0),
    stockExchangeEffectReductionPct: Number(entry.stockExchangeEffectReductionPct || 0),
    ownerPlayerId: String(entry.ownerPlayerId || "")
  };
};

const withCentralBankMetadata = (
  building: CoreGameState["buildingsById"][string],
  centralBank: CentralBankMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  centralBank
});

const appendCentralBankRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  message: string
): CoreGameState => {
  const sourceEventId = `central-bank-oversight:${building.id}:${state.root.tick}:${Math.abs(hashText(message))}`;
  const event: CityFeedEvent = {
    id: `city-feed:${sourceEventId}`,
    sourceEventId,
    sourceType: "market",
    category: "rumor",
    severity: "high",
    truthiness: "unconfirmed",
    visibility: "all",
    playerId: building.ownerPlayerId,
    districtId: building.districtId,
    createdAtTick: state.root.tick,
    message,
    messageKey: "rumor.central_bank_oversight",
    payload: { buildingTypeId: building.buildingTypeId }
  };
  if (state.cityFeedEventsById?.[event.id]) return state;
  return {
    ...state,
    cityFeedEventsById: {
      ...(state.cityFeedEventsById ?? {}),
      [event.id]: event
    }
  };
};

const resolveCategory = (value: unknown, allowed: string[]): CentralBankMarketCategory =>
  resolveCategoryOrNull(value, allowed) ?? "materials";

const resolveCategoryOrNull = (value: unknown, allowed: string[]): CentralBankMarketCategory | null => {
  const normalized = String(value ?? "").trim();
  return allowed.includes(normalized) ? normalized as CentralBankMarketCategory : null;
};

const asOptionalTick = (value: unknown): number | undefined => {
  const tick = Math.floor(Number(value || 0));
  return tick > 0 ? tick : undefined;
};

const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil(Math.max(0, minutes) * 60000 / Math.max(1, tickRateMs)));

const hashText = (value: string): number =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
