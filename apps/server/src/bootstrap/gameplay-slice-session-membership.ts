import { countRuntimeOccupiedSeats } from "../runtime/instance/runtime-player-occupancy";
import type { CoreGameState } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { normalizeFactionId } from "@empire/game-core";
import { MAX_PLAYERS_PER_FACTION, type DomainError } from "@empire/shared-types";
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
    const mapChanged = ensureSharedCityMap(state, request.serverInstanceId, {
      buildSlotLimit: config.balance.buildSlotLimit,
      productionBuildings: config.balance.productionBuildings ?? {},
      robbery: config.balance.conflict?.robbery
    });
    if (mapChanged) {
      state.root.version += 1;
    }
    const demoTargetsChanged = ensureLiveBountyTarget(state, request);
    const stateChanged = mapChanged || demoTargetsChanged;

    return {
      accepted: true,
      state,
      joinedPlayer: false,
      stateChanged,
      errors: []
    };
  }

  const config = resolveModeConfig(request.mode);
  const playerCount = countRuntimeOccupiedSeats(state);
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

  const factionId = normalizeFactionId(request.factionId, config);
  const factionPlayers = Object.values(state.playersById).filter((player) =>
    player.status === "active" && player.factionId === factionId).length;
  if (factionPlayers >= MAX_PLAYERS_PER_FACTION) {
    return { accepted: false, state, joinedPlayer: false, stateChanged: false,
      errors: [{ code: "server.faction_cap_reached", message: "Server je už touto frakcí zaplněn. Vyber jinou frakci.",
        details: { factionId, currentPlayerCount: factionPlayers, maxPlayersPerFaction: MAX_PLAYERS_PER_FACTION } }] };
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
