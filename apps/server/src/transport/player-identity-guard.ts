import type { AuthContext, DomainError, GameCommand } from "@empire/shared-types";
import type { GameplaySessionTokenCodec } from "./gameplay-session-token-codec";

export const PLAYER_IDENTITY_MISMATCH_CODE = "transport.player_identity_mismatch";
export const SESSION_TOKEN_MISSING_CODE = "transport.session_token_missing";
export const SESSION_TOKEN_INVALID_CODE = "transport.session_token_invalid";
export const SESSION_IDENTITY_MISMATCH_CODE = "transport.session_identity_mismatch";

export interface GameplaySessionIdentityGuardOptions {
  sessionToken?: string | null;
  sessionTokenCodec?: GameplaySessionTokenCodec | null;
}

/**
 * Responsibility: Server transport guard for future session-to-player binding.
 * Belongs here: rejecting commands that claim another player when identity is known.
 * Does not belong here: auth provider integration, token parsing, or gameplay rules.
 */
export const validateCommandPlayerIdentity = (
  command: GameCommand,
  authContext?: AuthContext | null,
  sessionOptions: GameplaySessionIdentityGuardOptions = {}
): DomainError[] => {
  if (!authContext?.authenticatedPlayerId) {
    return validateCommandGameplaySessionIdentity(command, sessionOptions);
  }

  if (authContext.authenticatedPlayerId !== command.playerId) {
    return [
      {
        code: PLAYER_IDENTITY_MISMATCH_CODE,
        message: "Command playerId does not match the authenticated request identity.",
        details: {
          authenticatedPlayerId: authContext.authenticatedPlayerId,
          commandPlayerId: command.playerId
        }
      }
    ];
  }

  return validateCommandGameplaySessionIdentity(command, sessionOptions);
};

const validateCommandGameplaySessionIdentity = (
  command: GameCommand,
  options: GameplaySessionIdentityGuardOptions
): DomainError[] => {
  if (!options.sessionTokenCodec) {
    return [];
  }

  const token = String(options.sessionToken ?? "").trim();
  if (!token) {
    return [
      {
        code: SESSION_TOKEN_MISSING_CODE,
        message: "Gameplay session token is required for command submit.",
        details: {
          commandPlayerId: command.playerId,
          commandServerInstanceId: command.serverInstanceId
        }
      }
    ];
  }

  const payload = options.sessionTokenCodec.open(token);
  if (!payload) {
    return [
      {
        code: SESSION_TOKEN_INVALID_CODE,
        message: "Gameplay session token is invalid."
      }
    ];
  }

  if (
    payload.playerId === command.playerId &&
    payload.serverInstanceId === command.serverInstanceId
  ) {
    return [];
  }

  return [
    {
      code: SESSION_IDENTITY_MISMATCH_CODE,
      message: "Command identity does not match the gameplay session token.",
      details: {
        tokenPlayerId: payload.playerId,
        tokenServerInstanceId: payload.serverInstanceId,
        commandPlayerId: command.playerId,
        commandServerInstanceId: command.serverInstanceId
      }
    }
  ];
};
