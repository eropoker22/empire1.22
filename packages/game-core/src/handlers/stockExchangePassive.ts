import type { LobbyClubBalanceConfig, StockExchangeBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";
import { applyRumorEventToState } from "../rules/events/rumorPipeline";
import {
  getStockExchangeMetadata,
  minutesToTicks,
  withStockExchangeMetadata
} from "./stockExchangeMetadata";
import type {
  StockExchangeInspectionEvent,
  StockExchangeMarketCategory,
  StockExchangeMetadata,
  StockExchangeTrendHint
} from "./stockExchangeTypes";
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
  tickRateMs: number,
  lobbyClubConfig?: LobbyClubBalanceConfig
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
      const consequence = resolveInspectionConsequence(nextState, building, config, riskPct, tickRateMs, lobbyClubConfig);
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

const resolveInspectionConsequence = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  config: StockExchangeBalanceConfig,
  riskPct: number,
  tickRateMs: number,
  lobbyClubConfig?: LobbyClubBalanceConfig
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
    nextState = appendStockExchangeScandalRumor(nextState, building, lobbyClubConfig);
    metadataPatch.inspectionEvents = [
      ...(metadataPatch.inspectionEvents ?? []),
      { type, tick: state.root.tick, riskPct, label: labelByType[type] ?? type }
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
  lobbyClubConfig?: LobbyClubBalanceConfig
): CoreGameState => {
  const sourceEventId = `stock-inspection:${building.id}:${state.root.tick}:public-scandal`;
  return applyRumorEventToState(state, {
    sourceEventId,
    sourceType: "market",
    category: "rumor",
    severity: "high",
    truthiness: "unconfirmed",
    intelType: "scandal",
    visibility: "all",
    playerId: building.ownerPlayerId,
    districtId: building.districtId,
    createdAtTick: state.root.tick,
    messageKey: "rumor.stock_exchange_scandal",
    negative: true,
    payload: {
      buildingTypeId: building.buildingTypeId,
      inspectionType: "public_scandal"
    }
  }, { lobbyClubConfig });
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

