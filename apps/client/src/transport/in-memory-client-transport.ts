import type {
  GameplaySliceResponse,
  LoadGameplaySliceRequest,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import type { ClientTransport } from "./client-transport";

export interface GameplaySliceEndpoint {
  load(request: LoadGameplaySliceRequest): GameplaySliceResponse | Promise<GameplaySliceResponse>;
  submit(request: SubmitGameplayCommandRequest): GameplaySliceResponse | Promise<GameplaySliceResponse>;
}

/**
 * Responsibility: Simple in-process transport adapter for tests and local demo wiring.
 * Belongs here: client-side transport abstraction over a server endpoint contract.
 * Does not belong here: server authority or gameplay rules.
 */
export const createInMemoryClientTransport = (
  endpoint: GameplaySliceEndpoint
): ClientTransport => {
  const sessionTokensByKey = new Map<string, string>();

  return {
    load: async (request) => {
      const sessionToken = request.sessionToken ?? sessionTokensByKey.get(createSessionKey(request));
      const response = await endpoint.load(sessionToken
        ? {
            ...request,
            sessionToken
          }
        : request);
      persistSessionToken(request, response, sessionTokensByKey);
      return response;
    },
    send: async (request) => {
      const sessionToken = sessionTokensByKey.get(createSessionKey(request));
      const response = await endpoint.submit(sessionToken
        ? {
            ...request,
            sessionToken
          }
        : request);
      persistSessionToken(request, response, sessionTokensByKey);
      return response;
    }
  };
};

const persistSessionToken = (
  request: LoadGameplaySliceRequest | SubmitGameplayCommandRequest,
  response: GameplaySliceResponse,
  sessionTokensByKey: Map<string, string>
): void => {
  const sessionToken = String(response.sessionToken ?? request.sessionToken ?? "").trim();
  if (sessionToken) {
    sessionTokensByKey.set(createSessionKey(request), sessionToken);
  }
};

const createSessionKey = (
  request: LoadGameplaySliceRequest | SubmitGameplayCommandRequest
): string => {
  const serverInstanceId = "command" in request
    ? request.command.serverInstanceId
    : request.serverInstanceId;
  const playerId = "command" in request
    ? request.command.playerId
    : request.playerId;

  return `${serverInstanceId}:${playerId}`;
};
