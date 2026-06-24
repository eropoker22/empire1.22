import type { CityFeedEvent, RunBuildingActionCommand } from "@empire/shared-types";
import type { CityHallBalanceConfig, LobbyClubBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { applyRumorEventToState } from "../rules/events/rumorPipeline";
import type { CityHallDecreeMode, CityHallMetadata } from "./cityHallTypes";
export const getCityHallMetadata = (
  building: CoreGameState["buildingsById"][string],
  tick = 0
): CityHallMetadata => cleanupCityHallMetadata(readCityHallMetadata(building), tick);

export const appendRiskEvent = (
  metadata: CityHallMetadata,
  actionId: string,
  riskPct: number,
  expiresAtTick: number,
  tick: number
): CityHallMetadata => ({
  ...metadata,
  riskEvents: [...metadata.riskEvents, { actionId, riskPct, expiresAtTick, tick }].slice(-12)
});

export const getOwnedCityHall = (
  state: CoreGameState,
  playerId: string | null | undefined,
  config: CityHallBalanceConfig
): CoreGameState["buildingsById"][string] | undefined =>
  playerId
    ? Object.values(state.buildingsById).find((building) =>
        building.buildingTypeId === config.buildingTypeId && building.ownerPlayerId === playerId && building.status === "active"
      )
    : undefined;

export const countOwnedBuildings = (state: CoreGameState, playerId: string | null | undefined, buildingTypeIds: string[]): number =>
  playerId
    ? Object.values(state.buildingsById).filter((building) =>
        building.ownerPlayerId === playerId && building.status === "active" && buildingTypeIds.includes(building.buildingTypeId)
      ).length
    : 0;

export const hasOwnedBuilding = (state: CoreGameState, playerId: string, buildingTypeId: string): boolean =>
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
    scandalEvents: Array.isArray(raw.scandalEvents) ? raw.scandalEvents.filter(isRecord).map((entry) => ({ type: String(entry.type || ""), tick: Math.floor(Number(entry.tick || 0)), label: String(entry.label || entry.type || ""), riskPct: Number(entry.riskPct || 0) })).filter((entry) => entry.type) : []
  };
};

const cleanupCityHallMetadata = (metadata: CityHallMetadata, tick: number): CityHallMetadata => ({
  ...metadata,
  officialCoverByDistrictId: Object.fromEntries(Object.entries(metadata.officialCoverByDistrictId).filter(([, entry]) => entry.expiresAtTick > tick)),
  emergencyDecree: Number(metadata.emergencyDecree?.expiresAtTick || 0) > tick ? metadata.emergencyDecree : undefined,
  riskEvents: metadata.riskEvents.filter((event) => event.expiresAtTick > tick),
  scandalEvents: metadata.scandalEvents.slice(-8)
});

export const withCityHallMetadata = (
  building: CoreGameState["buildingsById"][string],
  cityHall: CityHallMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  cityHall
});

export const appendCityHallRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  severity: CityFeedEvent["severity"],
  lobbyClubConfig?: LobbyClubBalanceConfig
): CoreGameState => {
  const sourceEventId = `city-hall-scandal:${building.id}:${state.root.tick}:leaked-documents`;
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
    messageKey: "rumor.city_hall_scandal",
    negative: true,
    payload: { buildingTypeId: building.buildingTypeId, rumorType: "leaked_documents" }
  }, { lobbyClubConfig });
};

export const resolveTargetDistrictId = (payload: RunBuildingActionCommand["payload"], fallbackDistrictId: string): string =>
  String(payload.targetDistrictId ?? payload.districtId ?? fallbackDistrictId);

export const resolveDecreeMode = (value: unknown): CityHallDecreeMode =>
  resolveDecreeModeOrNull(value) ?? "night_patrols";

export const resolveDecreeModeOrNull = (value: unknown): CityHallDecreeMode | null => {
  const normalized = String(value ?? "").trim();
  return normalized === "night_patrols" || normalized === "suspended_checks" || normalized === "construction_closure"
    ? normalized
    : null;
};

const asOptionalTick = (value: unknown): number | undefined => {
  const tick = Math.floor(Number(value || 0));
  return tick > 0 ? tick : undefined;
};

export const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil(Math.max(0, minutes) * 60000 / Math.max(1, tickRateMs)));

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
