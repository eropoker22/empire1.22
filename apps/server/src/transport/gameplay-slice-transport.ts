import type {
  AuthContext,
  GameplaySliceResponse,
  LoadGameplaySliceRequest,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import type { ServerInstanceManager } from "../runtime";
import type { ServerInstanceRuntime } from "../runtime/instance/server-instance-runtime";
import { createGameplaySliceProjection } from "../runtime/projections";
import type { ServerCommandIngress } from "./command-ingress";
import { validateCommandPlayerIdentity } from "./player-identity-guard";

/**
 * Responsibility: Transport boundary dedicated to the first district/building gameplay slice.
 * Belongs here: request validation, instance lookup, and projection response shaping.
 * Does not belong here: gameplay rules or client rendering.
 */
export interface GameplaySliceTransport {
  load(request: LoadGameplaySliceRequest): GameplaySliceResponse;
  submit(request: SubmitGameplayCommandRequest, authContext?: AuthContext | null): GameplaySliceResponse;
}

export const createGameplaySliceTransport = (
  instanceManager: ServerInstanceManager,
  commandIngress: ServerCommandIngress
): GameplaySliceTransport => ({
  load: (request) => {
    const runtime = instanceManager.getInstanceById(request.serverInstanceId);

    if (!runtime) {
      return createNotFoundResponse("Slice runtime or projection was not found.");
    }

    return {
      accepted: true,
      readModel: createGameplaySliceProjection(runtime, request.playerId, request.districtId),
      errors: [],
      metadata: createGameplaySliceResponseMetadata(runtime)
    };
  },
  submit: (request, authContext) => {
    const identityErrors = validateCommandPlayerIdentity(request.command, authContext);

    if (identityErrors.length > 0) {
      return {
        accepted: false,
        readModel: null,
        errors: identityErrors
      };
    }

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
      errors: dispatchResult.errors,
      metadata: createGameplaySliceResponseMetadata(dispatchResult.runtime)
    };
  }
});

const createGameplaySliceResponseMetadata = (runtime: ServerInstanceRuntime): GameplaySliceResponse["metadata"] => ({
  serverTick: runtime.state.root.tick,
  stateVersion: runtime.state.root.version
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
