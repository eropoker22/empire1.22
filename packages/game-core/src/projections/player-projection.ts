import { DEFAULT_PLAYER_COLOR, type Notification, type PlayerView, type VictoryState } from "@empire/shared-types";
import type { GameCoreContext } from "../engine/context";
import type { CoreGameState } from "../entities/game-state";
import { createPoliceReadModel } from "./police-read-model-projection";

/**
 * Responsibility: Builds a minimal player-facing projection from authoritative core state.
 * Belongs here: read-only server-side shaping for UI-facing player views.
 * Does not belong here: client rendering logic or transport delivery.
 */
export const createPlayerView = (state: CoreGameState, playerId: string, context?: GameCoreContext): PlayerView => {
  const player = state.playersById[playerId];
  const notifications: Notification[] = state.root.notificationIds
    .map((notificationId) => state.notificationsById[notificationId])
    .filter((notification): notification is Notification => notification?.recipientId === playerId);

  const victoryState: VictoryState | null = state.victoryState;
  const resourceBalances = player ? { ...(state.resourceStatesById[player.resourceStateId]?.balances ?? {}) } : {};
  if (player && Number.isFinite(Number(player.population))) {
    resourceBalances.population = Math.max(0, Number(player.population || 0));
  }

  return {
    playerId,
    instanceId: state.serverInstance.id,
    mode: state.serverInstance.mode,
    factionId: player?.factionId ?? "mafian",
    color: player?.color ?? DEFAULT_PLAYER_COLOR,
    serverTime: new Date(0).toISOString(),
    resourceBalances,
    police: createPoliceReadModel(state, playerId, context),
    notifications,
    victoryState
  };
};
