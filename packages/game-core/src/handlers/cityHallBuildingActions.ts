import type { CityFeedEvent, RunBuildingActionCommand } from "@empire/shared-types";
import type { BuildingActionBalanceConfig, CityHallBalanceConfig, FixedBuildingBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";

export type CityHallDecreeMode = "night_patrols" | "suspended_checks" | "construction_closure";

interface CityHallRiskEvent {
  actionId: string;
  riskPct: number;
  expiresAtTick: number;
  tick: number;
}

interface CityHallScandalEvent {
  type: string;
  tick: number;
  label: string;
  riskPct: number;
  rumorText?: string;
}

export interface CityHallMetadata {
  officialCoverByDistrictId: Record<string, { districtId: string; expiresAtTick: number; heatGainReductionPct: number; policeControlChanceReductionPct: number; rumorChanceReductionPct: number }>;
  emergencyDecree?: { modeId: CityHallDecreeMode; zone?: string; expiresAtTick: number };
  influencePenaltyUntilTick?: number;
  cityContractBlockedUntilTick?: number;
  lastScandalCheckTick?: number;
  riskEvents: CityHallRiskEvent[];
  scandalEvents: CityHallScandalEvent[];
}

export interface CityHallActionResolution {
  balances: Record<string, number>;
  buildingMetadata: Record<string, unknown>;
  heatGain: number;
  influenceChange: number;
  outputGain: Record<string, number>;
  inputCost: Record<string, number>;
  effectModifiers?: BuildingActionBalanceConfig["effectModifiers"];
  reportText: string;
  cityHallResult: Record<string, unknown>;
}

export const getCityHallMetadata = (
  building: CoreGameState["buildingsById"][string],
  tick = 0
): CityHallMetadata => cleanupCityHallMetadata(readCityHallMetadata(building), tick);

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

export const resolveCityHallScandalRiskPct = (input: {
  state: CoreGameState;
  building: CoreGameState["buildingsById"][string];
  config: CityHallBalanceConfig;
  tick: number;
}): number => {
  const metadata = getCityHallMetadata(input.building, input.tick);
  const player = input.building.ownerPlayerId ? input.state.playersById[input.building.ownerPlayerId] : undefined;
  const policeState = player ? input.state.policeStatesById[player.policeStateId] : undefined;
  const eventRisk = metadata.riskEvents.reduce((total, event) => total + Math.max(0, Number(event.riskPct || 0)), 0);
  const heatRisk = Number(policeState?.heat || 0) > input.config.corruptionScandal.heatThreshold
    ? input.config.corruptionScandal.heatRiskPct
    : 0;
  const casinoRisk = input.building.ownerPlayerId && hasOwnedBuilding(input.state, input.building.ownerPlayerId, "casino")
    ? input.config.corruptionScandal.casinoOrStockExchangeRiskPct
    : 0;
  const stockRisk = input.building.ownerPlayerId && hasOwnedBuilding(input.state, input.building.ownerPlayerId, "stock_exchange")
    ? input.config.corruptionScandal.casinoOrStockExchangeRiskPct + input.config.corruptionScandal.stockExchangeSynergyRiskPct
    : 0;
  const airportRisk = input.building.ownerPlayerId && hasOwnedBuilding(input.state, input.building.ownerPlayerId, "airport")
    ? input.config.corruptionScandal.airportSynergyRiskPct
    : 0;
  return Math.min(100, input.config.corruptionScandal.passiveRiskPct + eventRisk + heatRisk + casinoRisk + stockRisk + airportRisk);
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

export const applyCityHallCorruptionScandals = (
  state: CoreGameState,
  config: CityHallBalanceConfig,
  tickRateMs: number
): CoreGameState => {
  let nextState = state;
  const intervalTicks = minutesToTicks(config.corruptionScandal.intervalMinutes, tickRateMs);
  for (const building of Object.values(nextState.buildingsById)) {
    if (building.buildingTypeId !== config.buildingTypeId || !building.ownerPlayerId || building.status !== "active") continue;
    const metadata = getCityHallMetadata(building, nextState.root.tick);
    if (Number(metadata.lastScandalCheckTick ?? 0) + intervalTicks > nextState.root.tick) continue;
    const riskPct = resolveCityHallScandalRiskPct({ state: nextState, building, config, tick: nextState.root.tick });
    let nextMetadata: CityHallMetadata = { ...metadata, lastScandalCheckTick: nextState.root.tick };
    const roll = deterministicUnitInterval(`${nextState.serverInstance.worldSeed}:city-hall-scandal:${building.id}:${nextState.root.tick}`);
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
          metadata: withCityHallMetadata(currentBuilding, nextMetadata),
          version: currentBuilding.version + 1
        }
      }
    };
  }
  return nextState;
};

const resolveScandalConsequence = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  config: CityHallBalanceConfig,
  riskPct: number,
  tickRateMs: number
): { state: CoreGameState; metadataPatch: Partial<CityHallMetadata>; event: CityHallScandalEvent } => {
  const type = ["leaked_documents", "anti_corruption_pressure", "frozen_contract", "public_resistance", "police_oversight"][Math.min(4, Math.floor(deterministicUnitInterval(`${state.serverInstance.worldSeed}:city-hall-scandal-type:${building.id}:${state.root.tick}`) * 5))];
  const labelByType: Record<string, string> = {
    leaked_documents: "Únik dokumentů",
    anti_corruption_pressure: "Protikorupční tlak",
    frozen_contract: "Zmrazená zakázka",
    public_resistance: "Veřejný odpor",
    police_oversight: "Policejní dohled"
  };
  let nextState = state;
  const metadataPatch: Partial<CityHallMetadata> = {};
  let rumorText: string | undefined;
  if (type === "leaked_documents") {
    rumorText = "Městem se šíří uniklé dokumenty z Magistrátu. Někdo prý měnil razítka za tichou loajalitu.";
    nextState = appendCityHallRumor(nextState, building, rumorText, "medium");
  } else if (type === "anti_corruption_pressure") {
    metadataPatch.influencePenaltyUntilTick = state.root.tick + minutesToTicks(config.corruptionScandal.influencePenaltyMinutes, tickRateMs);
  } else if (type === "frozen_contract") {
    metadataPatch.cityContractBlockedUntilTick = state.root.tick + minutesToTicks(config.corruptionScandal.cityContractBlockedMinutes, tickRateMs);
  } else if (type === "public_resistance") {
    const district = state.districtsById[building.districtId];
    if (district) {
      nextState = {
        ...nextState,
        districtsById: {
          ...nextState.districtsById,
          [district.id]: {
            ...district,
            influence: Math.max(0, Number(district.influence || 0) - config.corruptionScandal.publicResistanceInfluenceLoss),
            version: district.version + 1
          }
        }
      };
    }
  } else if (type === "police_oversight") {
    const district = state.districtsById[building.districtId];
    if (district) {
      nextState = {
        ...nextState,
        districtsById: {
          ...nextState.districtsById,
          [district.id]: {
            ...district,
            heat: Math.max(0, Number(district.heat || 0) + config.corruptionScandal.policeOversightHeatGain),
            version: district.version + 1
          }
        }
      };
    }
  }
  return {
    state: nextState,
    metadataPatch,
    event: { type, tick: state.root.tick, label: labelByType[type] ?? type, riskPct, rumorText }
  };
};

const appendRiskEvent = (
  metadata: CityHallMetadata,
  actionId: string,
  riskPct: number,
  expiresAtTick: number,
  tick: number
): CityHallMetadata => ({
  ...metadata,
  riskEvents: [...metadata.riskEvents, { actionId, riskPct, expiresAtTick, tick }].slice(-12)
});

const getOwnedCityHall = (
  state: CoreGameState,
  playerId: string | null | undefined,
  config: CityHallBalanceConfig
): CoreGameState["buildingsById"][string] | undefined =>
  playerId
    ? Object.values(state.buildingsById).find((building) =>
        building.buildingTypeId === config.buildingTypeId && building.ownerPlayerId === playerId && building.status === "active"
      )
    : undefined;

const countOwnedBuildings = (state: CoreGameState, playerId: string | null | undefined, buildingTypeIds: string[]): number =>
  playerId
    ? Object.values(state.buildingsById).filter((building) =>
        building.ownerPlayerId === playerId && building.status === "active" && buildingTypeIds.includes(building.buildingTypeId)
      ).length
    : 0;

const hasOwnedBuilding = (state: CoreGameState, playerId: string, buildingTypeId: string): boolean =>
  Object.values(state.buildingsById).some((building) =>
    building.ownerPlayerId === playerId && building.status === "active" && building.buildingTypeId === buildingTypeId
  );

const readCityHallMetadata = (building: CoreGameState["buildingsById"][string]): CityHallMetadata => {
  const raw = isRecord(building.metadata?.cityHall) ? building.metadata.cityHall : {};
  return {
    officialCoverByDistrictId: isRecord(raw.officialCoverByDistrictId)
      ? Object.fromEntries(Object.entries(raw.officialCoverByDistrictId).filter(([, value]) => isRecord(value)).map(([districtId, value]: [string, any]) => [districtId, {
          districtId: String(value.districtId || districtId),
          expiresAtTick: Math.floor(Number(value.expiresAtTick || 0)),
          heatGainReductionPct: Number(value.heatGainReductionPct || 0),
          policeControlChanceReductionPct: Number(value.policeControlChanceReductionPct || 0),
          rumorChanceReductionPct: Number(value.rumorChanceReductionPct || 0)
        }]))
      : {},
    emergencyDecree: isRecord(raw.emergencyDecree) && resolveDecreeModeOrNull(raw.emergencyDecree.modeId)
      ? { modeId: resolveDecreeMode(raw.emergencyDecree.modeId), zone: raw.emergencyDecree.zone ? String(raw.emergencyDecree.zone) : undefined, expiresAtTick: Math.floor(Number(raw.emergencyDecree.expiresAtTick || 0)) }
      : undefined,
    influencePenaltyUntilTick: asOptionalTick(raw.influencePenaltyUntilTick),
    cityContractBlockedUntilTick: asOptionalTick(raw.cityContractBlockedUntilTick),
    lastScandalCheckTick: asOptionalTick(raw.lastScandalCheckTick),
    riskEvents: Array.isArray(raw.riskEvents) ? raw.riskEvents.filter(isRecord).map((entry) => ({ actionId: String(entry.actionId || ""), riskPct: Number(entry.riskPct || 0), expiresAtTick: Math.floor(Number(entry.expiresAtTick || 0)), tick: Math.floor(Number(entry.tick || 0)) })).filter((entry) => entry.actionId) : [],
    scandalEvents: Array.isArray(raw.scandalEvents) ? raw.scandalEvents.filter(isRecord).map((entry) => ({ type: String(entry.type || ""), tick: Math.floor(Number(entry.tick || 0)), label: String(entry.label || entry.type || ""), riskPct: Number(entry.riskPct || 0), rumorText: entry.rumorText ? String(entry.rumorText) : undefined })).filter((entry) => entry.type) : []
  };
};

const cleanupCityHallMetadata = (metadata: CityHallMetadata, tick: number): CityHallMetadata => ({
  ...metadata,
  officialCoverByDistrictId: Object.fromEntries(Object.entries(metadata.officialCoverByDistrictId).filter(([, entry]) => entry.expiresAtTick > tick)),
  emergencyDecree: Number(metadata.emergencyDecree?.expiresAtTick || 0) > tick ? metadata.emergencyDecree : undefined,
  riskEvents: metadata.riskEvents.filter((event) => event.expiresAtTick > tick),
  scandalEvents: metadata.scandalEvents.slice(-8)
});

const withCityHallMetadata = (
  building: CoreGameState["buildingsById"][string],
  cityHall: CityHallMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  cityHall
});

const appendCityHallRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  message: string,
  severity: CityFeedEvent["severity"]
): CoreGameState => {
  const sourceEventId = `city-hall-scandal:${building.id}:${state.root.tick}:${Math.abs(hashText(message))}`;
  const event: CityFeedEvent = {
    id: `city-feed:${sourceEventId}`,
    sourceEventId,
    sourceType: "building_action",
    category: "rumor",
    severity,
    truthiness: "unconfirmed",
    visibility: "all",
    playerId: building.ownerPlayerId,
    districtId: building.districtId,
    createdAtTick: state.root.tick,
    message,
    messageKey: "rumor.city_hall_scandal",
    payload: { buildingTypeId: building.buildingTypeId }
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

const resolveTargetDistrictId = (payload: RunBuildingActionCommand["payload"], fallbackDistrictId: string): string =>
  String(payload.targetDistrictId ?? payload.districtId ?? fallbackDistrictId);

const resolveDecreeMode = (value: unknown): CityHallDecreeMode =>
  resolveDecreeModeOrNull(value) ?? "night_patrols";

const resolveDecreeModeOrNull = (value: unknown): CityHallDecreeMode | null => {
  const normalized = String(value ?? "").trim();
  return normalized === "night_patrols" || normalized === "suspended_checks" || normalized === "construction_closure"
    ? normalized
    : null;
};

const asOptionalTick = (value: unknown): number | undefined => {
  const tick = Math.floor(Number(value || 0));
  return tick > 0 ? tick : undefined;
};

const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil(Math.max(0, minutes) * 60000 / Math.max(1, tickRateMs)));

const hashText = (value: string): number =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
