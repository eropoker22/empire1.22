import type { SelectSpawnDistrictCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";

export interface SelectSpawnPolicy {
  isEnabledSpawnCandidate: (districtId: string) => boolean;
}

export const handleSelectSpawnDistrict = (
  state: CoreGameState,
  command: SelectSpawnDistrictCommand,
  context: GameCoreContext,
  policy: SelectSpawnPolicy = {
    isEnabledSpawnCandidate: (districtId) =>
      Boolean(context.mapRules?.isEnabledSpawnCandidate?.(districtId))
  }
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const player = state.playersById[command.playerId];
  const district = state.districtsById[command.payload.districtId];

  if (!player) {
    return failed(state, "player_not_found", `Hráč ${command.playerId} nebyl nalezen.`);
  }

  if (player.homeDistrictId) {
    return failed(state, "PLAYER_ALREADY_HAS_SPAWN", "Hráč už má startovní district.");
  }

  if (!district) {
    return failed(state, "TARGET_NOT_FOUND", `Startovní district ${command.payload.districtId} nebyl nalezen.`);
  }

  if (!policy.isEnabledSpawnCandidate(district.id)) {
    return failed(state, "SPAWN_NOT_ALLOWED", "Tenhle district není povolený jako start.");
  }

  if (district.zone === "downtown") {
    return failed(state, "SPAWN_NOT_ALLOWED", "Downtown district nejde vybrat jako start.");
  }

  if (district.status === "locked" || district.status === "destroyed" || district.lockdownUntilTick) {
    return failed(state, "SPAWN_LOCKED", "Startovní district je zamčený.");
  }

  if (district.ownerPlayerId) {
    return failed(state, "SPAWN_ALREADY_OCCUPIED", "Startovní district už někdo drží.");
  }

  if (district.status !== "neutral") {
    return failed(state, "SPAWN_NOT_NEUTRAL", "Startovní district není neutrální.");
  }

  const updatedBuildingsById = { ...state.buildingsById };
  for (const buildingId of district.buildingIds) {
    const building = updatedBuildingsById[buildingId];
    if (building) {
      updatedBuildingsById[buildingId] = {
        ...building,
        ownerPlayerId: player.id,
        version: building.version + 1
      };
    }
  }

  return {
    nextState: {
      ...state,
      playersById: {
        ...state.playersById,
        [player.id]: {
          ...player,
          homeDistrictId: district.id,
          metadata: {
            ...(player.metadata ?? {}),
            spawnSelectionStatus: "ready_to_play"
          },
          lastActionAt: command.issuedAt,
          version: player.version + 1
        }
      },
      districtsById: {
        ...state.districtsById,
        [district.id]: {
          ...district,
          ownerPlayerId: player.id,
          status: "claimed",
          version: district.version + 1
        }
      },
      buildingsById: updatedBuildingsById,
      root: {
        ...state.root,
        version: state.root.version + 1
      }
    },
    events: [],
    errors: []
  };
};

const failed = (
  state: CoreGameState,
  code: string,
  message: string
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => ({
  nextState: state,
  events: [],
  errors: [{ code, message }]
});
