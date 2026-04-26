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
): ClientTransport => ({
  load: async (request) => endpoint.load(request),
  send: async (request) => endpoint.submit(request)
});
