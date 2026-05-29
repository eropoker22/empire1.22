import type {
  AuthContext,
  GameplaySliceResponse,
  LoadGameplaySliceRequest,
  ServerAssignedFocusDistrictId,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import { SERVER_ASSIGNED_FOCUS_DISTRICT_ID } from "@empire/shared-types";
import type { ServerInstanceManager } from "../runtime";
import type { ServerInstanceRuntime } from "../runtime/instance/server-instance-runtime";
import { writeCommandRejectionDiagnostic } from "../runtime/logging";
import { createGameplaySliceProjection } from "../runtime/projections";
import type { ServerCommandIngress } from "./command-ingress";
import { validateCommandPlayerIdentity } from "./player-identity-guard";
import type { GameplaySessionTokenCodec } from "./gameplay-session-token-codec";

export interface GameplaySliceTransportOptions {
  sessionTokenCodec?: GameplaySessionTokenCodec | null;
}

/**
 * Responsibility: Transport boundary dedicated to the first district/building gameplay slice.
 * Belongs here: request validation, instance lookup, and projection response shaping.
 * Does not belong here: gameplay rules or client rendering.
 */
export interface GameplaySliceTransport {
  load(request: LoadGameplaySliceRequest): GameplaySliceResponse;
  submit(request: SubmitGameplayCommandRequest, authContext?: AuthContext | null): Promise<GameplaySliceResponse>;
}

export const createGameplaySliceTransport = (
  instanceManager: ServerInstanceManager,
  commandIngress: ServerCommandIngress,
  options: GameplaySliceTransportOptions = {}
): GameplaySliceTransport => {
  const createGameplaySessionToken = (
    runtime: ServerInstanceRuntime,
    playerId: string
  ): string | null => {
    const player = runtime.state.playersById[playerId];
    const issuedAt = runtime.clock.now();
    const ttlMs = Math.max(1, runtime.config.technical.sessionTtlMs);

    return player && options.sessionTokenCodec
      ? options.sessionTokenCodec.seal({
          serverInstanceId: runtime.record.id,
          playerId: player.id,
          factionId: player.factionId,
          issuedAt: issuedAt.toISOString(),
          expiresAt: new Date(issuedAt.getTime() + ttlMs).toISOString()
        })
      : null;
  };

  return {
    load: (request) => {
      const runtime = instanceManager.getInstanceById(request.serverInstanceId);

      if (!runtime) {
        return createNotFoundResponse("Slice runtime or projection was not found.");
      }

      return {
        accepted: true,
        readModel: createGameplaySliceProjection(runtime, request.playerId, request.districtId),
        errors: [],
        metadata: createGameplaySliceResponseMetadata(runtime),
        sessionToken: createGameplaySessionToken(runtime, request.playerId)
      };
    },
    submit: async (request, authContext) => {
      const identityErrors = validateCommandPlayerIdentity(request.command, authContext, {
        sessionToken: request.sessionToken,
        sessionTokenCodec: options.sessionTokenCodec
      });

      if (identityErrors.length > 0) {
        const runtime = instanceManager.getInstanceById(request.command.serverInstanceId);
        if (runtime) {
          void writeCommandRejectionDiagnostic({
            runtime,
            command: request.command,
            errors: identityErrors,
            category: "transport_rejected",
            message: "Command rejected by transport identity guard.",
            expectedStateVersion: request.expectedStateVersion,
            focusDistrictId: request.focusDistrictId
          });
        }

        return {
          accepted: false,
          readModel: null,
          errors: identityErrors
        };
      }

      if (isServerAssignedFocusDistrictId(request.focusDistrictId)) {
        const runtime = instanceManager.getInstanceById(request.command.serverInstanceId);
        const errors = [
          {
            code: "transport.invalid_request",
            message: "Gameplay slice submit request field 'focusDistrictId' must be a concrete server district.",
            details: {
              field: "focusDistrictId"
            }
          }
        ];

        if (runtime) {
          void writeCommandRejectionDiagnostic({
            runtime,
            command: request.command,
            errors,
            category: "transport_rejected",
            message: "Command rejected by transport request guard.",
            expectedStateVersion: request.expectedStateVersion,
            focusDistrictId: request.focusDistrictId
          });
        }

        return {
          accepted: false,
          readModel: runtime
            ? createGameplaySliceProjection(runtime, request.command.playerId, null)
            : null,
          errors,
          metadata: runtime ? createGameplaySliceResponseMetadata(runtime) : undefined,
          sessionToken: runtime ? createGameplaySessionToken(runtime, request.command.playerId) : null
        };
      }

      const dispatchResult = await commandIngress.submit(request.command, {
        expectedStateVersion: request.expectedStateVersion
      });

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
        metadata: createGameplaySliceResponseMetadata(dispatchResult.runtime),
        sessionToken: createGameplaySessionToken(dispatchResult.runtime, request.command.playerId)
      };
    }
  };
};

const isServerAssignedFocusDistrictId = (
  districtId: string
): districtId is ServerAssignedFocusDistrictId =>
  districtId === SERVER_ASSIGNED_FOCUS_DISTRICT_ID;

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
