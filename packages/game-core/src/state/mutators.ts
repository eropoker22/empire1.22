import type { CoreGameState } from "../entities";
import type { BuildStructureCommand, Building, ResourceState } from "@empire/shared-types";
import { composeEntityId } from "../utils";
import type { GameCoreContext } from "../engine/context";

/**
 * Responsibility: Central place for future small immutable state update helpers.
 * Belongs here: focused write-model mutation utilities shared by handlers/rules.
 * Does not belong here: transport logic or scheduler concerns.
 */
export const replaceState = (state: CoreGameState): CoreGameState => state;

/**
 * Responsibility: Applies the minimal authoritative write-model mutation for placing one building.
 * Belongs here: immutable updates touching normalized entity maps and root references.
 * Does not belong here: validation, transport mapping, or UI concerns.
 */
export const placeBuilding = (
  state: CoreGameState,
  command: BuildStructureCommand,
  context: GameCoreContext
): { nextState: CoreGameState; building: Building } => {
  const buildingId = composeEntityId("building", command.id);
  const district = state.districtsById[command.payload.districtId];
  const productionProfile = context.config.balance.productionBuildings?.[command.payload.buildingTypeId];

  const building: Building = {
    id: buildingId,
    serverInstanceId: state.serverInstance.id,
    districtId: district.id,
    ownerPlayerId: command.playerId,
    buildingTypeId: command.payload.buildingTypeId,
    level: 1,
    status: "active",
    processing: null,
    actionCooldowns: {},
    startedAt: command.issuedAt,
    completedAt: command.issuedAt,
    version: 1
  };

  const resourceState = productionProfile
    ? createBuildingProductionResourceState(building, productionProfile.resourceKey, state.root.tick)
    : null;

  return {
    building,
    nextState: {
      ...state,
      districtsById: {
        ...state.districtsById,
        [district.id]: {
          ...district,
          buildingIds: [...district.buildingIds, building.id],
          version: district.version + 1
        }
      },
      buildingsById: {
        ...state.buildingsById,
        [building.id]: building
      },
      resourceStatesById: resourceState
        ? {
            ...state.resourceStatesById,
            [resourceState.id]: resourceState
          }
        : state.resourceStatesById
    }
  };
};

const createBuildingProductionResourceState = (
  building: Building,
  resourceKey: string,
  tick: number
): ResourceState => ({
  id: composeEntityId("resource", building.id),
  ownerType: "building",
  ownerId: building.id,
  balances: {
    [resourceKey]: 0
  },
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});
