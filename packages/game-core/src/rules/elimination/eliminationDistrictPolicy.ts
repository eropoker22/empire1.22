import type { PlayerId } from "@empire/shared-types";
import type { EliminationBalanceConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";

export const applyDefeatedDistrictPolicy = (
  state: CoreGameState,
  playerId: PlayerId,
  config: EliminationBalanceConfig
): CoreGameState => {
  const lockUntilTick = config.defeatedDistrictPolicy === "lock"
    ? state.root.tick + Math.max(0, config.defeatedDistrictLockTicks)
    : null;
  return neutralizeDefeatedPlayerDistricts(
    state,
    playerId,
    config.defeatedDistrictPolicy === "lock" ? "locked" : "neutral",
    lockUntilTick
  );
};

const neutralizeDefeatedPlayerDistricts = (
  state: CoreGameState,
  playerId: PlayerId,
  status: CoreGameState["districtsById"][string]["status"],
  lockdownUntilTick: number | null
): CoreGameState => {
  const districtsById = { ...state.districtsById };
  const buildingsById = { ...state.buildingsById };
  for (const district of Object.values(state.districtsById)) {
    if (district.ownerPlayerId !== playerId || district.status === "destroyed") continue;
    districtsById[district.id] = {
      ...district,
      ownerPlayerId: null,
      controllerAllianceId: null,
      status,
      lockdownUntilTick,
      previousStatusBeforeLockdown: status === "locked" ? district.status : district.previousStatusBeforeLockdown,
      version: district.version + 1
    };
    for (const buildingId of district.buildingIds) {
      const building = buildingsById[buildingId];
      if (building?.ownerPlayerId === playerId) {
        buildingsById[buildingId] = {
          ...building,
          status: building.status === "destroyed" ? "destroyed" : "disabled",
          metadata: {
            ...(building.metadata ?? {}),
            disabledByEliminationAtTick: state.root.tick,
            defeatedOwnerPlayerId: playerId
          },
          version: building.version + 1
        };
      }
    }
  }
  return { ...state, districtsById, buildingsById };
};
