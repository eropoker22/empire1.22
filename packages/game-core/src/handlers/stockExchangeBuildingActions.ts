import type { BuildingActionBalanceConfig, FixedBuildingBalanceConfig, StockExchangeBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { CityFeedEvent, RunBuildingActionCommand } from "@empire/shared-types";
import { deterministicUnitInterval } from "../utils/math";

export type StockExchangeMarketCategory = "materials" | "drugsAndBoosts" | "weapons" | "defenseItems" | "rareComponents";
export type StockExchangePressureMode = "pump" | "dump";

export interface StockExchangeRiskEvent {
  actionId: string;
  riskPct: number;
  expiresAtTick: number;
  tick: number;
}

export interface StockExchangeTrendHint {
  id: string;
  tick: number;
  category: StockExchangeMarketCategory;
  text: string;
}

export interface StockExchangeMarketEffect {
  id: string;
  category: StockExchangeMarketCategory;
  mode: StockExchangePressureMode;
  regularPriceModifierPct: number;
  blackMarketPriceModifierPct: number;
  startedAtTick: number;
  expiresAtTick: number;
  ownerPlayerId: string;
}

export interface StockExchangeInspectionEvent {
  type: string;
  tick: number;
  riskPct: number;
  label: string;
  rumorText?: string;
}

export interface StockExchangeMetadata {
  insiderWindowExpiresAtTick?: number;
  incomeFrozenUntilTick?: number;
  feeReductionDisabledUntilTick?: number;
  lastInspectionTick?: number;
  lastInsightTick?: number;
  actionHistory: Array<{ actionId: string; tick: number; category?: string; mode?: string }>;
  riskEvents: StockExchangeRiskEvent[];
  trendHints: StockExchangeTrendHint[];
  marketEffects: StockExchangeMarketEffect[];
  inspectionEvents: StockExchangeInspectionEvent[];
}

export interface StockExchangeActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  stockExchangeResult: Record<string, unknown>;
}

export const getStockExchangeMetadata = (
  building: CoreGameState["buildingsById"][string],
  tick = 0
): StockExchangeMetadata => cleanupStockExchangeMetadata(readStockExchangeMetadata(building), tick);

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

export const resolveStockExchangeInspectionRiskPct = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  config: StockExchangeBalanceConfig;
  tick: number;
}): number => {
  const metadata = getStockExchangeMetadata(input.building, input.tick);
  const player = input.building.ownerPlayerId ? input.state.playersById[input.building.ownerPlayerId] : undefined;
  const policeState = player ? input.state.policeStatesById[player.policeStateId] : undefined;
  const actionWindowTicks = minutesToTicks(input.config.financialInspection.multiActionWindowMinutes, 5000);
  const recentActions = metadata.actionHistory.filter((action) => input.tick - action.tick <= actionWindowTicks).length;
  const eventRisk = metadata.riskEvents.reduce((total, event) => total + Math.max(0, Number(event.riskPct || 0)), 0);
  const multiActionRisk = recentActions >= input.config.financialInspection.multiActionThreshold
    ? input.config.financialInspection.multiActionRiskPct
    : 0;
  const heatRisk = Number(policeState?.heat || 0) > input.config.financialInspection.heatThreshold
    ? input.config.financialInspection.heatRiskPct
    : 0;
  return Math.min(100, eventRisk + multiActionRisk + heatRisk);
};

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
      reportText: "Insider Window je aktivní. Trend hints jsou hlubší a Spekulativní nákup má vyšší šanci.",
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

export const applyStockExchangePassiveEffects = (
  state: CoreGameState,
  config: StockExchangeBalanceConfig,
  tickRateMs: number
): CoreGameState => {
  let buildingsById = state.buildingsById;
  let changed = false;
  const intervalTicks = minutesToTicks(config.marketInsight.intervalMinutes, tickRateMs);
  for (const building of Object.values(state.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || !building.ownerPlayerId || building.status !== "active") continue;
    const metadata = getStockExchangeMetadata(building, state.root.tick);
    if (Number(metadata.lastInsightTick ?? -intervalTicks) + intervalTicks > state.root.tick) continue;
    const insiderActive = Number(metadata.insiderWindowExpiresAtTick || 0) > state.root.tick;
    const hintCount = insiderActive ? config.marketInsight.insiderHintCount : config.marketInsight.baseHintCount;
    const nextHints = Array.from({ length: hintCount }, (_, index) => createTrendHint(state.root.tick, `${building.id}:${state.root.tick}:${index}`));
    buildingsById = {
      ...buildingsById,
      [building.id]: {
        ...building,
        metadata: withStockExchangeMetadata(building, {
          ...metadata,
          lastInsightTick: state.root.tick,
          trendHints: [...metadata.trendHints, ...nextHints].slice(-8)
        }),
        version: building.version + 1
      }
    };
    changed = true;
  }
  return changed ? { ...state, buildingsById } : state;
};

export const applyStockExchangeFinancialInspections = (
  state: CoreGameState,
  config: StockExchangeBalanceConfig,
  tickRateMs: number
): CoreGameState => {
  let nextState = state;
  const intervalTicks = minutesToTicks(config.financialInspection.intervalMinutes, tickRateMs);
  for (const building of Object.values(nextState.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || !building.ownerPlayerId || building.status !== "active") continue;
    const metadata = getStockExchangeMetadata(building, nextState.root.tick);
    if (Number(metadata.lastInspectionTick ?? 0) + intervalTicks > nextState.root.tick) continue;
    const riskPct = resolveStockExchangeInspectionRiskPct({ state: nextState, building, config, tick: nextState.root.tick });
    const roll = deterministicUnitInterval(`${nextState.serverInstance.worldSeed}:stock-inspection:${building.id}:${nextState.root.tick}`);
    let nextMetadata: StockExchangeMetadata = { ...metadata, lastInspectionTick: nextState.root.tick };
    if (roll < riskPct / 100) {
      const consequence = resolveInspectionConsequence(nextState, building, config, riskPct, tickRateMs);
      nextState = consequence.state;
      nextMetadata = { ...nextMetadata, ...consequence.metadataPatch, inspectionEvents: [...nextMetadata.inspectionEvents, consequence.event].slice(-8) };
    }
    const currentBuilding = nextState.buildingsById[building.id] ?? building;
    nextState = {
      ...nextState,
      buildingsById: {
        ...nextState.buildingsById,
        [building.id]: {
          ...currentBuilding,
          metadata: withStockExchangeMetadata(currentBuilding, nextMetadata),
          version: currentBuilding.version + 1
        }
      }
    };
  }
  return nextState;
};

const appendStockExchangeAction = (
  metadata: StockExchangeMetadata,
  actionId: string,
  tick: number,
  input: {
    category?: string;
    mode?: string;
    riskEvent?: StockExchangeRiskEvent;
    marketEffect?: StockExchangeMarketEffect;
  } = {}
): StockExchangeMetadata => ({
  ...metadata,
  actionHistory: [...metadata.actionHistory, { actionId, tick, category: input.category, mode: input.mode }].slice(-16),
  riskEvents: input.riskEvent ? [...metadata.riskEvents, input.riskEvent].slice(-12) : metadata.riskEvents,
  marketEffects: input.marketEffect ? [...metadata.marketEffects, input.marketEffect].slice(-8) : metadata.marketEffects
});

const resolveInspectionConsequence = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  config: StockExchangeBalanceConfig,
  riskPct: number,
  tickRateMs: number
): { state: CoreGameState; metadataPatch: Partial<StockExchangeMetadata>; event: StockExchangeInspectionEvent } => {
  const roll = deterministicUnitInterval(`${state.serverInstance.worldSeed}:stock-inspection-type:${building.id}:${state.root.tick}`);
  const type = ["frozen_accounts", "transaction_probe", "fine", "market_panic", "public_scandal"][Math.min(4, Math.floor(roll * 5))];
  const labelByType: Record<string, string> = {
    frozen_accounts: "Zmrazené účty",
    transaction_probe: "Vyšetřování transakcí",
    fine: "Pokuta",
    market_panic: "Panika na trhu",
    public_scandal: "Veřejný skandál"
  };
  let nextState = state;
  const metadataPatch: Partial<StockExchangeMetadata> = {};
  if (type === "frozen_accounts") {
    metadataPatch.incomeFrozenUntilTick = state.root.tick + minutesToTicks(config.financialInspection.frozenIncomeMinutes, tickRateMs);
  } else if (type === "transaction_probe") {
    metadataPatch.feeReductionDisabledUntilTick = state.root.tick + minutesToTicks(config.financialInspection.feeReductionDisabledMinutes, tickRateMs);
  } else if (type === "fine" && building.ownerPlayerId) {
    const player = state.playersById[building.ownerPlayerId];
    const resourceState = player ? state.resourceStatesById[player.resourceStateId] : null;
    if (player && resourceState) {
      nextState = {
        ...nextState,
        resourceStatesById: {
          ...nextState.resourceStatesById,
          [resourceState.id]: {
            ...resourceState,
            balances: {
              ...resourceState.balances,
              cash: Math.max(0, Number(resourceState.balances.cash || 0) - config.financialInspection.fineCleanCash)
            },
            version: resourceState.version + 1
          }
        }
      };
    }
  } else if (type === "market_panic") {
    metadataPatch.marketEffects = [
      ...getStockExchangeMetadata(building, state.root.tick).marketEffects,
      {
        id: `stock-market-panic:${building.id}:${state.root.tick}`,
        category: resolveRandomCategory(state, building.id),
        mode: "pump",
        regularPriceModifierPct: config.financialInspection.panicVolatilityPct,
        blackMarketPriceModifierPct: config.financialInspection.panicVolatilityPct * 0.4,
        startedAtTick: state.root.tick,
        expiresAtTick: state.root.tick + minutesToTicks(config.financialInspection.panicDurationMinutes, tickRateMs),
        ownerPlayerId: building.ownerPlayerId ?? ""
      }
    ];
  } else if (type === "public_scandal") {
    const district = state.districtsById[building.districtId];
    const rumorText = `Downtownem se šíří drb o finančním skandálu kolem Burzy. Grafy prý někdo ohýbal dřív, než trh stihl dýchat.`;
    if (district) {
      nextState = {
        ...nextState,
        districtsById: {
          ...nextState.districtsById,
          [district.id]: {
            ...district,
            heat: Math.max(0, Number(district.heat || 0) + config.financialInspection.scandalHeatGain),
            version: district.version + 1
          }
        }
      };
    }
    nextState = appendStockExchangeScandalRumor(nextState, building, rumorText);
    metadataPatch.inspectionEvents = [
      ...(metadataPatch.inspectionEvents ?? []),
      { type, tick: state.root.tick, riskPct, label: labelByType[type] ?? type, rumorText }
    ];
  }
  return {
    state: nextState,
    metadataPatch,
    event: metadataPatch.inspectionEvents?.[0] ?? { type, tick: state.root.tick, riskPct, label: labelByType[type] ?? type }
  };
};

const appendStockExchangeScandalRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  message: string
): CoreGameState => {
  const sourceEventId = `stock-inspection:${building.id}:${state.root.tick}:public-scandal`;
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
    messageKey: "rumor.stock_exchange_scandal",
    payload: {
      buildingTypeId: building.buildingTypeId,
      inspectionType: "public_scandal"
    }
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

const readStockExchangeMetadata = (building: CoreGameState["buildingsById"][string]): StockExchangeMetadata => {
  const raw = isRecord(building.metadata?.stockExchange) ? building.metadata.stockExchange : {};
  return {
    insiderWindowExpiresAtTick: asOptionalTick(raw.insiderWindowExpiresAtTick),
    incomeFrozenUntilTick: asOptionalTick(raw.incomeFrozenUntilTick),
    feeReductionDisabledUntilTick: asOptionalTick(raw.feeReductionDisabledUntilTick),
    lastInspectionTick: asOptionalTick(raw.lastInspectionTick),
    lastInsightTick: asOptionalTick(raw.lastInsightTick),
    actionHistory: Array.isArray(raw.actionHistory) ? raw.actionHistory.filter(isRecord).map((entry) => ({ actionId: String(entry.actionId || ""), tick: Math.floor(Number(entry.tick || 0)), category: entry.category ? String(entry.category) : undefined, mode: entry.mode ? String(entry.mode) : undefined })).filter((entry) => entry.actionId) : [],
    riskEvents: Array.isArray(raw.riskEvents) ? raw.riskEvents.filter(isRecord).map((entry) => ({ actionId: String(entry.actionId || ""), riskPct: Number(entry.riskPct || 0), expiresAtTick: Math.floor(Number(entry.expiresAtTick || 0)), tick: Math.floor(Number(entry.tick || 0)) })).filter((entry) => entry.actionId) : [],
    trendHints: Array.isArray(raw.trendHints) ? raw.trendHints.filter(isRecord).map((entry) => ({ id: String(entry.id || ""), tick: Math.floor(Number(entry.tick || 0)), category: resolveCategoryOrNull(entry.category, ["materials", "drugsAndBoosts", "weapons", "defenseItems", "rareComponents"]) ?? "materials", text: String(entry.text || "") })).filter((entry) => entry.id && entry.text) : [],
    marketEffects: Array.isArray(raw.marketEffects) ? raw.marketEffects.filter(isRecord).map(readMarketEffect).filter((effect): effect is StockExchangeMarketEffect => Boolean(effect)) : [],
    inspectionEvents: Array.isArray(raw.inspectionEvents) ? raw.inspectionEvents.filter(isRecord).map((entry) => ({ type: String(entry.type || ""), tick: Math.floor(Number(entry.tick || 0)), riskPct: Number(entry.riskPct || 0), label: String(entry.label || entry.type || ""), rumorText: entry.rumorText ? String(entry.rumorText) : undefined })).filter((entry) => entry.type) : []
  };
};

const cleanupStockExchangeMetadata = (metadata: StockExchangeMetadata, tick: number): StockExchangeMetadata => ({
  ...metadata,
  riskEvents: metadata.riskEvents.filter((event) => event.expiresAtTick > tick),
  marketEffects: metadata.marketEffects.filter((effect) => effect.expiresAtTick > tick),
  actionHistory: metadata.actionHistory.slice(-16),
  trendHints: metadata.trendHints.slice(-8),
  inspectionEvents: metadata.inspectionEvents.slice(-8)
});

const readMarketEffect = (entry: Record<string, unknown>): StockExchangeMarketEffect | null => {
  const category = resolveCategoryOrNull(entry.category, ["materials", "drugsAndBoosts", "weapons", "defenseItems", "rareComponents"]);
  const mode = resolvePressureModeOrNull(entry.mode);
  if (!category || !mode) return null;
  return {
    id: String(entry.id || ""),
    category,
    mode,
    regularPriceModifierPct: Number(entry.regularPriceModifierPct || 0),
    blackMarketPriceModifierPct: Number(entry.blackMarketPriceModifierPct || 0),
    startedAtTick: Math.floor(Number(entry.startedAtTick || 0)),
    expiresAtTick: Math.floor(Number(entry.expiresAtTick || 0)),
    ownerPlayerId: String(entry.ownerPlayerId || "")
  };
};

const createTrendHint = (tick: number, seed: string): StockExchangeTrendHint => {
  const templates: Array<{ category: StockExchangeMarketCategory; text: string }> = [
    { category: "materials", text: "Metal Parts pravděpodobně zdraží během příštích 10 minut." },
    { category: "rareComponents", text: "Tech Core má zvýšenou volatilitu." },
    { category: "weapons", text: "Zbraně mají rostoucí poptávku." },
    { category: "drugsAndBoosts", text: "Drogy jsou momentálně v přebytku." },
    { category: "defenseItems", text: "Defense itemy reagují na vyšší bojovou aktivitu." }
  ];
  const index = Math.min(templates.length - 1, Math.floor(deterministicUnitInterval(seed) * templates.length));
  const selected = templates[index];
  return { id: `trend:${tick}:${index}:${seed}`, tick, category: selected.category, text: selected.text };
};

const resolveRandomCategory = (state: CoreGameState, seed: string): StockExchangeMarketCategory => {
  const categories: StockExchangeMarketCategory[] = ["materials", "drugsAndBoosts", "weapons", "defenseItems", "rareComponents"];
  return categories[Math.min(categories.length - 1, Math.floor(deterministicUnitInterval(`${state.serverInstance.worldSeed}:${seed}:category`) * categories.length))];
};

const withStockExchangeMetadata = (
  building: CoreGameState["buildingsById"][string],
  stockExchange: StockExchangeMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  stockExchange
});

const resolveCategory = (value: unknown, allowed: string[]): StockExchangeMarketCategory =>
  resolveCategoryOrNull(value, allowed) ?? "materials";

const resolveCategoryOrNull = (value: unknown, allowed: string[]): StockExchangeMarketCategory | null => {
  const normalized = String(value ?? "").trim();
  return allowed.includes(normalized) ? normalized as StockExchangeMarketCategory : null;
};

const resolvePressureMode = (value: unknown): StockExchangePressureMode =>
  resolvePressureModeOrNull(value) ?? "pump";

const resolvePressureModeOrNull = (value: unknown): StockExchangePressureMode | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "pump" || normalized === "dump" ? normalized : null;
};

const interpolate = (min: number, max: number, roll: number): number =>
  min + (max - min) * Math.max(0, Math.min(1, roll));

const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil(Math.max(0, minutes) * 60000 / Math.max(1, tickRateMs)));

const asOptionalTick = (value: unknown): number | undefined => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.floor(numberValue) : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
