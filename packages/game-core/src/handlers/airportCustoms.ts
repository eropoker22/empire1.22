import type { AirportBalanceConfig, LobbyClubBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { applyRumorEventToState } from "../rules/events/rumorPipeline";
import { deterministicUnitInterval } from "../utils/math";
import type { AirportCustomsEvent, AirportMetadata } from "./airportTypes";
import { minutesToTicks } from "./airportMetadata";
export const applyCustomsInspectionConsequence = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  config: AirportBalanceConfig,
  riskPct: number,
  tickRateMs: number,
  lobbyClubConfig?: LobbyClubBalanceConfig
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
  if (type === "customs_stamp") {
    metadataPatch.discountDisabledUntilTick = state.root.tick + minutesToTicks(config.customsInspection.discountDisabledMinutes, tickRateMs);
  } else if (type === "hangar_search") {
    nextState = addAirportHeatAndRumor(nextState, building, config.customsInspection.hangarHeatGain, false, lobbyClubConfig);
  } else if (type === "lost_papers") {
    metadataPatch.nextImportCostPenaltyPct = config.customsInspection.nextImportCostPenaltyPct;
  } else if (type === "cargo_rumor") {
    nextState = addAirportHeatAndRumor(nextState, building, 0, true, lobbyClubConfig);
  }
  return {
    state: nextState,
    metadataPatch,
    event: { type, tick: state.root.tick, label: labels[type] ?? type, riskPct }
  };
};

export const addAirportHeatAndRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  heatGain: number,
  publishRumor = false,
  lobbyClubConfig?: LobbyClubBalanceConfig
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
  if (!publishRumor) return nextState;
  const sourceEventId = `airport-customs:${building.id}:${state.root.tick}`;
  return applyRumorEventToState(nextState, {
    sourceEventId,
    sourceType: "market",
    category: "rumor",
    severity: "medium",
    truthiness: "unconfirmed",
    intelType: "rumor",
    visibility: "all",
    playerId: building.ownerPlayerId,
    districtId: building.districtId,
    createdAtTick: state.root.tick,
    messageKey: "rumor.airport_customs",
    negative: heatGain > 0,
    payload: { buildingTypeId: building.buildingTypeId, heatGain, rumorType: "airport_customs" }
  }, { lobbyClubConfig });
};
