import type {
  GameplaySliceResponse,
  LoadGameplaySliceRequest,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import type { ServerInstanceManager } from "../runtime";
import { createGameplaySliceProjection } from "../runtime/projections";
import type { ServerCommandIngress } from "./command-ingress";

/**
 * Responsibility: Transport boundary dedicated to the first district/building gameplay slice.
 * Belongs here: request validation, instance lookup, and projection response shaping.
 * Does not belong here: gameplay rules or client rendering.
 */
export interface GameplaySliceTransport {
  load(request: LoadGameplaySliceRequest): GameplaySliceResponse;
  submit(request: SubmitGameplayCommandRequest): GameplaySliceResponse;
}

export const createGameplaySliceTransport = (
  instanceManager: ServerInstanceManager,
  commandIngress: ServerCommandIngress
): GameplaySliceTransport => ({
  load: (request) => {
    const readModel = instanceManager.getGameplaySliceProjection(
      request.serverInstanceId,
      request.playerId,
      request.districtId
    );

    return readModel
      ? {
          accepted: true,
          readModel,
          errors: []
        }
      : createNotFoundResponse("Slice runtime or projection was not found.");
  },
  submit: (request) => {
    const dispatchResult = commandIngress.submit(request.command);

    if (!dispatchResult) {
      return createNotFoundResponse("Target instance was not found for the submitted command.");
    }

    return {
      accepted: dispatchResult.errors.length === 0,
      readModel: createGameplaySliceProjection(
        dispatchResult.runtime,
        request.command.playerId,
        request.focusDistrictId
      ),
      errors: dispatchResult.errors
    };
  }
});

const createNotFoundResponse = (message: string): GameplaySliceResponse => ({
  accepted: false,
  readModel: null,
  errors: [
    {
      code: "transport.not_found",
      message
    }
  ]
});
