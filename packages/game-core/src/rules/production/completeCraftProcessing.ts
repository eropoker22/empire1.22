import type { Notification, ResourceState } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import type { CoreEvent } from "../../events";
import { CORE_EVENT_TYPES, createEvent, createNotification } from "../../events";
import { composeEntityId } from "../../utils";

/**
 * Responsibility: Completes in-flight building processing jobs once their authoritative tick finishes.
 * Belongs here: server-side processing completion and output crediting.
 * Does not belong here: command dispatch or UI progress formatting.
 */
export const completeCraftProcessing = (
  state: CoreGameState,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[] } => {
  let nextBuildingsById = state.buildingsById;
  let nextResourceStates = state.resourceStatesById;
  let nextNotificationsById = state.notificationsById;
  let nextNotificationIds = state.root.notificationIds;
  const events: CoreEvent[] = [];
  let changed = false;

  for (const building of Object.values(state.buildingsById)) {
    const processingJob = building.processing;

    if (!processingJob || building.status !== "active" || processingJob.completesAtTick > state.root.tick) {
      continue;
    }

    const player = state.playersById[building.ownerPlayerId];
    const recipe = context.config.balance.craftBuildings?.[building.buildingTypeId]?.recipes[processingJob.recipeId];

    if (!player || !recipe) {
      continue;
    }

    const currentPlayerResourceState = nextResourceStates[player.resourceStateId] ?? createPlayerResourceState(player, state.root.tick);
    const nextPlayerResourceState: ResourceState = {
      ...currentPlayerResourceState,
      balances: {
        ...currentPlayerResourceState.balances,
        [recipe.outputResourceKey]: Math.max(
          0,
          Number(currentPlayerResourceState.balances[recipe.outputResourceKey] || 0) + recipe.outputAmount
        )
      },
      lastUpdatedTick: state.root.tick,
      version: currentPlayerResourceState.version + (nextResourceStates[player.resourceStateId] ? 1 : 0)
    };

    nextResourceStates = {
      ...nextResourceStates,
      [nextPlayerResourceState.id]: nextPlayerResourceState
    };
    nextBuildingsById = {
      ...nextBuildingsById,
      [building.id]: {
        ...building,
        processing: null,
        version: building.version + 1
      }
    };
    const notification = createProcessingCompletedNotification(
      state.serverInstance.id,
      building.id,
      player.id,
      recipe.label,
      recipe.outputResourceLabel,
      recipe.outputAmount,
      state.root.tick
    );

    nextNotificationsById = {
      ...nextNotificationsById,
      [notification.id]: notification
    };
    nextNotificationIds = [...nextNotificationIds, notification.id];
    events.push(
      createEvent(CORE_EVENT_TYPES.itemCrafted, {
        playerId: building.ownerPlayerId,
        districtId: building.districtId,
        buildingId: building.id,
        recipeId: processingJob.recipeId,
        outputResourceKey: recipe.outputResourceKey,
        outputAmount: recipe.outputAmount
      }),
      createEvent(CORE_EVENT_TYPES.notificationCreated, {
        notificationId: notification.id,
        recipientId: player.id,
        category: notification.category
      })
    );
    changed = true;
  }

  return changed
    ? {
        nextState: {
          ...state,
          buildingsById: nextBuildingsById,
          resourceStatesById: nextResourceStates,
          notificationsById: nextNotificationsById,
          root: {
            ...state.root,
            notificationIds: nextNotificationIds,
            version: state.root.version + 1
          }
        },
        events
      }
    : {
        nextState: state,
        events
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

const createProcessingCompletedNotification = (
  instanceId: string,
  buildingId: string,
  playerId: string,
  recipeLabel: string,
  outputResourceLabel: string,
  outputAmount: number,
  tick: number
): Notification =>
  createNotification({
    id: composeEntityId("notification", `${buildingId}:crafted:${tick}`),
    recipientType: "player",
    recipientId: playerId,
    category: "processing.completed",
    title: `${recipeLabel} ready`,
    bodyKey: "processing.completed",
    payload: {
      instanceId,
      buildingId,
      recipeLabel,
      outputResourceLabel,
      outputAmount,
      tick
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  });
