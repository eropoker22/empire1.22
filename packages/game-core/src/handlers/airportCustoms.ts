import type { CityFeedEvent } from "@empire/shared-types";
import type { AirportBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";
import type { AirportCustomsEvent, AirportMetadata } from "./airportTypes";
import { minutesToTicks } from "./airportMetadata";
export const applyCustomsInspectionConsequence = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  config: AirportBalanceConfig,
  riskPct: number,
  tickRateMs: number
): { state: CoreGameState; metadataPatch: Partial<AirportMetadata>; event: AirportCustomsEvent } => {
  const roll = deterministicUnitInterval(`${state.serverInstance.worldSeed}:airport-customs-type:${building.id}:${state.root.tick}`);
  const type = ["held_container", "customs_stamp", "hangar_search", "lost_papers", "cargo_rumor"][Math.min(4, Math.floor(roll * 5))];
  const labels: Record<string, string> = {
    held_container: "Zadržený kontejner",
    customs_stamp: "Celní razítko",
    hangar_search: "Prohlídka hangáru",
    lost_papers: "Ztracené papíry",
    cargo_rumor: "Drb o nákladu"
  };
  let nextState = state;
  const metadataPatch: Partial<AirportMetadata> = {};
  let rumorText: string | undefined;
  if (type === "customs_stamp") {
    metadataPatch.discountDisabledUntilTick = state.root.tick + minutesToTicks(config.customsInspection.discountDisabledMinutes, tickRateMs);
  } else if (type === "hangar_search") {
    nextState = addAirportHeatAndRumor(nextState, building, config.customsInspection.hangarHeatGain);
  } else if (type === "lost_papers") {
    metadataPatch.nextImportCostPenaltyPct = config.customsInspection.nextImportCostPenaltyPct;
  } else if (type === "cargo_rumor") {
    rumorText = "V okolí Letiště se mluví o falešných papírech a nákladu, který zmizel dřív, než dorazil na manifest.";
    nextState = addAirportHeatAndRumor(nextState, building, 0, rumorText);
  }
  return {
    state: nextState,
    metadataPatch,
    event: { type, tick: state.root.tick, label: labels[type] ?? type, riskPct, rumorText }
  };
};

export const addAirportHeatAndRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  heatGain: number,
  rumorText?: string
): CoreGameState => {
  const district = state.districtsById[building.districtId];
  let nextState = district && heatGain > 0
    ? {
        ...state,
        districtsById: {
          ...state.districtsById,
          [district.id]: {
            ...district,
            heat: Math.max(0, Number(district.heat || 0) + heatGain),
            version: district.version + 1
          }
        }
      }
    : state;
  if (!rumorText) return nextState;
  const sourceEventId = `airport-customs:${building.id}:${state.root.tick}:${Math.abs(hashText(rumorText))}`;
  const event: CityFeedEvent = {
    id: `city-feed:${sourceEventId}`,
    sourceEventId,
    sourceType: "market",
    category: "rumor",
    severity: "medium",
    truthiness: "unconfirmed",
    visibility: "all",
    playerId: building.ownerPlayerId,
    districtId: building.districtId,
    createdAtTick: state.root.tick,
    message: rumorText,
    messageKey: "rumor.airport_customs",
    payload: { buildingTypeId: building.buildingTypeId, heatGain }
  };
  if (nextState.cityFeedEventsById?.[event.id]) return nextState;
  return {
    ...nextState,
    cityFeedEventsById: {
      ...(nextState.cityFeedEventsById ?? {}),
      [event.id]: event
    }
  };
};

const hashText = (value: string): number =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);
