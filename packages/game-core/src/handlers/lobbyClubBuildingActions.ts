import type { CityFeedEvent, RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, FixedBuildingBalanceConfig, LobbyClubBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";
import { applyRumorEventToState } from "../rules/events/rumorPipeline";
import type { LobbyClubActionResolution, LobbyClubMetadata, LobbyClubScandalEvent } from "./lobbyClubTypes";
import {
  appendLobbyRiskEvent,
  getLobbyClubMetadata,
  getOwnedLobbyClubCount,
  getOwnedLobbyClubs,
  hasOwnedBuilding,
  minutesToTicks,
  resolveLobbyClubTier,
  withLobbyClubMetadata
} from "./lobbyClubMetadata";

export type { LobbyClubActionResolution, LobbyClubMetadata, LobbyClubRiskEvent, LobbyClubScandalEvent } from "./lobbyClubTypes";
export { getLobbyClubMetadata, getOwnedLobbyClubCount, getOwnedLobbyClubs, resolveLobbyClubTier } from "./lobbyClubMetadata";

export const applyLobbyClubIncomeModifiers = (input: {
  config: LobbyClubBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  tick: number;
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  const playerId = input.building.ownerPlayerId;
  const ownedClubs = getOwnedLobbyClubs(input.state, playerId, input.config);
  const tier = resolveLobbyClubTier(ownedClubs.length, input.config);
  const isLobbyClub = input.building.buildingTypeId === input.config.buildingTypeId;
  const backroomActive = ownedClubs.some((club) => Number(getLobbyClubMetadata(club, input.tick).backroomPressureExpiresAtTick || 0) > input.tick);
  const incomePenaltyActive = isLobbyClub && Number(getLobbyClubMetadata(input.building, input.tick).incomePenaltyUntilTick || 0) > input.tick;
  const cleanMultiplier = isLobbyClub ? (tier?.incomeMultiplier ?? 1) * (incomePenaltyActive ? 1 - input.config.lobbyScandal.incomePenaltyPct / 100 : 1) : 1;
  const influenceMultiplier = (isLobbyClub ? (tier?.influenceMultiplier ?? 1) : 1)
    * (backroomActive ? 1 + input.config.backroomPressure.influenceProductionBonusPct / 100 : 1);
  return {
    cleanPerHour: input.cleanPerHour * cleanMultiplier,
    dirtyPerHour: isLobbyClub ? 0 : input.dirtyPerHour,
    heatPerDay: isLobbyClub ? input.heatPerDay * (tier?.heatMultiplier ?? 1) : input.heatPerDay,
    influencePerDay: input.influencePerDay * influenceMultiplier,
    maxLevel: 1
  };
};

export const resolveLobbyClubInfluenceActionCostReductionPct = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: LobbyClubBalanceConfig;
  tick: number;
}): number => {
  if (!input.config || !input.playerId) return 0;
  const clubs = getOwnedLobbyClubs(input.state, input.playerId, input.config);
  if (clubs.length <= 0) return 0;
  const disabled = clubs.some((club) => Number(getLobbyClubMetadata(club, input.tick).influenceCostReductionDisabledUntilTick || 0) > input.tick);
  if (disabled) return 0;
  const baseReduction = clubs.length >= 2
    ? input.config.influenceCostReduction.twoClubPct
    : input.config.influenceCostReduction.oneClubPct;
  const activeReduction = clubs.some((club) => Number(getLobbyClubMetadata(club, input.tick).backroomPressureExpiresAtTick || 0) > input.tick)
    ? input.config.backroomPressure.influenceActionCostReductionPct
    : 0;
  const nextDiscount = Math.max(0, ...clubs.map((club) => Number(getLobbyClubMetadata(club, input.tick).nextInfluenceDiscountPct || 0)));
  return Math.min(input.config.influenceCostReduction.maxCombinedPct, baseReduction + activeReduction + nextDiscount);
};

export const hasLobbyClubNextInfluenceDiscount = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: LobbyClubBalanceConfig;
  tick: number;
}): boolean =>
  Boolean(input.config && input.playerId && getOwnedLobbyClubs(input.state, input.playerId, input.config).some((club) =>
    Number(getLobbyClubMetadata(club, input.tick).nextInfluenceDiscountExpiresAtTick || 0) > input.tick
  ));

export const consumeLobbyClubNextInfluenceDiscount = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: LobbyClubBalanceConfig;
  tick: number;
}): Record<string, CoreGameState["buildingsById"][string]> => {
  if (!input.config || !input.playerId) return {};
  return Object.fromEntries(getOwnedLobbyClubs(input.state, input.playerId, input.config).flatMap((club) => {
    const metadata = getLobbyClubMetadata(club, input.tick);
    if (!metadata.nextInfluenceDiscountExpiresAtTick || metadata.nextInfluenceDiscountExpiresAtTick <= input.tick) return [];
    const nextMetadata: LobbyClubMetadata = {
      ...metadata,
      nextInfluenceDiscountPct: undefined,
      nextInfluenceDiscountExpiresAtTick: undefined
    };
    return [[club.id, {
      ...club,
      metadata: withLobbyClubMetadata(club, nextMetadata),
      version: club.version + 1
    }]];
  }));
};

export const resolveLobbyClubNegativeRumorReductionPct = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: LobbyClubBalanceConfig;
  tick: number;
}): number => {
  if (!input.config || !input.playerId) return 0;
  const clubs = getOwnedLobbyClubs(input.state, input.playerId, input.config);
  if (clubs.length <= 0) return 0;
  const baseReduction = clubs.length >= 2
    ? input.config.negativeRumorReduction.twoClubPct
    : input.config.negativeRumorReduction.oneClubPct;
  const backroom = clubs.some((club) => Number(getLobbyClubMetadata(club, input.tick).backroomPressureExpiresAtTick || 0) > input.tick)
    ? input.config.backroomPressure.negativeRumorReductionPct
    : 0;
  const media = clubs.some((club) => Number(getLobbyClubMetadata(club, input.tick).mediaScreenExpiresAtTick || 0) > input.tick)
    ? input.config.mediaScreen.negativeRumorReductionPct
    : 0;
  return Math.min(95, baseReduction + backroom + media);
};

export const resolveLobbyClubScandalRiskPct = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  config: LobbyClubBalanceConfig;
  tick: number;
}): number => {
  const metadata = getLobbyClubMetadata(input.building, input.tick);
  const player = input.building.ownerPlayerId ? input.state.playersById[input.building.ownerPlayerId] : undefined;
  const policeState = player ? input.state.policeStatesById[player.policeStateId] : undefined;
  const eventRisk = metadata.riskEvents.reduce((total, event) => total + Math.max(0, Number(event.riskPct || 0)), 0);
  const riskReduction = Number(metadata.riskReductionExpiresAtTick || 0) > input.tick
    ? input.config.quietNegotiation.riskReductionPct
    : 0;
  const cityHallRisk = hasOwnedBuilding(input.state, input.building.ownerPlayerId, "city_hall") ? input.config.lobbyScandal.cityHallRiskPct : 0;
  const stockRisk = hasOwnedBuilding(input.state, input.building.ownerPlayerId, "stock_exchange") ? input.config.lobbyScandal.stockExchangeRiskPct : 0;
  const heatRisk = Number(policeState?.heat || 0) > input.config.lobbyScandal.heatThreshold ? input.config.lobbyScandal.heatRiskPct : 0;
  return Math.max(0, Math.min(100, (input.config.lobbyScandal.passiveRiskPct + eventRisk + cityHallRisk + stockRisk + heatRisk) * (1 - riskReduction / 100)));
};

export const resolveLobbyClubAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
  district: CoreGameState["districtsById"][string];
  config: LobbyClubBalanceConfig;
  tickRateMs: number;
  commandId: string;
  payload: RunBuildingActionCommand["payload"];
}): LobbyClubActionResolution | null => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId) return null;
  const metadata = getLobbyClubMetadata(input.building, input.state.root.tick);
  const actionId = input.action.actionId;

  if (actionId === input.config.backroomPressure.actionId) {
    const expiresAtTick = input.state.root.tick + minutesToTicks(input.config.backroomPressure.durationMinutes, input.tickRateMs);
    const nextMetadata = appendLobbyRiskEvent({
      ...metadata,
      backroomPressureExpiresAtTick: expiresAtTick
    }, actionId, input.config.backroomPressure.scandalRiskPct, expiresAtTick, input.state.root.tick);
    return {
      balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) - input.config.backroomPressure.costCleanCash) },
      buildingMetadata: withLobbyClubMetadata(input.building, nextMetadata),
      heatGain: input.config.backroomPressure.heatGain,
      influenceChange: -input.config.backroomPressure.costInfluence,
      inputCost: { cash: input.config.backroomPressure.costCleanCash },
      outputGain: {},
      effectModifiers: { influenceMultiplier: 1 + input.config.backroomPressure.influenceProductionBonusPct / 100 },
      reportText: "Zákulisní tlak je aktivní. Lobby síť na několik minut tlačí influence a drží drby níž.",
      lobbyClubResult: {
        type: "backroom_pressure",
        activeUntilTick: expiresAtTick,
        influenceProductionBonusPct: input.config.backroomPressure.influenceProductionBonusPct,
        influenceActionCostReductionPct: input.config.backroomPressure.influenceActionCostReductionPct,
        lobbyScandalRiskAddedPct: input.config.backroomPressure.scandalRiskPct
      }
    };
  }

  if (actionId === input.config.quietNegotiation.actionId) {
    const riskExpiresAtTick = input.state.root.tick + minutesToTicks(input.config.quietNegotiation.riskReductionMinutes, input.tickRateMs);
    const nextDiscountExpiresAtTick = input.state.root.tick + minutesToTicks(input.config.quietNegotiation.nextInfluenceActionDiscountMinutes, input.tickRateMs);
    const cooldownPatch = reduceOneEligibleCooldown(input);
    const nextMetadata = appendLobbyRiskEvent({
      ...metadata,
      riskReductionExpiresAtTick: riskExpiresAtTick,
      nextInfluenceDiscountPct: input.config.quietNegotiation.nextInfluenceActionDiscountPct,
      nextInfluenceDiscountExpiresAtTick: nextDiscountExpiresAtTick
    }, actionId, input.config.quietNegotiation.scandalRiskPct, riskExpiresAtTick, input.state.root.tick);
    return {
      balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) - input.config.quietNegotiation.costCleanCash) },
      buildingMetadata: withLobbyClubMetadata(input.building, nextMetadata),
      buildingPatchesById: cooldownPatch.building ? { [cooldownPatch.building.id]: cooldownPatch.building } : undefined,
      heatGain: input.config.quietNegotiation.heatGain,
      influenceChange: -input.config.quietNegotiation.costInfluence,
      inputCost: { cash: input.config.quietNegotiation.costCleanCash },
      outputGain: {},
      reportText: cooldownPatch.actionId
        ? `Tiché vyjednávání zkrátilo cooldown ${cooldownPatch.actionId} o ${cooldownPatch.reducedTicks} ticků.`
        : "Tiché vyjednávání snížilo rizika a připravilo slevu na další influence akci.",
      lobbyClubResult: {
        type: "quiet_negotiation",
        riskReductionPct: input.config.quietNegotiation.riskReductionPct,
        riskReductionUntilTick: riskExpiresAtTick,
        nextInfluenceDiscountPct: input.config.quietNegotiation.nextInfluenceActionDiscountPct,
        reducedCooldownActionId: cooldownPatch.actionId,
        reducedCooldownTicks: cooldownPatch.reducedTicks,
        lobbyScandalRiskAddedPct: input.config.quietNegotiation.scandalRiskPct
      }
    };
  }

  if (actionId === input.config.mediaScreen.actionId) {
    const expiresAtTick = input.state.root.tick + minutesToTicks(input.config.mediaScreen.durationMinutes, input.tickRateMs);
    const nextMetadata = appendLobbyRiskEvent({
      ...metadata,
      mediaScreenExpiresAtTick: expiresAtTick
    }, actionId, input.config.mediaScreen.scandalRiskPct, expiresAtTick, input.state.root.tick);
    return {
      balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) - input.config.mediaScreen.costCleanCash) },
      buildingMetadata: withLobbyClubMetadata(input.building, nextMetadata),
      heatGain: input.config.mediaScreen.heatGain,
      influenceChange: 0,
      inputCost: { cash: input.config.mediaScreen.costCleanCash },
      outputGain: {},
      reportText: "Mediální clona je aktivní. Negativní drby se hůř prosazují a veřejný obraz je čistší.",
      lobbyClubResult: {
        type: "media_screen",
        activeUntilTick: expiresAtTick,
        negativeRumorReductionPct: input.config.mediaScreen.negativeRumorReductionPct,
        policeRaidWarningChancePct: input.config.mediaScreen.policeRaidWarningChancePct,
        weakRewriteChancePct: input.config.mediaScreen.weakRewriteChancePct,
        lobbyScandalRiskAddedPct: input.config.mediaScreen.scandalRiskPct
      }
    };
  }

  return null;
};

export const validateLobbyClubAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  actionId: string;
  balances: Record<string, number>;
  districtInfluence: number;
  config?: LobbyClubBalanceConfig;
}): string | null => {
  const config = input.config;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getLobbyClubMetadata(input.building, input.state.root.tick);
  if (input.actionId === config.backroomPressure.actionId) {
    if (Number(metadata.backroomPressureExpiresAtTick || 0) > input.state.root.tick) return "lobby_club_backroom_pressure_active";
    if (Math.max(0, Number(input.balances.cash || 0)) < config.backroomPressure.costCleanCash) return "lobby_club_insufficient_clean_cash";
    if (Math.max(0, Number(input.districtInfluence || 0)) < config.backroomPressure.costInfluence) return "lobby_club_insufficient_influence";
  }
  if (input.actionId === config.quietNegotiation.actionId) {
    if (Math.max(0, Number(input.balances.cash || 0)) < config.quietNegotiation.costCleanCash) return "lobby_club_insufficient_clean_cash";
    if (Math.max(0, Number(input.districtInfluence || 0)) < config.quietNegotiation.costInfluence) return "lobby_club_insufficient_influence";
  }
  if (input.actionId === config.mediaScreen.actionId) {
    if (Number(metadata.mediaScreenExpiresAtTick || 0) > input.state.root.tick) return "lobby_club_media_screen_active";
    if (Math.max(0, Number(input.balances.cash || 0)) < config.mediaScreen.costCleanCash) return "lobby_club_insufficient_clean_cash";
  }
  return null;
};

export const applyLobbyClubScandalChecks = (
  state: CoreGameState,
  config: LobbyClubBalanceConfig,
  tickRateMs: number
): CoreGameState => {
  let nextState = state;
  const intervalTicks = minutesToTicks(config.lobbyScandal.intervalMinutes, tickRateMs);
  for (const building of Object.values(nextState.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || !building.ownerPlayerId || building.status !== "active") continue;
    const metadata = getLobbyClubMetadata(building, nextState.root.tick);
    if (Number(metadata.lastScandalCheckTick ?? 0) + intervalTicks > nextState.root.tick) continue;
    const riskPct = resolveLobbyClubScandalRiskPct({ state: nextState, building, config, tick: nextState.root.tick });
    let nextMetadata: LobbyClubMetadata = { ...metadata, lastScandalCheckTick: nextState.root.tick };
    const roll = deterministicUnitInterval(`${nextState.serverInstance.worldSeed}:lobby-club-scandal:${building.id}:${nextState.root.tick}`);
    if (roll < riskPct / 100) {
      const consequence = resolveScandalConsequence(nextState, building, config, riskPct, tickRateMs);
      nextState = consequence.state;
      nextMetadata = { ...nextMetadata, ...consequence.metadataPatch, scandalEvents: [...nextMetadata.scandalEvents, consequence.event].slice(-8) };
    }
    const currentBuilding = nextState.buildingsById[building.id] ?? building;
    nextState = {
      ...nextState,
      buildingsById: {
        ...nextState.buildingsById,
        [building.id]: {
          ...currentBuilding,
          metadata: withLobbyClubMetadata(currentBuilding, nextMetadata),
          version: currentBuilding.version + 1
        }
      }
    };
  }
  return nextState;
};

const reduceOneEligibleCooldown = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  config: LobbyClubBalanceConfig;
}): { building: CoreGameState["buildingsById"][string] | null; actionId: string | null; reducedTicks: number } => {
  const candidates = Object.values(input.state.buildingsById)
    .filter((building) =>
      building.ownerPlayerId === input.building.ownerPlayerId &&
      building.status === "active" &&
      input.config.quietNegotiation.targetBuildingTypeIds.includes(building.buildingTypeId)
    )
    .flatMap((building) => Object.entries(building.actionCooldowns ?? {})
      .map(([actionId, cooldownUntilTick]) => ({
        building,
        actionId,
        remainingTicks: Math.max(0, Number(cooldownUntilTick || 0) - input.state.root.tick)
      }))
      .filter((entry) => entry.remainingTicks > 0))
    .sort((a, b) => b.remainingTicks - a.remainingTicks);
  const target = candidates[0];
  if (!target) return { building: null, actionId: null, reducedTicks: 0 };
  const reducedTicks = Math.max(1, Math.floor(target.remainingTicks * input.config.quietNegotiation.cooldownRemainingReductionPct / 100));
  return {
    building: {
      ...target.building,
      actionCooldowns: {
        ...(target.building.actionCooldowns ?? {}),
        [target.actionId]: Math.max(input.state.root.tick, Number(target.building.actionCooldowns?.[target.actionId] || 0) - reducedTicks)
      },
      version: target.building.version + 1
    },
    actionId: target.actionId,
    reducedTicks
  };
};

const resolveScandalConsequence = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  config: LobbyClubBalanceConfig,
  riskPct: number,
  tickRateMs: number
): { state: CoreGameState; metadataPatch: Partial<LobbyClubMetadata>; event: LobbyClubScandalEvent } => {
  const type = ["meeting_leak", "public_pressure", "lost_sponsor", "political_stop", "police_interest"][Math.min(4, Math.floor(deterministicUnitInterval(`${state.serverInstance.worldSeed}:lobby-club-scandal-type:${building.id}:${state.root.tick}`) * 5))];
  const labelByType: Record<string, string> = {
    meeting_leak: "Únik schůzky",
    public_pressure: "Veřejný tlak",
    lost_sponsor: "Ztracený sponzor",
    political_stop: "Politická stopka",
    police_interest: "Policejní zájem"
  };
  let nextState = state;
  const metadataPatch: Partial<LobbyClubMetadata> = {};
  if (type === "meeting_leak") {
    nextState = appendLobbyRumor(nextState, building, "medium", config);
  } else if (type === "public_pressure") {
    const district = state.districtsById[building.districtId];
    if (district) {
      nextState = {
        ...nextState,
        districtsById: {
          ...nextState.districtsById,
          [district.id]: {
            ...district,
            influence: Math.max(0, Number(district.influence || 0) - config.lobbyScandal.influenceLoss),
            version: district.version + 1
          }
        }
      };
    }
  } else if (type === "lost_sponsor") {
    metadataPatch.incomePenaltyUntilTick = state.root.tick + minutesToTicks(config.lobbyScandal.incomePenaltyMinutes, tickRateMs);
  } else if (type === "political_stop") {
    metadataPatch.influenceCostReductionDisabledUntilTick = state.root.tick + minutesToTicks(config.lobbyScandal.influenceReductionDisabledMinutes, tickRateMs);
  } else if (type === "police_interest") {
    const district = state.districtsById[building.districtId];
    if (district) {
      nextState = {
        ...nextState,
        districtsById: {
          ...nextState.districtsById,
          [district.id]: {
            ...district,
            heat: Math.max(0, Number(district.heat || 0) + config.lobbyScandal.policeHeatGain),
            version: district.version + 1
          }
        }
      };
    }
  }
  return {
    state: nextState,
    metadataPatch,
    event: { type, tick: state.root.tick, label: labelByType[type] ?? type, riskPct }
  };
};

const appendLobbyRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  severity: CityFeedEvent["severity"],
  lobbyClubConfig?: LobbyClubBalanceConfig
): CoreGameState => {
  const sourceEventId = `lobby-club-scandal:${building.id}:${state.root.tick}:meeting-leak`;
  return applyRumorEventToState(state, {
    sourceEventId,
    sourceType: "building_action",
    category: "rumor",
    severity,
    truthiness: "unconfirmed",
    intelType: "scandal",
    visibility: "all",
    playerId: building.ownerPlayerId,
    districtId: building.districtId,
    createdAtTick: state.root.tick,
    messageKey: "rumor.lobby_club_scandal",
    negative: true,
    payload: { buildingTypeId: building.buildingTypeId, rumorType: "meeting_leak" }
  }, { lobbyClubConfig });
};
