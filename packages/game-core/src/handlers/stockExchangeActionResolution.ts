import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, StockExchangeBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";
import {
  appendStockExchangeAction,
  getStockExchangeMetadata,
  interpolate,
  minutesToTicks,
  resolveCategory,
  resolvePressureMode,
  withStockExchangeMetadata
} from "./stockExchangeMetadata";
import type { StockExchangeActionResolution, StockExchangeMarketEffect } from "./stockExchangeTypes";
export const resolveStockExchangeAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
  config: StockExchangeBalanceConfig;
  tickRateMs: number;
  commandId: string;
  payload: RunBuildingActionCommand["payload"];
}): StockExchangeActionResolution | null => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId) return null;
  const metadata = getStockExchangeMetadata(input.building, input.state.root.tick);
  const actionId = input.action.actionId;

  if (actionId === input.config.speculativeBuy.actionId) {
    const category = resolveCategory(input.payload.targetCategory ?? input.payload.category, input.config.speculativeBuy.targetCategories);
    const investment = Math.min(
      input.config.speculativeBuy.maxInvestmentCleanCash,
      Math.max(1, Math.floor(Number(input.payload.investmentCleanCash ?? input.payload.investment ?? (input.payload.amount || 0))))
    );
    const insiderActive = Number(metadata.insiderWindowExpiresAtTick || 0) > input.state.root.tick;
    const successChance = Math.min(95, input.config.speculativeBuy.successChancePct + (insiderActive ? input.config.speculativeBuy.insiderSuccessChanceBonusPct : 0));
    const neutralChance = Math.max(0, Math.min(input.config.speculativeBuy.neutralChancePct, 100 - successChance));
    const roll = deterministicUnitInterval(`${input.commandId}:stock-speculation:${input.state.root.tick}`);
    const pctRoll = deterministicUnitInterval(`${input.commandId}:stock-speculation-return:${input.state.root.tick}`);
    const outcome = roll < successChance / 100
      ? "success"
      : roll < (successChance + neutralChance) / 100
        ? "neutral"
        : "bad_read";
    const returnPct = outcome === "success"
      ? interpolate(input.config.speculativeBuy.successProfitMinPct, input.config.speculativeBuy.successProfitMaxPct, pctRoll)
      : outcome === "neutral"
        ? interpolate(input.config.speculativeBuy.neutralReturnMinPct, input.config.speculativeBuy.neutralReturnMaxPct, pctRoll)
        : interpolate(input.config.speculativeBuy.lossReturnMinPct, input.config.speculativeBuy.lossReturnMaxPct, pctRoll);
    const payout = Math.max(0, Math.floor(investment * (1 + returnPct / 100)));
    const riskExpiresAtTick = input.state.root.tick + minutesToTicks(input.config.speculativeBuy.riskDurationMinutes, input.tickRateMs);
    const nextMetadata = appendStockExchangeAction(metadata, input.config.speculativeBuy.actionId, input.state.root.tick, {
      category,
      riskEvent: { actionId, riskPct: input.config.speculativeBuy.riskPct, expiresAtTick: riskExpiresAtTick, tick: input.state.root.tick }
    });
    return {
      balances: {
        ...input.balances,
        cash: Math.max(0, Number(input.balances.cash || 0) - input.config.speculativeBuy.costCleanCash - investment + payout)
      },
      buildingMetadata: withStockExchangeMetadata(input.building, nextMetadata),
      heatGain: input.config.speculativeBuy.heatGain,
      influenceChange: 0,
      inputCost: { cash: input.config.speculativeBuy.costCleanCash + investment },
      outputGain: { cash: payout },
      reportText: `Spekulativní nákup (${category}) skončil výsledkem ${outcome}. Výnos ${payout} clean cash.`,
      stockExchangeResult: {
        type: "speculative_buy",
        category,
        investmentCleanCash: investment,
        payoutCleanCash: payout,
        returnPct: Math.round(returnPct * 10) / 10,
        outcome,
        successChancePct: successChance,
        financialInspectionRiskAddedPct: input.config.speculativeBuy.riskPct,
        riskExpiresAtTick
      }
    };
  }

  if (actionId === input.config.marketPressure.actionId) {
    const category = resolveCategory(input.payload.targetCategory ?? input.payload.category, input.config.marketPressure.targetCategories);
    const mode = resolvePressureMode(input.payload.mode);
    const regularPriceModifierPct = mode === "pump" ? input.config.marketPressure.pumpRegularPct : input.config.marketPressure.dumpRegularPct;
    const blackMarketPriceModifierPct = regularPriceModifierPct * input.config.marketPressure.blackMarketEffectSharePct / 100;
    const expiresAtTick = input.state.root.tick + minutesToTicks(input.config.marketPressure.durationMinutes, input.tickRateMs);
    const riskExpiresAtTick = input.state.root.tick + minutesToTicks(input.config.marketPressure.riskDurationMinutes, input.tickRateMs);
    const effect: StockExchangeMarketEffect = {
      id: `stock-market-effect:${input.commandId}`,
      category,
      mode,
      regularPriceModifierPct,
      blackMarketPriceModifierPct,
      startedAtTick: input.state.root.tick,
      expiresAtTick,
      ownerPlayerId: input.building.ownerPlayerId ?? ""
    };
    const nextMetadata = appendStockExchangeAction(metadata, input.config.marketPressure.actionId, input.state.root.tick, {
      category,
      mode,
      marketEffect: effect,
      riskEvent: { actionId, riskPct: input.config.marketPressure.riskPct, expiresAtTick: riskExpiresAtTick, tick: input.state.root.tick }
    });
    return {
      balances: {
        ...input.balances,
        cash: Math.max(0, Number(input.balances.cash || 0) - input.config.marketPressure.costCleanCash)
      },
      buildingMetadata: withStockExchangeMetadata(input.building, nextMetadata),
      heatGain: input.config.marketPressure.heatGain,
      influenceChange: -input.config.marketPressure.costInfluence,
      inputCost: { cash: input.config.marketPressure.costCleanCash },
      outputGain: {},
      reportText: `Downtown burza rozkolísala ceny v kategorii ${category}.`,
      stockExchangeResult: {
        type: "market_pressure",
        category,
        mode,
        activeUntilTick: expiresAtTick,
        regularPriceModifierPct,
        blackMarketPriceModifierPct,
        influenceCost: input.config.marketPressure.costInfluence,
        financialInspectionRiskAddedPct: input.config.marketPressure.riskPct,
        riskExpiresAtTick
      }
    };
  }

  if (actionId === input.config.insiderWindow.actionId) {
    const expiresAtTick = input.state.root.tick + minutesToTicks(input.config.insiderWindow.durationMinutes, input.tickRateMs);
    const nextMetadata = appendStockExchangeAction({
      ...metadata,
      insiderWindowExpiresAtTick: expiresAtTick
    }, input.config.insiderWindow.actionId, input.state.root.tick, {
      riskEvent: {
        actionId,
        riskPct: input.config.insiderWindow.financialInspectionRiskPct,
        expiresAtTick,
        tick: input.state.root.tick
      }
    });
    return {
      balances: {
        ...input.balances,
        cash: Math.max(0, Number(input.balances.cash || 0) - input.config.insiderWindow.costCleanCash)
      },
      buildingMetadata: withStockExchangeMetadata(input.building, nextMetadata),
      heatGain: input.config.insiderWindow.heatGain,
      influenceChange: 0,
      inputCost: { cash: input.config.insiderWindow.costCleanCash },
      outputGain: {},
      reportText: "Vnitřní tipy jsou aktivní. Trend hinty jsou hlubší a Spekulativní nákup má vyšší šanci.",
      stockExchangeResult: {
        type: "insider_window",
        activeUntilTick: expiresAtTick,
        visibleTrendHints: input.config.marketInsight.insiderHintCount,
        extraFeeReductionPct: input.config.marketFeeReduction.insiderExtraPct,
        speculativeSuccessChanceBonusPct: input.config.speculativeBuy.insiderSuccessChanceBonusPct,
        financialInspectionRiskAddedPct: input.config.insiderWindow.financialInspectionRiskPct
      }
    };
  }

  return null;
};
