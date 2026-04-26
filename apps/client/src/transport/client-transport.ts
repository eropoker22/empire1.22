import type {
  GameplaySliceResponse,
  LoadGameplaySliceRequest,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";

/**
 * Responsibility: Low-level transport boundary for client-to-server communication.
 * Belongs here: sending commands and receiving server-fed updates through adapters.
 * Does not belong here: gameplay rules or UI rendering.
 */
export interface ClientTransport {
  load(request: LoadGameplaySliceRequest): Promise<GameplaySliceResponse>;
  send(request: SubmitGameplayCommandRequest): Promise<GameplaySliceResponse>;
}
