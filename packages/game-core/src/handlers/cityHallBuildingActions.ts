import type { RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, CityHallBalanceConfig, FixedBuildingBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { CityHallActionResolution } from "./cityHallTypes";
import {
  appendRiskEvent,
  countOwnedBuildings,
  getCityHallMetadata,
  getOwnedCityHall,
  minutesToTicks,
  resolveDecreeMode,
  resolveDecreeModeOrNull,
  resolveTargetDistrictId,
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

export const resolveCityHallAction = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  action: BuildingActionBalanceConfig;
  balances: Record<string, number>;
  district: CoreGameState["districtsById"][string];
  config: CityHallBalanceConfig;
  tickRateMs: number;
  commandId: string;
  payload: RunBuildingActionCommand["payload"];
}): CityHallActionResolution | null => {
  if (input.building.buildingTypeId !== input.config.buildingTypeId) return null;
  const metadata = getCityHallMetadata(input.building, input.state.root.tick);
  const actionId = input.action.actionId;

  if (actionId === input.config.officialCover.actionId) {
    const targetDistrictId = resolveTargetDistrictId(input.payload, input.district.id);
    const targetDistrict = input.state.districtsById[targetDistrictId];
    const expiresAtTick = input.state.root.tick + minutesToTicks(input.config.officialCover.durationMinutes, input.tickRateMs);
    const nextMetadata = appendRiskEvent({
      ...metadata,
      officialCoverByDistrictId: {
        ...metadata.officialCoverByDistrictId,
        [targetDistrictId]: {
          districtId: targetDistrictId,
          expiresAtTick,
          heatGainReductionPct: input.config.officialCover.heatGainReductionPct,
          policeControlChanceReductionPct: input.config.officialCover.policeControlChanceReductionPct,
          rumorChanceReductionPct: input.config.officialCover.rumorChanceReductionPct
        }
      }
    }, actionId, input.config.officialCover.riskPct, expiresAtTick, input.state.root.tick);
    return {
      balances: { ...input.balances, cash: Math.max(0, Number(input.balances.cash || 0) - input.config.officialCover.costCleanCash) },
      buildingMetadata: withCityHallMetadata(input.building, nextMetadata),
      heatGain: input.config.officialCover.heatGain,
      influenceChange: -input.config.officialCover.costInfluence,
      inputCost: { cash: input.config.officialCover.costCleanCash },
      outputGain: {},
      reportText: `Úřední krytí je aktivní v districtu ${targetDistrict?.name ?? targetDistrictId} do ticku ${expiresAtTick}.`,
      cityHallResult: {
        type: "official_cover",
        targetDistrictId,
        activeUntilTick: expiresAtTick,
        heatGainReductionPct: input.config.officialCover.heatGainReductionPct,
        policeControlChanceReductionPct: input.config.officialCover.policeControlChanceReductionPct,
        rumorChanceReductionPct: input.config.officialCover.rumorChanceReductionPct,
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
    const reward = Math.floor(baseReward * (hasSynergy ? 1 + input.config.cityContract.restaurantConvenienceSynergyPct / 100 : 1));
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
    const targetDistrictId = resolveTargetDistrictId(input.payload, input.district.id);
    const targetDistrict = input.state.districtsById[targetDistrictId];
    if (!targetDistrict || targetDistrict.ownerPlayerId !== input.building.ownerPlayerId || targetDistrict.status === "destroyed") return "city_hall_invalid_target_district";
    if (metadata.officialCoverByDistrictId[targetDistrictId]?.expiresAtTick > input.state.root.tick) return "city_hall_official_cover_active";
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
