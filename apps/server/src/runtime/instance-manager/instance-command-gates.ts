import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  type DomainError,
  type GameCommand
} from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";

const MAX_COMMANDS_PER_PLAYER_PER_TICK = 5;

/**
 * Responsibility: Server-side pre-dispatch guards for player commands.
 * Belongs here: instance identity, mode, TTL, anti-replay, and flood checks.
 * Does not belong here: core gameplay validation or command side effects.
 */
export const validateCommandDispatchGate = (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  options: {
    expectedStateVersion?: number | null;
    skipProcessedCommandIdGate?: boolean;
  } = {}
): DomainError[] => {
  if (command.serverInstanceId !== runtime.record.id) {
    return [
      {
        code: "server.instance_mismatch",
        message: "Command serverInstanceId does not match the target server instance."
      }
    ];
  }

  if (command.mode !== runtime.record.mode) {
    return [
      {
        code: "server.mode_mismatch",
        message: "Command mode does not match the target server instance mode."
      }
    ];
  }

  if (!options.skipProcessedCommandIdGate && runtime.processedCommandIds.has(command.id)) {
    return [
      {
        code: "server.duplicate_command",
        message: "Command id was already processed by this server instance."
      }
    ];
  }

  if (
    typeof options.expectedStateVersion === "number" &&
    Number.isFinite(options.expectedStateVersion) &&
    options.expectedStateVersion !== runtime.state.root.version
  ) {
    return [
      {
        code: "server.state_version_conflict",
        message: "Command expectedStateVersion does not match the current server state version.",
        details: {
          expectedStateVersion: options.expectedStateVersion,
          currentStateVersion: runtime.state.root.version
        }
      }
    ];
  }

  if (runtime.state.serverInstance.status === "ended" || runtime.state.root.phase === PRODUCTION_GAME_LIFECYCLE_PHASES.resolved) {
    return [
      {
        code: "server.instance_resolved",
        message: "Resolved server instances do not accept player commands."
      }
    ];
  }

  if (runtime.state.root.playerIds.length > runtime.config.balance.maxPlayersPerServer) {
    return [
      {
        code: "server.player_cap_exceeded",
        message: "Server instance player count exceeds the configured maximum."
      }
    ];
  }

  const sessionTtlTicks = Math.max(
    1,
    Math.ceil(runtime.config.technical.sessionTtlMs / Math.max(1, runtime.config.tickRateMs))
  );

  if (runtime.state.root.tick >= sessionTtlTicks) {
    return [
      {
        code: "server.session_expired",
        message: "Server instance session TTL has expired."
      }
    ];
  }

  const currentRateWindow = normalizeCommandRateLimitWindow(runtime);
  const currentCommandCount = currentRateWindow.commandCountsByPlayerId[command.playerId] ?? 0;

  if (currentCommandCount >= MAX_COMMANDS_PER_PLAYER_PER_TICK) {
    return [
      {
        code: "server.rate_limited",
        message: "Player command rate limit exceeded for the current server tick."
      }
    ];
  }

  return [];
};

export const recordCommandRateLimitUsage = (
  runtime: ServerInstanceRuntime,
  command: GameCommand
): void => {
  const currentRateWindow = normalizeCommandRateLimitWindow(runtime);
  currentRateWindow.commandCountsByPlayerId[command.playerId] =
    (currentRateWindow.commandCountsByPlayerId[command.playerId] ?? 0) + 1;
};

const normalizeCommandRateLimitWindow = (
  runtime: ServerInstanceRuntime
): ServerInstanceRuntime["commandRateLimitWindow"] => {
  if (runtime.commandRateLimitWindow.tick === runtime.state.root.tick) {
    return runtime.commandRateLimitWindow;
  }

  runtime.commandRateLimitWindow = {
    tick: runtime.state.root.tick,
    commandCountsByPlayerId: {}
  };

  return runtime.commandRateLimitWindow;
};
