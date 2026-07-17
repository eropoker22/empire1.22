import type {
  GameplayCommandResultLookupResponse,
  LookupGameplayCommandResultRequest
} from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../runtime/instance/server-instance-runtime";
import { createGameplaySliceProjection } from "../runtime/projections";

export const lookupGameplayCommandResult = async (
  runtime: ServerInstanceRuntime,
  playerId: string,
  request: LookupGameplayCommandResultRequest
): Promise<GameplayCommandResultLookupResponse> => {
  const commandId = String(request.commandId ?? "").trim();
  const readModel = createGameplaySliceProjection(runtime, playerId, request.districtId);
  const metadata = { serverTick: runtime.state.root.tick, stateVersion: runtime.state.root.version };
  if (!commandId) {
    return {
      accepted: false,
      status: "not_found",
      readModel,
      errors: [{ code: "transport.invalid_request", message: "Gameplay command result lookup requires commandId." }],
      metadata
    };
  }
  const stored = await runtime.commandResultRepository?.getByCommandId(runtime.record.id, commandId);
  if (stored) {
    if (stored.playerId !== playerId) {
      return {
        accepted: false,
        status: "not_found",
        readModel,
        errors: [{ code: "transport.command_result_not_found", message: "Gameplay command result was not found." }],
        metadata
      };
    }
    return {
      accepted: stored.status === "applied",
      status: stored.status,
      readModel,
      errors: stored.responseErrors,
      metadata,
      commandResult: {
        commandId: stored.commandId,
        status: stored.status,
        rootVersionBefore: stored.rootVersionBefore,
        rootVersionAfter: stored.rootVersionAfter,
        eventCount: stored.eventCount,
        eventIds: stored.eventIds,
        snapshotId: stored.snapshotId
      }
    };
  }
  const reservation = await runtime.commandReservationRepository?.getByCommandId(runtime.record.id, commandId);
  if (reservation?.playerId === playerId) {
    return { accepted: false, status: "processing", readModel, errors: [], metadata };
  }
  return { accepted: false, status: "not_found", readModel, errors: [], metadata };
};
