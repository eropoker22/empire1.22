import type {
  GameplaySliceResponse,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import type { ClientTransport } from "./client-transport";

/**
 * Responsibility: Sends player commands to the authoritative server transport boundary.
 * Belongs here: dispatch sequencing and pending-request seam for the client.
 * Does not belong here: command outcome logic or UI rendering.
 */
export interface CommandDispatcher {
  dispatch(request: SubmitGameplayCommandRequest): Promise<GameplaySliceResponse>;
}

export const createCommandDispatcher = (transport: ClientTransport): CommandDispatcher => ({
  dispatch: (request) => transport.send(request)
});
