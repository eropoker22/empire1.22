import type { CoreGameState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { DomainError } from "@empire/shared-types";
import {
  addPlayerToGameplaySliceState,
  ensureLiveBountyTarget,
  type GameplaySliceMembershipRequest
} from "./gameplay-slice-session-seed";
import { ensureSharedCityMap } from "./gameplay-slice-shared-city-seed";

type MembershipAccepted = {
  accepted: true;
  state: CoreGameState;
  joinedPlayer: boolean;
  stateChanged: boolean;
  errors: [];
};

type MembershipRejected = {
  accepted: false;
  state: CoreGameState;
  joinedPlayer: false;
  stateChanged: false;
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
    const config = resolveModeConfig(request.mode);
    const stateChanged = ensureSharedCityMap(state, request.serverInstanceId, {
      buildSlotLimit: config.balance.buildSlotLimit,
      productionBuildings: config.balance.productionBuildings ?? {},
      robbery: config.balance.conflict?.robbery
    });
    if (stateChanged) {
      state.root.version += 1;
    }
    ensureLiveBountyTarget(state, request);

    return {
      accepted: true,
      state,
      joinedPlayer: false,
      stateChanged,
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
      stateChanged: false,
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

  const nextState = addPlayerToGameplaySliceState(state, request);

  return {
    accepted: true,
    state: nextState,
    joinedPlayer: true,
    stateChanged: true,
    errors: []
  };
};

const countRegisteredPlayers = (state: CoreGameState): number =>
  new Set(state.root.playerIds.filter((playerId) => state.playersById[playerId])).size;
