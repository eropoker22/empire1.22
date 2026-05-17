import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  type DomainError
} from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";

const NON_JOINABLE_STATUSES = new Set([
  "stopped",
  "stopping",
  "destroyed",
  "destroying",
  "crashed",
  "ended",
  "full"
]);

export const isRuntimeJoinable = (runtime: ServerInstanceRuntime): boolean =>
  validateRuntimeJoinability(runtime, null).length === 0;

export const validateRuntimeJoinability = (
  runtime: ServerInstanceRuntime,
  playerId: string | null
): DomainError[] => {
  if (playerId && runtime.state.playersById[playerId]) {
    return [];
  }

  if (runtime.state.root.phase === PRODUCTION_GAME_LIFECYCLE_PHASES.resolved || runtime.state.serverInstance.status === "ended") {
    return [
      {
        code: "server.instance_resolved",
        message: "Resolved server instances do not accept new players.",
        details: {
          serverInstanceId: runtime.record.id,
          phase: runtime.state.root.phase
        }
      }
    ];
  }

  const playerCount = countRegisteredPlayers(runtime);
  if (playerCount >= runtime.lobby.maxPlayers) {
    return [
      {
        code: "server.player_cap_reached",
        message: createPlayerCapMessage(runtime),
        details: {
          currentPlayerCount: playerCount,
          maxPlayersPerServer: runtime.lobby.maxPlayers
        }
      }
    ];
  }

  if (NON_JOINABLE_STATUSES.has(runtime.record.status) || runtime.lobby.joinPolicy === "closed") {
    return [
      {
        code: "server.instance_not_joinable",
        message: "Server instance is not open for new players.",
        details: {
          serverInstanceId: runtime.record.id,
          status: runtime.record.status,
          joinPolicy: runtime.lobby.joinPolicy
        }
      }
    ];
  }

  return [];
};

export const syncRuntimeCapacityStatus = (runtime: ServerInstanceRuntime): void => {
  if (runtime.record.status === "ended" || runtime.record.status === "destroyed" || runtime.record.status === "stopped") {
    return;
  }

  if (countRegisteredPlayers(runtime) >= runtime.lobby.maxPlayers) {
    runtime.record.status = "full";
  }
};

const countRegisteredPlayers = (runtime: ServerInstanceRuntime): number =>
  new Set(runtime.state.root.playerIds.filter((playerId) => runtime.state.playersById[playerId])).size;

const createPlayerCapMessage = (runtime: ServerInstanceRuntime): string =>
  runtime.lobby.maxPlayers === runtime.config.balance.maxPlayersPerServer
    ? `Server instance is full. This mode allows ${runtime.lobby.maxPlayers} players.`
    : `Server instance is full. This server allows ${runtime.lobby.maxPlayers} players.`;
