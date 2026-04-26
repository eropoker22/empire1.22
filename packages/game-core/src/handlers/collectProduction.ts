import type { CollectProductionCommand, ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { createEvent, CORE_EVENT_TYPES } from "../events";
import type { GameCoreContext } from "../engine/context";
import { validateCollect } from "../validation";
import { composeEntityId } from "../utils";

/**
 * Responsibility: Placeholder handler for production collection commands.
 * Belongs here: orchestration of collect-production state transitions.
 * Does not belong here: UI or persistence concerns.
 */
export const handleCollectProduction = (
  state: CoreGameState,
  command: CollectProductionCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateCollect(state, command, context);

  if (errors.length > 0) {
    return {
      nextState: state,
      events: [],
      errors
    };
  }

  const building = state.buildingsById[command.payload.buildingId];
  const player = state.playersById[command.playerId];
  const productionProfile = context.config.balance.productionBuildings?.[building.buildingTypeId];

  if (!productionProfile) {
    return {
      nextState: state,
      events: [],
      errors: [
        {
          code: "production_not_supported",
          message: "The target building does not support migrated production collection."
        }
      ]
    };
  }

  const buildingResourceStateId = composeEntityId("resource", building.id);
  const buildingResourceState = state.resourceStatesById[buildingResourceStateId];
  const collectedAmount = Math.max(
    0,
    Number(buildingResourceState?.balances?.[productionProfile?.resourceKey || ""] || 0)
  );
  const playerResourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState(player, state.root.tick);

  const nextBuildingResourceState: ResourceState = {
    ...(buildingResourceState as ResourceState),
    balances: {
      ...buildingResourceState.balances,
      [productionProfile.resourceKey]: 0
    },
    lastUpdatedTick: state.root.tick,
    version: buildingResourceState.version + 1
  };

  const nextPlayerResourceState: ResourceState = {
    ...playerResourceState,
    balances: {
      ...playerResourceState.balances,
      [productionProfile.resourceKey]: Math.max(
        0,
        Number(playerResourceState.balances[productionProfile.resourceKey] || 0) + collectedAmount
      )
    },
    lastUpdatedTick: state.root.tick,
    version: playerResourceState.version + (state.resourceStatesById[player.resourceStateId] ? 1 : 0)
  };

  return {
    nextState: {
      ...state,
      resourceStatesById: {
        ...state.resourceStatesById,
        [buildingResourceStateId]: nextBuildingResourceState,
        [playerResourceState.id]: nextPlayerResourceState
      }
    },
    events: [
      createEvent(CORE_EVENT_TYPES.productionCollected, {
        playerId: command.playerId,
        districtId: command.payload.districtId,
        buildingId: command.payload.buildingId,
        resourceKey: productionProfile.resourceKey,
        amount: collectedAmount
      })
    ],
    errors: []
  };
};

const createPlayerResourceState = (
  player: CoreGameState["playersById"][string],
  tick: number
): ResourceState => ({
  id: player.resourceStateId,
  ownerType: "player",
  ownerId: player.id,
  balances: {},
  incomeModifiers: {},
  lastUpdatedTick: tick,
  version: 1
});
