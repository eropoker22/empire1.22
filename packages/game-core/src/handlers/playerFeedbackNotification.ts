import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";

/** Persist only recipient-safe facts, in the same transaction as the operation. */
export function addPlayerFeedback(state: CoreGameState, context: GameCoreContext, input: {
  id: string; playerId: string; title: string; payload: Record<string, unknown>;
}): CoreGameState {
  if (state.notificationsById[input.id]) return state;
  const player = state.playersById[input.playerId];
  if (!player) return state;
  const notification = {
    id: input.id, recipientType: "player" as const, recipientId: player.id,
    category: "player.feedback", title: input.title, bodyKey: "player.feedback",
    payload: { ...input.payload, membershipId: player.metadata?.membershipId ?? null },
    createdAt: context.clock?.nowIso() ?? new Date(Date.parse(state.serverInstance.startedAt)
      + state.root.tick * context.config.tickRateMs).toISOString(), readAt: null
  };
  return { ...state, notificationsById: { ...state.notificationsById, [notification.id]: notification },
    root: { ...state.root, notificationIds: [...state.root.notificationIds, notification.id], version: state.root.version + 1 } };
}
