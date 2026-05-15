import type { AuthContext, DomainError, GameCommand } from "@empire/shared-types";

export const PLAYER_IDENTITY_MISMATCH_CODE = "transport.player_identity_mismatch";

/**
 * Responsibility: Server transport guard for future session-to-player binding.
 * Belongs here: rejecting commands that claim another player when identity is known.
 * Does not belong here: auth provider integration, token parsing, or gameplay rules.
 */
export const validateCommandPlayerIdentity = (
  command: GameCommand,
  authContext?: AuthContext | null
): DomainError[] => {
  if (!authContext?.authenticatedPlayerId) {
    return [];
  }

  if (authContext.authenticatedPlayerId === command.playerId) {
    return [];
  }

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
};
