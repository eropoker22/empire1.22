import { createInitialState } from "@empire/game-core";
import type {
  DomainError,
  GameCommand,
  GameModeId,
  LoadGameplaySliceRequest,
  PlayerFactionId,
  ServerInstanceId,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import type { ServerInstanceManager } from "../runtime";
import type { ServerInstanceRuntime } from "../runtime/instance/server-instance-runtime";
import { inferModeFromInstanceId } from "./gameplay-slice-bootstrap-format";
import { ensureGameplaySliceMembershipInState } from "./gameplay-slice-session-membership";
import {
  restoreGameplaySliceSessionFromSnapshot,
  type EnsureGameplaySliceSessionOptions
} from "./gameplay-slice-snapshot-restore";

export interface GameplaySliceSessionRequest {
  serverInstanceId: ServerInstanceId;
  playerId: string;
  districtId: string;
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
  options: EnsureGameplaySliceSessionOptions = {}
): Promise<boolean> => {
  const result = await ensureGameplaySliceSessionResult(instanceManager, request, options);
  return result.accepted;
};

export const ensureGameplaySliceSessionResult = async (
  instanceManager: ServerInstanceManager,
  request: LoadGameplaySliceRequest | SubmitGameplayCommandRequest,
  options: EnsureGameplaySliceSessionOptions = {}
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
    return createEnsureFailure("transport.not_found", "Gameplay slice session was not found.");
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
    playerId: request.playerId,
    districtId: request.districtId,
    factionId: request.factionId
  };
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
