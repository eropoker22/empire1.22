import type { CentralBankBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { CentralBankReserveStats } from "./centralBankTypes";
import {
  emptyCentralBankStats,
  getCentralBankMetadata,
  getOwnedCentralBank,
  getOwnedCentralBankCount,
  hasOwnedBuilding,
  resolveCentralBankTier
} from "./centralBankMetadata";
export const resolveCentralBankReserveStats = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: CentralBankBalanceConfig;
  tick: number;
}): CentralBankReserveStats => {
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
