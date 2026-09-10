import { createGameplayEconomyRatesView, type CoreGameState } from "@empire/game-core";
import { getPublicBuildingCatalog, resolveModeConfig } from "@empire/game-config";
import type { GameModeId, HostedStartingPlayerStateView, SpawnDistrictOptionView } from "@empire/shared-types";
import { addPlayerToGameplaySliceState } from "../bootstrap/gameplay-slice-session-seed";

/** Read-only what-if projection of one start, with the canonical economy rules. */
export function createStartingDistrictPreviewer(raw: unknown, mode: GameModeId, starter: HostedStartingPlayerStateView) {
  const source = raw as CoreGameState;
  if (!source?.serverInstance || !source.buildingsById || !source.resourceStatesById) return () => undefined;
  const config = resolveModeConfig(mode);
  const id = "player:starting-preview";
  const base = addPlayerToGameplaySliceState(structuredClone(source), {
    serverInstanceId: source.serverInstance.id, playerId: id, mode, startingPlayerState: starter
  });
  const catalog = getPublicBuildingCatalog(mode);
  return (districtId: string): SpawnDistrictOptionView["startPreview"] => {
    const district = base.districtsById[districtId];
    if (!district) return undefined;
    const buildings = district.buildingIds.map((key) => base.buildingsById[key]).filter(Boolean);
    const state = { ...base, districtsById: { ...base.districtsById, [districtId]: { ...district, ownerPlayerId: id, status: "claimed" as const } },
      buildingsById: { ...base.buildingsById, ...Object.fromEntries(buildings.map((b) => [b.id, { ...b, ownerPlayerId: id, status: "active" as const }])) },
      playersById: { ...base.playersById, [id]: { ...base.playersById[id], homeDistrictId: districtId } } };
    const rates = createGameplayEconomyRatesView(state, id, districtId, { config }).selectedDistrict;
    if (!rates) return undefined;
    const population = rates.passivePopulationSources.filter((entry) => entry.amountPerHour > 0);
    return { cleanCashPerHour: rates.cleanCashPerHour, dirtyCashPerHour: rates.dirtyCashPerHour,
      populationSource: population.length ? rates.passivePopulationSourceSummary : "Bez pasivního zdroje lidí; další lidi musíš získat jinou cestou.",
      buildingNames: buildings.map((building) => catalog.find((entry) => entry.buildingTypeId === building.buildingTypeId)?.label ?? building.buildingTypeId),
      difficulty: rates.cleanCashPerHour <= 0 && !population.length ? "Náročný start: bez pasivního clean příjmu a lidí."
        : rates.cleanCashPerHour <= 0 ? "Náročnější start: clean příjem musíš získat jinou cestou." : "Průběžný příjem; zajisti také lidi a výrobu.",
      basis: "Náhled aktuální fáze pro výchozí frakci Mafián; volba frakce, herní den a noc mohou příjem změnit." };
  };
}
