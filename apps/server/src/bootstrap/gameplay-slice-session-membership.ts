import type { CoreGameState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { DomainError } from "@empire/shared-types";
import {
  addPlayerToGameplaySliceState,
  type GameplaySliceMembershipRequest
} from "./gameplay-slice-session-seed";

type MembershipAccepted = {
  accepted: true;
  state: CoreGameState;
  joinedPlayer: boolean;
  errors: [];
};

type MembershipRejected = {
  accepted: false;
  state: CoreGameState;
  joinedPlayer: false;
  errors: DomainError[];
};

export type GameplaySliceMembershipResult = MembershipAccepted | MembershipRejected;

/**
 * Responsibility: server-authoritative membership guard for gameplay slice bootstrap.
 * Belongs here: idempotent player joins and capacity enforcement.
 * Does not belong here: command handling, combat rules, or UI state.
 */
export const ensureGameplaySliceMembershipInState = (
  state: CoreGameState,
  request: GameplaySliceMembershipRequest
): GameplaySliceMembershipResult => {
  if (state.playersById[request.playerId]) {
    return {
      accepted: true,
      state,
      joinedPlayer: false,
      errors: []
    };
  }

  const config = resolveModeConfig(request.mode);
  const playerCount = countRegisteredPlayers(state);
  const maxPlayers = config.balance.maxPlayersPerServer;

  if (playerCount >= maxPlayers) {
    return {
      accepted: false,
      state,
      joinedPlayer: false,
      errors: [
        {
          code: "server.player_cap_reached",
          message: `Server instance is full. This mode allows ${maxPlayers} players.`,
          details: {
            currentPlayerCount: playerCount,
            maxPlayersPerServer: maxPlayers
          }
        }
      ]
    };
  }

  return {
    accepted: true,
    state: addPlayerToGameplaySliceState(state, request),
    joinedPlayer: true,
    errors: []
  };
};

const countRegisteredPlayers = (state: CoreGameState): number =>
  new Set(state.root.playerIds.filter((playerId) => state.playersById[playerId])).size;
