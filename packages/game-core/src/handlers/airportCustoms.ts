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
  let rumorText: string | undefined;
  if (type === "customs_stamp") {
    metadataPatch.discountDisabledUntilTick = state.root.tick + minutesToTicks(config.customsInspection.discountDisabledMinutes, tickRateMs);
  } else if (type === "hangar_search") {
    nextState = addAirportHeatAndRumor(nextState, building, config.customsInspection.hangarHeatGain, undefined, lobbyClubConfig);
  } else if (type === "lost_papers") {
    metadataPatch.nextImportCostPenaltyPct = config.customsInspection.nextImportCostPenaltyPct;
  } else if (type === "cargo_rumor") {
    rumorText = formatAirportCargoRumor(state, building);
    nextState = addAirportHeatAndRumor(nextState, building, 0, rumorText, lobbyClubConfig);
  }
  return {
    state: nextState,
    metadataPatch,
    event: { type, tick: state.root.tick, label: labels[type] ?? type, riskPct, rumorText }
  };
};

const AIRPORT_CARGO_RUMORS = [
  "U runway se šeptá o falešných papírech a kontejneru, který zmizel dřív, než ho systém stihl pojmenovat.",
  "Někdo tvrdí, že manifest měl díry a náklad jimi prošel ven. Papír se tvářil nevinně, jak to papír dělá.",
  "Zdroj z hangáru říká, že jedna bedna přistála v papírech, ale ne ve skladu. Velmi letecký výkon.",
  "Šeptá se o zásilce, která voněla po celnici a skončila mimo světla. Asi alergie na kontrolu.",
  "Prý se u brány měnila razítka rychleji než palety. Úřední romantika ve vysoké rychlosti.",
  "Někdo u letiště zahlédl kontejner bez jména. Takové věci málokdy cestují samy a nikdy levně."
];

const formatAirportCargoRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string]
): string => {
  const owner = building.ownerPlayerId ? state.playersById[building.ownerPlayerId] : undefined;
  const name = owner?.name?.trim() || owner?.id || "někdo z letištní sítě";
  const text = pickVariant(AIRPORT_CARGO_RUMORS, `${state.serverInstance.worldSeed}:airport-cargo-rumor:${building.id}:${state.root.tick}`);
  return `${text} U rampy prý šeptali o ${name}, ale záznam je rozmazaný. Kamera se tváří, že má trauma.`;
};

export const addAirportHeatAndRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string],
  heatGain: number,
  rumorText?: string,
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
  if (!rumorText) return nextState;
  const sourceEventId = `airport-customs:${building.id}:${state.root.tick}:${Math.abs(hashText(rumorText))}`;
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
    message: rumorText,
    messageKey: "rumor.airport_customs",
    negative: heatGain > 0,
    payload: { buildingTypeId: building.buildingTypeId, heatGain, rumorType: "airport_customs" }
  }, { lobbyClubConfig });
};

const hashText = (value: string): number =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);

const pickVariant = (variants: string[], seed: string): string => {
  const index = Math.floor(deterministicUnitInterval(seed) * variants.length);
  return variants[index] ?? variants[0] ?? "";
};
