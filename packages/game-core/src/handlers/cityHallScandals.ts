import type { CityHallBalanceConfig, LobbyClubBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import { deterministicUnitInterval } from "../utils/math";
import type { CityHallMetadata, CityHallScandalEvent } from "./cityHallTypes";
import {
  appendCityHallRumor,
  getCityHallMetadata,
  hasOwnedBuilding,
  minutesToTicks,
  withCityHallMetadata
} from "./cityHallMetadata";

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

export const applyCityHallCorruptionScandals = (
  state: CoreGameState,
  config: CityHallBalanceConfig,
  tickRateMs: number,
  lobbyClubConfig?: LobbyClubBalanceConfig
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
      const consequence = resolveScandalConsequence(nextState, building, config, riskPct, tickRateMs, lobbyClubConfig);
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
  tickRateMs: number,
  lobbyClubConfig?: LobbyClubBalanceConfig
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
    rumorText = formatCityHallLeakRumor(state, building);
    nextState = appendCityHallRumor(nextState, building, rumorText, "medium", lobbyClubConfig);
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

const CITY_HALL_LEAK_RUMORS = [
  "Z Magistrátu prý vytekly špinavé spisy. Razítka voní po úplatcích a reputace po kyselině.",
  "Někdo tvrdí, že úřední složka změnila majitele dřív než razítko zaschlo. Úřad tomu říká efektivita.",
  "Šeptá se o zakázce, která se narodila v kanceláři a vyrostla v cizí kapse. Krásná kariéra.",
  "Zdroj říká, že městský papír má víc špíny než podpisů. A podpisů tam bylo dost.",
  "Prý unikl seznam tichých laskavostí. Každá má cenu a každá kouše jako malý úředník.",
  "Magistrát údajně pustil stopu, která spojuje vliv, cash a svědomí. Svědomí zatím nereaguje."
];

const formatCityHallLeakRumor = (
  state: CoreGameState,
  building: CoreGameState["buildingsById"][string]
): string => {
  const owner = building.ownerPlayerId ? state.playersById[building.ownerPlayerId] : undefined;
  const name = owner?.name?.trim() || owner?.id || "někdo s vlivem";
  const text = pickVariant(CITY_HALL_LEAK_RUMORS, `${state.serverInstance.worldSeed}:city-hall-leak:${building.id}:${state.root.tick}`);
  return `${text} V chodbách prý padlo jméno ${name}, ale nikdo ho nepotvrdil. Všichni jen náhle obdivovali podlahu.`;
};

const pickVariant = (variants: string[], seed: string): string => {
  const index = Math.floor(deterministicUnitInterval(seed) * variants.length);
  return variants[index] ?? variants[0] ?? "";
};
