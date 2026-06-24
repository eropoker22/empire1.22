import { createInitialState } from "@empire/game-core";
import {
  SERVER_ASSIGNED_FOCUS_DISTRICT_ID,
  type DomainError,
  type GameCommand,
  type GameModeId,
  type LoadGameplaySliceRequest,
  type PlayerFactionId,
  type ServerInstanceId,
  type SubmitGameplayCommandRequest
} from "@empire/shared-types";
import type { ServerInstanceManager } from "../runtime";
import type { ServerInstanceRuntime } from "../runtime/instance/server-instance-runtime";
import {
  syncRuntimeCapacityStatus,
  validateRuntimeJoinability
} from "../runtime/instance-manager/server-instance-joinability";
import { inferModeFromInstanceId } from "./gameplay-slice-bootstrap-format";
import { ensureGameplaySliceMembershipInState } from "./gameplay-slice-session-membership";
import {
  restoreGameplaySliceSessionFromSnapshot,
  type EnsureGameplaySliceSessionOptions
} from "./gameplay-slice-snapshot-restore";

export interface EnsureGameplaySliceBootstrapOptions extends EnsureGameplaySliceSessionOptions {
  allowImplicitInstanceCreation?: boolean;
}

export interface GameplaySliceSessionRequest {
  serverInstanceId: ServerInstanceId;
  playerId: string;
  districtId?: string | null;
  factionId?: PlayerFactionId | string | null;
  mode?: GameModeId;
}

export interface GameplaySliceSessionEnsureResult {
  accepted: boolean;
  createdInstance: boolean;
  joinedPlayer: boolean;
  errors: DomainError[];
}

export const ensureGameplaySliceSession = async (
  instanceManager: ServerInstanceManager,
  request: LoadGameplaySliceRequest | SubmitGameplayCommandRequest,
  options: EnsureGameplaySliceBootstrapOptions = {}
): Promise<boolean> => {
  const result = await ensureGameplaySliceSessionResult(instanceManager, request, options);
  return result.accepted;
};

export const ensureGameplaySliceSessionResult = async (
  instanceManager: ServerInstanceManager,
  request: LoadGameplaySliceRequest | SubmitGameplayCommandRequest,
  options: EnsureGameplaySliceBootstrapOptions = {}
): Promise<GameplaySliceSessionEnsureResult> => {
  const sessionRequest = normalizeSessionRequest(request);
  const existingRuntime = instanceManager.getInstanceById(sessionRequest.serverInstanceId);

  if (existingRuntime) {
    return ensureRuntimeMembership(existingRuntime, request, sessionRequest);
  }

  const mode = sessionRequest.mode ?? inferModeFromInstanceId(sessionRequest.serverInstanceId);
  const restored = await restoreGameplaySliceSessionFromSnapshot(
    instanceManager,
    {
      serverInstanceId: sessionRequest.serverInstanceId,
      fallbackMode: mode
    },
    options
  );

  if (restored) {
    const restoredRuntime = instanceManager.getInstanceById(sessionRequest.serverInstanceId);
    return restoredRuntime
      ? ensureRuntimeMembership(restoredRuntime, request, sessionRequest)
      : createEnsureFailure("transport.not_found", "Gameplay slice snapshot could not restore a server runtime.");
  }

  if ("command" in request) {
    return createEnsureFailure("server.instance_not_found", "Gameplay slice session was not found.");
  }

  if (options.allowImplicitInstanceCreation === false) {
    return createEnsureFailure("server.instance_not_found", "Gameplay slice server instance was not found.");
  }

  const runtime = instanceManager.createInstance(sessionRequest.serverInstanceId, mode);
  runtime.state = createGameplaySliceSessionState({
    ...sessionRequest,
    mode
  });
  instanceManager.startInstance(sessionRequest.serverInstanceId);

  return {
    accepted: true,
    createdInstance: true,
    joinedPlayer: true,
    errors: []
  };
};

const normalizeSessionRequest = (
  request: LoadGameplaySliceRequest | SubmitGameplayCommandRequest
): GameplaySliceSessionRequest => {
  if ("command" in request) {
    const command = request.command as GameCommand;

    return {
      serverInstanceId: command.serverInstanceId,
      playerId: command.playerId,
      districtId: request.focusDistrictId,
      factionId: null,
      mode: command.mode
    };
  }

  return {
    serverInstanceId: request.serverInstanceId,
    playerId: request.playerId ?? "",
    districtId: normalizeLoadFocusDistrictId(request.districtId),
    factionId: request.factionId
  };
};

const normalizeLoadFocusDistrictId = (
  districtId: LoadGameplaySliceRequest["districtId"]
): string | null => {
  if (!districtId || districtId === SERVER_ASSIGNED_FOCUS_DISTRICT_ID) {
    return null;
  }

  return districtId;
};

const ensureRuntimeMembership = (
  runtime: ServerInstanceRuntime,
  request: LoadGameplaySliceRequest | SubmitGameplayCommandRequest,
  sessionRequest: GameplaySliceSessionRequest
): GameplaySliceSessionEnsureResult => {
  if ("command" in request) {
    return {
      accepted: true,
      createdInstance: false,
      joinedPlayer: false,
      errors: []
    };
  }

  const joinabilityErrors = validateRuntimeJoinability(runtime, sessionRequest.playerId);
  if (joinabilityErrors.length > 0) {
    return {
      accepted: false,
      createdInstance: false,
      joinedPlayer: false,
      errors: joinabilityErrors
    };
  }

  const result = ensureGameplaySliceMembershipInState(runtime.state, {
    ...sessionRequest,
    mode: runtime.record.mode
  });

  if (!result.accepted) {
    return {
      accepted: false,
      createdInstance: false,
      joinedPlayer: false,
      errors: result.errors
    };
  }

  runtime.state = result.state;
  syncRuntimeCapacityStatus(runtime);
  return {
    accepted: true,
    createdInstance: false,
    joinedPlayer: result.joinedPlayer,
    errors: []
  };
};

const createGameplaySliceSessionState = (request: GameplaySliceSessionRequest & { mode: GameModeId }) => {
  const state = createInitialState(request.serverInstanceId, request.mode);
  const result = ensureGameplaySliceMembershipInState(state, request);
  return result.state;
};

const createEnsureFailure = (
  code: string,
  message: string
): GameplaySliceSessionEnsureResult => ({
  accepted: false,
  createdInstance: false,
  joinedPlayer: false,
  errors: [
    {
      code,
      message
    }
  ]
});
