import type { BuildingActionCostPreviewView, RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, ResolvedGameModeConfig } from "../contracts/game-mode-config";
import type { CoreGameState } from "../entities";
import { getAirportMetadata } from "../handlers/airportBuildingActions";
import { resolveAirportExpressImportCost } from "../handlers/airportInstantImport";
import { resolveArcadeAction } from "../handlers/arcadeBuildingActions";
import { resolveCasinoAction } from "../handlers/casinoBuildingActions";
import { resolveCentralBankInfluenceActionCostReductionPct } from "../handlers/centralBankBuildingActions";
import { resolveCityHallAction, resolveCityHallInfluenceActionCostReductionPct } from "../handlers/cityHallBuildingActions";
import { resolveExchangeOfficeAction } from "../handlers/exchangeOfficeBuildingActions";
import { resolveLobbyClubInfluenceActionCostReductionPct } from "../handlers/lobbyClubBuildingActions";
import {
  applyFactionInfluenceGain,
  getFactionPassiveModifiers
} from "../rules/factions/factionRules";

const DEFAULT_SPECULATIVE_INVESTMENT_CLEAN_CASH = 1_000;

interface DynamicActionResolution {
  inputCost: Record<string, number>;
  outputGain: Record<string, number>;
  heatGain: number;
  influenceChange: number;
  reportText: string;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
}

export interface BuildingActionContractPreview {
  action: BuildingActionBalanceConfig;
  minimumInputCost: Record<string, number> | null;
  inputDefaultValues: Record<string, string | number>;
  inputMaximumValues: Record<string, number>;
  costPreview: BuildingActionCostPreviewView | null;
}

const createPreviewPayload = (input: {
  action: BuildingActionBalanceConfig;
  building: CoreGameState["buildingsById"][string];
  district: CoreGameState["districtsById"][string];
}): RunBuildingActionCommand["payload"] => ({
  actionId: input.action.actionId,
  buildingId: input.building.id,
  districtId: input.district.id
});

const resolveDeterministicDynamicAction = (input: {
  state: CoreGameState;
  config: ResolvedGameModeConfig;
  building: CoreGameState["buildingsById"][string];
  district: CoreGameState["districtsById"][string];
  action: BuildingActionBalanceConfig;
  playerBalances: Record<string, number>;
}): DynamicActionResolution | null => {
  const balance = input.config.balance;
  const actionId = input.action.actionId;
  const tickRateMs = input.config.tickRateMs;

  if (balance.casino && actionId === balance.casino.quietBackroom.actionId) {
    return resolveCasinoAction({
      state: input.state,
      building: input.building,
      action: input.action,
      balances: input.playerBalances,
      casinoConfig: balance.casino,
      tickRateMs,
      commandId: "projection:building-action"
    });
  }
  if (balance.exchangeOffice && actionId === balance.exchangeOffice.goodRate.actionId) {
    return resolveExchangeOfficeAction({
      state: input.state,
      building: input.building,
      action: input.action,
      balances: input.playerBalances,
      exchangeConfig: balance.exchangeOffice,
      tickRateMs
    });
  }
  if (balance.arcade && actionId === balance.arcade.backCashdesk.actionId) {
    return resolveArcadeAction({
      state: input.state,
      building: input.building,
      action: input.action,
      balances: input.playerBalances,
      arcadeConfig: balance.arcade,
      tickRateMs
    });
  }
  if (
    balance.cityHall
    && (actionId === balance.cityHall.cityContract.actionId
      || actionId === balance.cityHall.officialCover.actionId)
  ) {
    return resolveCityHallAction({
      state: input.state,
      building: input.building,
      action: input.action,
      balances: input.playerBalances,
      district: input.district,
      config: balance.cityHall,
      lobbyClubConfig: balance.lobbyClub,
      tickRateMs,
      commandId: "projection:building-action",
      payload: createPreviewPayload(input)
    });
  }
  return null;
};

const resolveProjectedInfluenceChange = (input: {
  state: CoreGameState;
  config: ResolvedGameModeConfig;
  building: CoreGameState["buildingsById"][string];
  playerId: string;
  influenceChange: number;
}): number => {
  let influenceChange = Number(input.influenceChange || 0);
  if (influenceChange < 0) {
    const balance = input.config.balance;
    const cityHallReduction = input.building.buildingTypeId !== "city_hall"
      ? resolveCityHallInfluenceActionCostReductionPct({
          state: input.state,
          playerId: input.playerId,
          config: balance.cityHall
        })
      : 0;
    const centralBankReduction = input.building.buildingTypeId !== "central_bank"
      ? resolveCentralBankInfluenceActionCostReductionPct({
          state: input.state,
          playerId: input.playerId,
          config: balance.centralBank
        })
      : 0;
    const lobbyClubReduction = input.building.buildingTypeId !== "lobby_club"
      ? resolveLobbyClubInfluenceActionCostReductionPct({
          state: input.state,
          playerId: input.playerId,
          config: balance.lobbyClub,
          tick: input.state.root.tick
        })
      : 0;
    const reductionPct = Math.min(25, cityHallReduction + centralBankReduction + lobbyClubReduction);
    if (reductionPct > 0) {
      influenceChange = -Math.ceil(Math.abs(influenceChange) * (1 - reductionPct / 100));
    }
  }
  return applyFactionInfluenceGain(
    influenceChange,
    getFactionPassiveModifiers(input.state, input.playerId, { config: input.config })
  );
};

export const resolveBuildingActionContractPreview = (input: {
  state: CoreGameState;
  config: ResolvedGameModeConfig;
  building: CoreGameState["buildingsById"][string];
  district: CoreGameState["districtsById"][string];
  action: BuildingActionBalanceConfig;
  playerId: string;
  playerBalances: Record<string, number>;
}): BuildingActionContractPreview => {
  let projectedAction: BuildingActionBalanceConfig = input.action;
  let minimumInputCost: Record<string, number> | null = null;
  const inputDefaultValues: Record<string, string | number> = {};
  const inputMaximumValues: Record<string, number> = {};
  let costPreview: BuildingActionCostPreviewView | null = null;
  const stockExchange = input.config.balance.stockExchange;
  const airport = input.config.balance.airport;

  if (stockExchange && input.action.actionId === stockExchange.speculativeBuy.actionId) {
    const fixedInputCost = { ...input.action.inputCost };
    const fixedCashCost = Math.max(0, Number(fixedInputCost.cash || 0));
    const availableCash = Math.max(0, Math.floor(Number(input.playerBalances.cash || 0)));
    const affordableMaximum = Math.max(0, availableCash - fixedCashCost);
    const maximumInvestment = Math.min(
      stockExchange.speculativeBuy.maxInvestmentCleanCash,
      affordableMaximum
    );
    const defaultInvestment = Math.max(
      1,
      Math.min(DEFAULT_SPECULATIVE_INVESTMENT_CLEAN_CASH, Math.max(1, maximumInvestment))
    );
    inputDefaultValues.investmentCleanCash = defaultInvestment;
    inputMaximumValues.investmentCleanCash = Math.max(1, maximumInvestment);
    minimumInputCost = {
      ...fixedInputCost,
      cash: fixedCashCost + 1
    };
    costPreview = {
      fixedInputCost,
      variableInputCosts: [{
        inputId: "investmentCleanCash",
        resourceKey: "cash",
        amountPerUnit: 1
      }]
    };
    projectedAction = {
      ...input.action,
      inputCost: {
        ...fixedInputCost,
        cash: fixedCashCost + defaultInvestment
      }
    };
  } else {
    const dynamicResolution = resolveDeterministicDynamicAction(input);
    if (dynamicResolution) {
      projectedAction = {
        ...input.action,
        inputCost: dynamicResolution.inputCost,
        outputGain: dynamicResolution.outputGain,
        heatGain: dynamicResolution.heatGain,
        influenceChange: dynamicResolution.influenceChange,
        effectModifiers: dynamicResolution.effectModifiers ?? input.action.effectModifiers,
        reportText: dynamicResolution.reportText
      };
    } else if (airport && input.action.actionId === airport.expressImport.actionId) {
      projectedAction = {
        ...input.action,
        inputCost: {
          ...input.action.inputCost,
          cash: resolveAirportExpressImportCost(
            airport,
            getAirportMetadata(input.building, input.state.root.tick)
          )
        }
      };
    }
  }

  projectedAction = {
    ...projectedAction,
    influenceChange: resolveProjectedInfluenceChange({
      state: input.state,
      config: input.config,
      building: input.building,
      playerId: input.playerId,
      influenceChange: projectedAction.influenceChange
    })
  };

  return {
    action: projectedAction,
    minimumInputCost,
    inputDefaultValues,
    inputMaximumValues,
    costPreview
  };
};
