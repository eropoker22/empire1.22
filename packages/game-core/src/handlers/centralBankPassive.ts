import type { CentralBankBalanceConfig, LobbyClubBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";
import { applyRumorEventToState } from "../rules/events/rumorPipeline";
import type { CentralBankMetadata, CentralBankOversightEvent } from "./centralBankTypes";
import {
  getCentralBankMetadata,
  getOwnedCentralBank,
  getOwnedCentralBankCount,
  hasOwnedBuilding,
  minutesToTicks,
  resolveCentralBankTier,
  withCentralBankMetadata
} from "./centralBankMetadata";
import { resolveCentralBankReserveStats } from "./centralBankReserveStats";

export const applyCentralBankPassiveInterestAndOversight = (
  state: CoreGameState,
  config: CentralBankBalanceConfig,
  tickRateMs: number,
  lobbyClubConfig?: LobbyClubBalanceConfig
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
        const consequence = resolveOversightConsequence(nextState, bank, config, riskPct, tickRateMs, lobbyClubConfig);
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

export const resolveFinancialOversightRiskPct = (input: {
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
  tickRateMs: number,
  lobbyClubConfig?: LobbyClubBalanceConfig
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
  if (type === "reserve_check") {
    metadataPatch.interestDisabledUntilTick = state.root.tick + minutesToTicks(config.financialOversight.interestDisabledMinutes, tickRateMs);
  } else if (type === "banking_stop") {
    metadataPatch.liquidityBlockedUntilTick = state.root.tick + minutesToTicks(config.financialOversight.liquidityBlockedMinutes, tickRateMs);
  } else if (type === "regulatory_fine" && building.ownerPlayerId) {
    const result = applyProtectedCleanCashLoss(nextState, building.ownerPlayerId, config, config.financialOversight.regulatoryFineCleanCash, state.root.tick);
    nextState = result.state;
    cleanCashLost = result.cleanCashLost;
  } else if (type === "data_leak") {
    nextState = appendCentralBankRumor(nextState, building, lobbyClubConfig);
  } else if (type === "market_restriction") {
    metadataPatch.feeReductionDisabledUntilTick = state.root.tick + minutesToTicks(config.financialOversight.feeReductionDisabledMinutes, tickRateMs);
  }
  return {
    state: nextState,
    metadataPatch,
    event: { type, tick: state.root.tick, label: labelByType[type] ?? type, riskPct, cleanCashLost }
  };
};

export const applyProtectedCleanCashLoss = (
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

const appendCentralBankRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  lobbyClubConfig?: LobbyClubBalanceConfig
): CoreGameState => {
  const sourceEventId = `central-bank-oversight:${building.id}:${state.root.tick}:data-leak`;
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
    messageKey: "rumor.central_bank_oversight",
    negative: true,
    payload: { buildingTypeId: building.buildingTypeId, rumorType: "data_leak" }
  }, { lobbyClubConfig });
};
