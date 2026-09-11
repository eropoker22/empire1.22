import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { createNotification } from "../../events";
import { composeEntityId } from "../../utils";

export const appendCityEventNotification = (
  state: CoreGameState,
  playerId: string,
  idSuffix: string,
  title: string,
  bodyKey: string,
  payload: Record<string, unknown>,
  context: GameCoreContext
): CoreGameState => {
  const id = composeEntityId("notification", `city-event:${playerId}:${idSuffix}`);
  if (state.notificationsById[id]) return state;
  const notification = createNotification({
    id,
    recipientType: "player",
    recipientId: playerId,
    category: "city.event",
    title,
    bodyKey,
    payload,
    createdAt: context.clock?.nowIso() ?? new Date(0).toISOString(),
    readAt: null
  });
  return {
    ...state,
    notificationsById: { ...state.notificationsById, [id]: notification },
    root: { ...state.root, notificationIds: [...state.root.notificationIds, id], version: state.root.version + 1 }
  };
};

