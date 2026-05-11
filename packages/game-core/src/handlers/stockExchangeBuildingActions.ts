import type { BuildingActionBalanceConfig, FixedBuildingBalanceConfig, StockExchangeBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { RunBuildingActionCommand } from "@empire/shared-types";
import { getStockExchangeMetadata, resolveCategoryOrNull, resolvePressureModeOrNull } from "./stockExchangeMetadata";

export type {
  StockExchangeActionResolution,
  StockExchangeInspectionEvent,
  StockExchangeMarketCategory,
  StockExchangeMarketEffect,
  StockExchangeMetadata,
  StockExchangePressureMode,
  StockExchangeRiskEvent,
  StockExchangeTrendHint
} from "./stockExchangeTypes";
export { getStockExchangeMetadata } from "./stockExchangeMetadata";
export {
  applyStockExchangeFinancialInspections,
  applyStockExchangePassiveEffects,
  resolveStockExchangeInspectionRiskPct
} from "./stockExchangePassive";
export const applyStockExchangeIncomeModifiers = (input: {
  config: StockExchangeBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  tick: number;
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId) {
    return {
      cleanPerHour: input.cleanPerHour,
      dirtyPerHour: input.dirtyPerHour,
      heatPerDay: input.heatPerDay,
      influencePerDay: input.influencePerDay,
      maxLevel: 1
    };
  }
  const metadata = getStockExchangeMetadata(input.building, input.tick);
  const frozen = Number(metadata.incomeFrozenUntilTick || 0) > input.tick;
  return {
    cleanPerHour: frozen ? 0 : input.cleanPerHour,
    dirtyPerHour: 0,
    heatPerDay: input.heatPerDay,
    influencePerDay: frozen ? 0 : input.influencePerDay,
    maxLevel: 1
  };
};

export const resolveStockExchangeFeeReduction = (input: {
  building?: CoreGameState["buildingsById"][string];
  config?: StockExchangeBalanceConfig;
  tick: number;
}): { regularMarketPct: number; playerMarketPct: number; blackMarketPct: number; disabled: boolean } => {
  const config = input.config;
  if (!config || !input.building || input.building.buildingTypeId !== config.buildingTypeId || !input.building.ownerPlayerId) {
    return { regularMarketPct: 0, playerMarketPct: 0, blackMarketPct: 0, disabled: false };
  }
  const metadata = getStockExchangeMetadata(input.building, input.tick);
  const disabled = Number(metadata.feeReductionDisabledUntilTick || 0) > input.tick;
  if (disabled) return { regularMarketPct: 0, playerMarketPct: 0, blackMarketPct: 0, disabled: true };
  const insiderActive = Number(metadata.insiderWindowExpiresAtTick || 0) > input.tick;
  const extra = insiderActive ? config.marketFeeReduction.insiderExtraPct : 0;
  return {
    regularMarketPct: config.marketFeeReduction.regularMarketPct + extra,
    playerMarketPct: config.marketFeeReduction.playerMarketPct + extra,
    blackMarketPct: config.marketFeeReduction.blackMarketPct + extra,
    disabled: false
  };
};

export { resolveStockExchangeAction } from "./stockExchangeActionResolution";

export const validateStockExchangeAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  districtInfluence: number;
  config?: StockExchangeBalanceConfig;
  payload: RunBuildingActionCommand["payload"];
}): string | null => {
  const config = input.config;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getStockExchangeMetadata(input.building, input.state.root.tick);
  if (input.actionId === config.speculativeBuy.actionId) {
    const investment = Math.floor(Number(input.payload.investmentCleanCash ?? input.payload.investment ?? (input.payload.amount || 0)));
    if (!resolveCategoryOrNull(input.payload.targetCategory ?? input.payload.category, config.speculativeBuy.targetCategories)) return "stock_exchange_invalid_market_category";
    if (investment <= 0 || investment > config.speculativeBuy.maxInvestmentCleanCash) return "stock_exchange_invalid_investment";
    if (Math.max(0, Number(input.balances.cash || 0)) < config.speculativeBuy.costCleanCash + investment) return "stock_exchange_insufficient_clean_cash";
  }
  if (input.actionId === config.marketPressure.actionId) {
    const category = resolveCategoryOrNull(input.payload.targetCategory ?? input.payload.category, config.marketPressure.targetCategories);
    if (!category) return "stock_exchange_invalid_market_category";
    if (!resolvePressureModeOrNull(input.payload.mode)) return "stock_exchange_invalid_market_pressure_mode";
    if (Math.max(0, Number(input.balances.cash || 0)) < config.marketPressure.costCleanCash) return "stock_exchange_insufficient_clean_cash";
    if (Math.max(0, Number(input.districtInfluence || 0)) < config.marketPressure.costInfluence) return "stock_exchange_insufficient_influence";
    if (metadata.marketEffects.some((effect) => effect.category === category && effect.expiresAtTick > input.state.root.tick)) return "stock_exchange_market_pressure_active";
  }
  if (input.actionId === config.insiderWindow.actionId) {
    if (Math.max(0, Number(input.balances.cash || 0)) < config.insiderWindow.costCleanCash) return "stock_exchange_insufficient_clean_cash";
    if (Number(metadata.insiderWindowExpiresAtTick || 0) > input.state.root.tick) return "stock_exchange_insider_window_active";
  }
  return null;
};

