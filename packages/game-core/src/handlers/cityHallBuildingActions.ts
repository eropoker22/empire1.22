import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, CityHallBalanceConfig, FixedBuildingBalanceConfig, LobbyClubBalanceConfig } from "../contracts";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities";
import type { CityHallActionResolution } from "./cityHallTypes";
import { getCurrentDayNightPhase } from "../rules/day-night/dayNightPhase";
import { getOwnedLobbyClubCount } from "./lobbyClubBuildingActions";
import {
  appendRiskEvent,
  countOwnedBuildings,
  getCityHallMetadata,
  getOwnedCityHall,
  minutesToTicks,
  resolveDecreeMode,
  resolveDecreeModeOrNull,
  withCityHallMetadata
} from "./cityHallMetadata";

export type { CityHallActionResolution, CityHallDecreeMode, CityHallMetadata } from "./cityHallTypes";
export { applyCityHallCorruptionScandals, resolveCityHallScandalRiskPct } from "./cityHallScandals";
export { getCityHallMetadata } from "./cityHallMetadata";

export const applyCityHallIncomeModifiers = (input: {
  config: CityHallBalanceConfig;
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  districtId?: string;
  tick: number;
  cleanPerHour: number;
  dirtyPerHour: number;
  heatPerDay: number;
  influencePerDay: number;
}): FixedBuildingBalanceConfig => {
  const cityHall = getOwnedCityHall(input.state, input.building.ownerPlayerId, input.config);
  const metadata = cityHall ? getCityHallMetadata(cityHall, input.tick) : undefined;
  const isCityHall = input.building.buildingTypeId === input.config.buildingTypeId;
  const influencePenaltyActive = isCityHall && Number(metadata?.influencePenaltyUntilTick || 0) > input.tick;
  const authorityActive = Boolean(cityHall);
  const legalHeatReduction = authorityActive && input.config.cityAuthority.legalBuildingTypeIds.includes(input.building.buildingTypeId)
    ? input.config.cityAuthority.legalBuildingHeatReductionPct
    : 0;
  const officialCover = input.districtId ? metadata?.officialCoverByDistrictId[input.districtId] : undefined;
  const officialCoverReduction = officialCover && officialCover.expiresAtTick > input.tick
    ? officialCover.heatGainReductionPct
    : 0;
  const decreeReduction = Number(metadata?.emergencyDecree?.expiresAtTick || 0) > input.tick && metadata?.emergencyDecree?.modeId === "suspended_checks"
    ? input.config.emergencyDecree.modes.suspendedChecks.heatGainReductionPct
    : 0;
  const heatMultiplier = (1 - legalHeatReduction / 100) * (1 - officialCoverReduction / 100) * (1 - decreeReduction / 100);
  const influenceMultiplier = authorityActive ? 1 + input.config.cityAuthority.influenceGenerationBonusPct / 100 : 1;
  return {
    cleanPerHour: isCityHall ? input.cleanPerHour : input.cleanPerHour,
    dirtyPerHour: isCityHall ? 0 : input.dirtyPerHour,
    heatPerDay: input.heatPerDay * Math.max(0, heatMultiplier),
    influencePerDay: input.influencePerDay * influenceMultiplier * (influencePenaltyActive ? 1 - input.config.corruptionScandal.influencePenaltyPct / 100 : 1),
    maxLevel: 1
  };
};

export const resolveCityHallInfluenceActionCostReductionPct = (input: {
  state: CoreGameState;
  playerId: string | null | undefined;
  config?: CityHallBalanceConfig;
}): number => {
  if (!input.config || !input.playerId) return 0;
  return getOwnedCityHall(input.state, input.playerId, input.config)
    ? Math.min(input.config.cityAuthority.maxInfluenceActionCostReductionPct, input.config.cityAuthority.influenceActionCostReductionPct)
    : 0;
};

export interface CityHallNightPatrolPressure {
  active: boolean;
  durationMultiplier: number;
  cooldownMultiplier: number;
  heatMultiplier: number;
  effectSummary: string | null;
}

const INACTIVE_NIGHT_PATROL_PRESSURE: CityHallNightPatrolPressure = Object.freeze({
  active: false,
  durationMultiplier: 1,
  cooldownMultiplier: 1,
  heatMultiplier: 1,
  effectSummary: null
});

export const resolveCityHallNightPatrolPressure = (input: {
  state: CoreGameState;
  context: GameCoreContext;
  targetDistrict: CoreGameState["districtsById"][string] | undefined;
  tick?: number;
}): CityHallNightPatrolPressure => {
  const config = input.context.config.balance.cityHall;
  const targetOwnerPlayerId = input.targetDistrict?.ownerPlayerId;
  const tick = Math.max(0, Math.floor(Number(input.tick ?? input.state.root.tick) || 0));
  if (!config || !targetOwnerPlayerId) return INACTIVE_NIGHT_PATROL_PRESSURE;
  if (getCurrentDayNightPhase(input.state, input.context, tick).phaseId !== "night") return INACTIVE_NIGHT_PATROL_PRESSURE;

  const cityHall = getOwnedCityHall(input.state, targetOwnerPlayerId, config);
  const decree = cityHall ? getCityHallMetadata(cityHall, tick).emergencyDecree : undefined;
  if (!decree || decree.modeId !== "night_patrols" || decree.expiresAtTick <= tick) return INACTIVE_NIGHT_PATROL_PRESSURE;

  const mode = config.emergencyDecree.modes.nightPatrols;
  const durationPct = Math.max(0, Number(mode.incomingAttackPreparationIncreasePct || 0));
  const cooldownPct = Math.max(0, Number(mode.districtRobberyCooldownIncreasePct || 0));
  const heatPct = Math.max(durationPct, Math.max(0, Number(mode.defenseBonusPct || 0)));
  return {
    active: true,
    durationMultiplier: 1 + durationPct / 100,
    cooldownMultiplier: 1 + cooldownPct / 100,
    heatMultiplier: 1 + heatPct / 100,
    effectSummary: `Noční hlídky Magistrátu: hostile akce proti chráněným districtům jsou pomalejší a viditelnější.`
  };
};

export const resolveCityHallAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
  district: CoreGameState["districtsById"][string];
  config: CityHallBalanceConfig;
  lobbyClubConfig?: LobbyClubBalanceConfig;
  tickRateMs: number;
  commandId: string;
  payload: RunBuildingActionCommand["payload"];
}): CityHallActionResolution | null => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId) return null;
  const metadata = getCityHallMetadata(input.building, input.state.root.tick);
  const actionId = input.action.actionId;

  if (actionId === input.config.officialCover.actionId) {
    const coveredDistricts = getOwnedCoverDistricts(input.state, input.building.ownerPlayerId);
    const expiresAtTick = input.state.root.tick + minutesToTicks(input.config.officialCover.durationMinutes, input.tickRateMs);
    const cleanCost = resolveLobbyDiscountedCleanCost(
      input.config.officialCover.costCleanCash,
      input.state,
      input.building.ownerPlayerId,
      input.lobbyClubConfig?.synergies.cityHallOfficialCoverCostReductionPct,
      input.lobbyClubConfig
    );
    const coverByDistrictId = Object.fromEntries(coveredDistricts.map((district) => [district.id, {
      districtId: district.id,
      expiresAtTick,
      heatGainReductionPct: input.config.officialCover.heatGainReductionPct,
      policeControlChanceReductionPct: input.config.officialCover.policeControlChanceReductionPct,
      rumorChanceReductionPct: input.config.officialCover.rumorChanceReductionPct
    }]));
    const nextMetadata = appendRiskEvent({
      ...metadata,
      officialCoverByDistrictId: {
        ...metadata.officialCoverByDistrictId,
        ...coverByDistrictId
      }
    }, actionId, input.config.officialCover.riskPct, expiresAtTick, input.state.root.tick);
    return {
      balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) - cleanCost) },
      buildingMetadata: withCityHallMetadata(input.building, nextMetadata),
      heatGain: input.config.officialCover.heatGain,
      influenceChange: -input.config.officialCover.costInfluence,
      inputCost: { cash: cleanCost },
      outputGain: {},
      reportText: `Úřední krytí je aktivní ve všech vlastněných districtech (${coveredDistricts.length}) do ticku ${expiresAtTick}.`,
      cityHallResult: {
        type: "official_cover",
        targetDistrictIds: coveredDistricts.map((district) => district.id),
        affectedDistrictCount: coveredDistricts.length,
        activeUntilTick: expiresAtTick,
        heatGainReductionPct: input.config.officialCover.heatGainReductionPct,
        policeControlChanceReductionPct: input.config.officialCover.policeControlChanceReductionPct,
        rumorChanceReductionPct: input.config.officialCover.rumorChanceReductionPct,
        cleanCashCost: cleanCost,
        corruptionRiskAddedPct: input.config.officialCover.riskPct
      }
    };
  }

  if (actionId === input.config.cityContract.actionId) {
    const legalBuildingCount = countOwnedBuildings(input.state, input.building.ownerPlayerId, input.config.cityContract.legalBuildingTypeIds);
    const hasSynergy = countOwnedBuildings(input.state, input.building.ownerPlayerId, ["restaurant"]) >= input.config.cityContract.restaurantSynergyThreshold
      && countOwnedBuildings(input.state, input.building.ownerPlayerId, ["convenience_store"]) >= input.config.cityContract.convenienceSynergyThreshold;
    const baseReward = Math.min(
      input.config.cityContract.maxRewardCleanCash,
      input.config.cityContract.baseRewardCleanCash + legalBuildingCount * input.config.cityContract.rewardPerLegalBuilding
    );
    const lobbyRewardMultiplier = hasLobbyClub(input.state, input.building.ownerPlayerId, input.lobbyClubConfig)
      ? 1 + Number(input.lobbyClubConfig?.synergies.cityHallContractRewardPct || 0) / 100
      : 1;
    const reward = Math.floor(baseReward * (hasSynergy ? 1 + input.config.cityContract.restaurantConvenienceSynergyPct / 100 : 1) * lobbyRewardMultiplier);
    const riskExpiresAtTick = input.state.root.tick + minutesToTicks(input.config.cityContract.riskDurationMinutes, input.tickRateMs);
    const nextMetadata = appendRiskEvent(metadata, actionId, input.config.cityContract.riskPct, riskExpiresAtTick, input.state.root.tick);
    return {
      balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) + reward) },
      buildingMetadata: withCityHallMetadata(input.building, nextMetadata),
      heatGain: input.config.cityContract.heatGain,
      influenceChange: -input.config.cityContract.costInfluence,
      inputCost: {},
      outputGain: { cash: reward },
      reportText: `Městská zakázka přinesla ${reward} clean cash za ${legalBuildingCount} legálních budov.`,
      cityHallResult: {
        type: "city_contract",
        legalBuildingCount,
        baseRewardCleanCash: input.config.cityContract.baseRewardCleanCash,
        rewardPerLegalBuilding: input.config.cityContract.rewardPerLegalBuilding,
        synergyApplied: hasSynergy,
        lobbySupportApplied: lobbyRewardMultiplier > 1,
        rewardCleanCash: reward,
        influenceCost: input.config.cityContract.costInfluence,
        corruptionRiskAddedPct: input.config.cityContract.riskPct,
        riskExpiresAtTick
      }
    };
  }

  if (actionId === input.config.emergencyDecree.actionId) {
    const modeId = resolveDecreeMode(input.payload.mode);
    const zone = modeId === "construction_closure" ? String(input.payload.targetZone ?? input.payload.category ?? input.district.zone ?? "").trim() : undefined;
    const expiresAtTick = input.state.root.tick + minutesToTicks(input.config.emergencyDecree.durationMinutes, input.tickRateMs);
    const nextMetadata = appendRiskEvent({
      ...metadata,
      emergencyDecree: { modeId, zone, expiresAtTick }
    }, actionId, input.config.emergencyDecree.riskPct, expiresAtTick, input.state.root.tick);
    return {
      balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) - input.config.emergencyDecree.costCleanCash) },
      buildingMetadata: withCityHallMetadata(input.building, nextMetadata),
      heatGain: input.config.emergencyDecree.heatGain,
      influenceChange: -input.config.emergencyDecree.costInfluence,
      inputCost: { cash: input.config.emergencyDecree.costCleanCash },
      outputGain: {},
      reportText: "Magistrát vydal nouzovou vyhlášku. Město se na chvíli mění.",
      cityHallResult: {
        type: "emergency_decree",
        modeId,
        zone,
        activeUntilTick: expiresAtTick,
        announcement: "Magistrát vydal nouzovou vyhlášku. Město se na chvíli mění.",
        corruptionRiskAddedPct: input.config.emergencyDecree.riskPct
      }
    };
  }

  return null;
};

const getOwnedCoverDistricts = (
  state: CoreGameState,
  playerId: string | null | undefined
): Array<CoreGameState["districtsById"][string]> =>
  playerId
    ? Object.values(state.districtsById).filter((district) =>
        district.ownerPlayerId === playerId && district.status !== "destroyed"
      )
    : [];

const hasLobbyClub = (
  state: CoreGameState,
  playerId: string | null | undefined,
  config?: LobbyClubBalanceConfig
): boolean =>
  Boolean(config && playerId && getOwnedLobbyClubCount(state, playerId, config) > 0);

const resolveLobbyDiscountedCleanCost = (
  baseCost: number,
  state: CoreGameState,
  playerId: string | null | undefined,
  reductionPct: number | undefined,
  config?: LobbyClubBalanceConfig
): number =>
  hasLobbyClub(state, playerId, config)
    ? Math.ceil(baseCost * (1 - Math.max(0, Number(reductionPct || 0)) / 100))
    : baseCost;

export const validateCityHallAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  district: CoreGameState["districtsById"][string];
  actionId: string;
  balances: Record<string, number>;
  districtInfluence: number;
  config?: CityHallBalanceConfig;
  payload: RunBuildingActionCommand["payload"];
}): string | null => {
  const config = input.config;
  if (!config || input.building.buildingTypeId !== config.buildingTypeId) return null;
  const metadata = getCityHallMetadata(input.building, input.state.root.tick);
  if (input.actionId === config.officialCover.actionId) {
    const coveredDistricts = getOwnedCoverDistricts(input.state, input.building.ownerPlayerId);
    if (!coveredDistricts.length) return "city_hall_invalid_target_district";
    if (coveredDistricts.some((district) => metadata.officialCoverByDistrictId[district.id]?.expiresAtTick > input.state.root.tick)) return "city_hall_official_cover_active";
    if (Math.max(0, Number(input.balances.cash || 0)) < config.officialCover.costCleanCash) return "city_hall_insufficient_clean_cash";
    if (Math.max(0, Number(input.districtInfluence || 0)) < config.officialCover.costInfluence) return "city_hall_insufficient_influence";
  }
  if (input.actionId === config.cityContract.actionId) {
    if (Number(metadata.cityContractBlockedUntilTick || 0) > input.state.root.tick) return "city_hall_contract_blocked";
    if (Math.max(0, Number(input.districtInfluence || 0)) < config.cityContract.costInfluence) return "city_hall_insufficient_influence";
  }
  if (input.actionId === config.emergencyDecree.actionId) {
    if (!resolveDecreeModeOrNull(input.payload.mode)) return "city_hall_invalid_decree_mode";
    if (Number(metadata.emergencyDecree?.expiresAtTick || 0) > input.state.root.tick) return "city_hall_emergency_decree_active";
    if (Math.max(0, Number(input.balances.cash || 0)) < config.emergencyDecree.costCleanCash) return "city_hall_insufficient_clean_cash";
    if (Math.max(0, Number(input.districtInfluence || 0)) < config.emergencyDecree.costInfluence) return "city_hall_insufficient_influence";
  }
  return null;
};
