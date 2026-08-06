import type {
  GameplaySliceResponse,
  HostedMatchResultsView,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";

export interface FinishedAccountResultRepository {
  getMatchResults(accountId: string, serverInstanceId: string): Promise<HostedMatchResultsView | null>;
}

/**
 * Resolves an account-scoped terminal rejection for a completed match.
 * This never creates gameplay authority: the account membership only permits
 * reading its persisted result, and every command remains rejected.
 */
export const resolveFinishedAccountSubmitRejection = async (input: {
  accountId: string;
  request: SubmitGameplayCommandRequest;
  repository: FinishedAccountResultRepository;
}): Promise<GameplaySliceResponse | null> => {
  const serverInstanceId = input.request.command.serverInstanceId;
  const result = await input.repository.getMatchResults(input.accountId, serverInstanceId);
  if (!result || result.server.status !== "ended") return null;

  const metadata = {
    serverTick: result.server.currentTick,
    stateVersion: result.server.stateVersion
  };
  if (input.request.command.playerId !== result.currentPlayerId) {
    return {
      accepted: false,
      readModel: null,
      errors: [{
        code: "PLAYER_IDENTITY_MISMATCH",
        message: "Command playerId does not match the authenticated account membership."
      }],
      metadata
    };
  }

  return {
    accepted: false,
    readModel: null,
    errors: [{
      code: "GAME_FINISHED",
      message: "Tato hra už skončila. Výsledek zůstává pouze ke čtení.",
      details: { serverInstanceId }
    }],
    metadata
  };
};
