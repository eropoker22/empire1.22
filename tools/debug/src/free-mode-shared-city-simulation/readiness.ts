import type { CoreGameState, ResolvedGameModeConfig } from "@empire/game-core";
import type { PlayerId } from "@empire/shared-types";
import type { RoundReadinessMetrics } from "./timeline";

export const createRoundReadinessMetrics = (
  state: CoreGameState,
  config: ResolvedGameModeConfig,
  tickRateMs: number
): RoundReadinessMetrics => {
  let attackReadyPlayers = 0;
  let craftReadyPlayers = 0;
  let productionReadyPlayers = 0;

  for (const playerId of state.root.playerIds) {
    const player = state.playersById[playerId];
    if (player?.status !== "active") continue;
    const ownedDistrictIds = state.root.districtIds.filter((districtId) =>
      state.districtsById[districtId]?.ownerPlayerId === playerId
    );
    const ownedBuildingIds = ownedDistrictIds.flatMap((districtId) =>
      state.districtsById[districtId]?.buildingIds ?? []
    );

    if (hasAttackTarget(state, playerId, ownedDistrictIds)) attackReadyPlayers += 1;
    if (hasCraftReadyBuilding(state, config, ownedBuildingIds)) craftReadyPlayers += 1;
    if (hasProductionReadyBuilding(state, config, ownedBuildingIds)) productionReadyPlayers += 1;
  }

  return {
    tickRateMs,
    attackReadyPlayers,
    craftReadyPlayers,
    productionReadyPlayers
  };
};

const hasAttackTarget = (
  state: CoreGameState,
  playerId: PlayerId,
  ownedDistrictIds: string[]
): boolean =>
  ownedDistrictIds.some((districtId) =>
    (state.districtsById[districtId]?.adjacentDistrictIds ?? []).some((targetDistrictId) => {
      const target = state.districtsById[targetDistrictId];
      return Boolean(target && target.status !== "destroyed" && target.ownerPlayerId !== playerId);
    })
  );

const hasCraftReadyBuilding = (
  state: CoreGameState,
  config: ResolvedGameModeConfig,
  buildingIds: string[]
): boolean =>
  buildingIds.some((buildingId) => {
    const building = state.buildingsById[buildingId];
    return Boolean(
      building &&
      building.status === "active" &&
      !building.processing &&
      config.balance.craftBuildings?.[building.buildingTypeId]
    );
  });

const hasProductionReadyBuilding = (
  state: CoreGameState,
  config: ResolvedGameModeConfig,
  buildingIds: string[]
): boolean =>
  buildingIds.some((buildingId) => {
    const building = state.buildingsById[buildingId];
    return Boolean(
      building &&
      building.status === "active" &&
      config.balance.productionBuildings?.[building.buildingTypeId]
    );
  });
