import type {
  AuthContext,
  GameplayCommandResultLookupResponse,
  GameplaySliceResponse,
  LookupGameplayCommandResultRequest,
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
import type { GameplaySessionService } from "../auth";
import { lookupGameplayCommandResult } from "./gameplay-command-result-lookup";

export interface GameplaySliceTransportOptions {
  sessionTokenCodec?: GameplaySessionTokenCodec | null;
  gameplaySessionService?: GameplaySessionService | null;
}

export interface GameplaySliceTransport {
  load(request: LoadGameplaySliceRequest): Promise<GameplaySliceResponse>;
  submit(request: SubmitGameplayCommandRequest, authContext?: AuthContext | null): Promise<GameplaySliceResponse>;
  lookupCommandResult?(request: LookupGameplayCommandResultRequest): Promise<GameplayCommandResultLookupResponse>;
}

export const createGameplaySliceTransport = (
  instanceManager: ServerInstanceManager,
  commandIngress: ServerCommandIngress,
  options: GameplaySliceTransportOptions = {}
): GameplaySliceTransport => {
  return {
    load: async (request) => {
      const runtime = instanceManager.getInstanceById(request.serverInstanceId);
      const sessionResult = await validateRequestSession(
        request.sessionToken,
        request.serverInstanceId,
        runtime?.clock.nowIso()
      );
      if (!sessionResult.accepted) {
        return {
          accepted: false,
          readModel: null,
          errors: sessionResult.errors
        };
      }
      if (!runtime) {
        return createNotFoundResponse("Slice runtime or projection was not found.");
      }
      return {
        accepted: true,
        readModel: createGameplaySliceProjection(runtime, sessionResult.session.playerId, request.districtId),
        errors: [],
        metadata: createGameplaySliceResponseMetadata(runtime)
      };
    },
    submit: async (request, authContext) => {
      const runtimeForSession = instanceManager.getInstanceById(request.command.serverInstanceId);
      const sessionResult = await validateRequestSession(
        request.sessionToken,
        request.command.serverInstanceId,
        runtimeForSession?.clock.nowIso()
      );
      if (!sessionResult.accepted) {
        const runtime = runtimeForSession;
        if (runtime) {
          void writeCommandRejectionDiagnostic({
            runtime,
            command: request.command,
            errors: sessionResult.errors,
            category: "transport_rejected",
            message: "Command rejected by transport session guard.",
            expectedStateVersion: request.expectedStateVersion,
            focusDistrictId: request.focusDistrictId
          }).catch(() => undefined);
        }
        return {
          accepted: false,
          readModel: null,
          errors: sessionResult.errors
        };
      }
      if (
        request.command.playerId !== sessionResult.session.playerId ||
        request.command.serverInstanceId !== sessionResult.session.serverInstanceId
      ) {
        return {
          accepted: false,
          readModel: null,
          errors: [{
            code: "PLAYER_IDENTITY_MISMATCH",
            message: "Command playerId does not match the gameplay session."
          }]
        };
      }
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
          }).catch(() => undefined);
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
          }).catch(() => undefined);
        }
        return {
          accepted: false,
          readModel: runtime
            ? createGameplaySliceProjection(runtime, sessionResult.session.playerId, null)
            : null,
          errors,
          metadata: runtime ? createGameplaySliceResponseMetadata(runtime) : undefined,
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
          sessionResult.session.playerId,
          request.focusDistrictId
        ),
        errors: dispatchResult.errors,
        metadata: createGameplaySliceResponseMetadata(dispatchResult.runtime),
        commandResult: dispatchResult.commandResult
          ? {
              commandId: dispatchResult.commandResult.commandId,
              status: dispatchResult.commandResult.status,
              rootVersionBefore: dispatchResult.commandResult.rootVersionBefore,
              rootVersionAfter: dispatchResult.commandResult.rootVersionAfter,
              eventCount: dispatchResult.commandResult.eventCount,
              eventIds: dispatchResult.commandResult.eventIds,
              snapshotId: dispatchResult.commandResult.snapshotId
            }
          : null
      };
    },
    lookupCommandResult: async (request) => {
      const runtime = instanceManager.getInstanceById(request.serverInstanceId);
      const sessionResult = await validateRequestSession(
        request.sessionToken,
        request.serverInstanceId,
        runtime?.clock.nowIso()
      );
      if (!sessionResult.accepted) {
        return {
          accepted: false,
          status: "not_found",
          readModel: null,
          errors: sessionResult.errors
        };
      }
      if (!runtime) {
        return {
          accepted: false,
          status: "not_found",
          readModel: null,
          errors: [{ code: "transport.not_found", message: "Slice runtime or projection was not found." }]
        };
      }
      return lookupGameplayCommandResult(runtime, sessionResult.session.playerId, request);
    }
  };
  async function validateRequestSession(
    sessionTokenOrId: string | null | undefined,
    serverInstanceId: string,
    nowIso = new Date().toISOString()
  ): ReturnType<GameplaySessionService["validateSession"]> {
    if (!options.gameplaySessionService) {
      return {
        accepted: false,
        errors: [{
          code: "SESSION_INVALID",
          message: "Gameplay session repository is unavailable."
        }]
      };
    }
    const rawSessionTokenOrId = String(sessionTokenOrId ?? "").trim();
    const tokenPayload = options.sessionTokenCodec?.open(rawSessionTokenOrId);
    if (options.sessionTokenCodec && rawSessionTokenOrId && !tokenPayload) {
      return {
        accepted: false,
        errors: [{
          code: "SESSION_INVALID",
          message: "Gameplay session token is invalid."
        }]
      };
    }
    return options.gameplaySessionService.validateSession({
      sessionId: tokenPayload?.sessionId ?? sessionTokenOrId,
      serverInstanceId,
      nowIso
    });
  }
};
const isServerAssignedFocusDistrictId = (districtId: string): districtId is ServerAssignedFocusDistrictId =>
  districtId === SERVER_ASSIGNED_FOCUS_DISTRICT_ID;
const createGameplaySliceResponseMetadata = (runtime: ServerInstanceRuntime): GameplaySliceResponse["metadata"] => ({
  serverTick: runtime.state.root.tick,
  stateVersion: runtime.state.root.version
});
const createNotFoundResponse = (message: string): GameplaySliceResponse => ({
  accepted: false, readModel: null, errors: [{ code: "transport.not_found", message }]
});
