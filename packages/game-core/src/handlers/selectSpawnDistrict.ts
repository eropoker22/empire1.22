import type { SelectSpawnDistrictCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { ensureStarterDistrictProductionBuildings } from "../state/starterDistrictProductionBuildings";

export interface SelectSpawnPolicy {
  isEnabledSpawnCandidate: (districtId: string) => boolean;
}

const asMetadataRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export const resolvePlayerStartingDistrictInfluence = (
  player: CoreGameState["playersById"][string] | undefined
): number => {
  const influence = player?.metadata?.startingInfluence;
  return Number.isSafeInteger(influence) && Number(influence) >= 0
    ? Number(influence)
    : 0;
};

export const createFreshSpawnBuildingMetadata = (
  building: CoreGameState["buildingsById"][string],
  tick: number
): CoreGameState["buildingsById"][string]["metadata"] => {
  const metadata = { ...(building.metadata ?? {}) };
  if (building.buildingTypeId === "school") {
    return {
      ...metadata,
      school: {
        ...asMetadataRecord(metadata.school),
        storedStudents: 0,
        lastUpdatedTick: tick,
        wasFull: false
      }
    };
  }
  if (building.buildingTypeId === "apartment_block") {
    return {
      ...metadata,
      apartmentBlock: {
        ...asMetadataRecord(metadata.apartmentBlock),
        storedPopulation: 0,
        lastUpdatedTick: tick,
        wasFull: false
      }
    };
  }
  if (building.buildingTypeId === "convenience_store") {
    return {
      ...metadata,
      convenienceStore: {
        ...asMetadataRecord(metadata.convenienceStore),
        storedPopulation: 0,
        populationLastUpdatedTick: tick,
        populationWasFull: false
      }
    };
  }
  return building.metadata;
};

export const isSpawnDistrictOccupationActive = (
  state: CoreGameState,
  districtId: string
): boolean => {
  const district = state.districtsById[districtId];
  if (Number(district?.operationLocks?.occupy ?? 0) > state.root.tick) return true;
  return Object.values(state.pendingOccupyOperationsById ?? {}).some((operation) =>
    operation.targetDistrictId === districtId && operation.resolveAtTick > state.root.tick
  );
};

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

  if (isSpawnDistrictOccupationActive(state, district.id)) {
    return failed(state, "SPAWN_OCCUPATION_IN_PROGRESS", "Tento district právě někdo obsazuje.");
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
        metadata: createFreshSpawnBuildingMetadata(building, state.root.tick),
        ownerPlayerId: player.id,
        version: building.version + 1
      };
    }
  }

  const claimedDistrict = {
    ...district,
    ownerPlayerId: player.id,
    status: "claimed" as const,
    influence: resolvePlayerStartingDistrictInfluence(player),
    version: district.version + 1
  };
  const starterBuildings = ensureStarterDistrictProductionBuildings({
    district: claimedDistrict,
    buildingsById: updatedBuildingsById,
    ownerPlayerId: player.id
  });

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
        [district.id]: starterBuildings.district
      },
      buildingsById: starterBuildings.buildingsById,
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
