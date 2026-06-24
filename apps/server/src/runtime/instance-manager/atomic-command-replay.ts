import type { GameCommand } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import type { InstanceCommandDispatchResult } from "../orchestration";
import type { CommandReservationRecord } from "../persistence/repositories";
import {
  createPayloadConflictError,
  createPendingCommandError,
  createRecoveredMissingResultError
} from "./atomic-command-records";

export const replayReservedCommand = async (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  reservation: CommandReservationRecord,
  incomingPayloadHash: string,
  commandResultRepository: NonNullable<ServerInstanceRuntime["commandResultRepository"]>
): Promise<InstanceCommandDispatchResult> => {
  if (reservation.payloadHash !== incomingPayloadHash) {
    return { runtime, errors: [createPayloadConflictError(reservation.commandId)], commandResult: null };
  }

  const storedResult = await commandResultRepository.getByCommandId(runtime.record.id, command.id);
  if (storedResult) {
    return { runtime, errors: storedResult.responseErrors, commandResult: storedResult };
  }

  if (reservation.status === "pending") {
    return { runtime, errors: [createPendingCommandError(reservation)], commandResult: null };
  }

  if (reservation.status === "rejected") {
    return {
      runtime,
      errors: reservation.rejectionErrors?.length
        ? reservation.rejectionErrors
        : [createRecoveredMissingResultError(command.id)],
      commandResult: null
    };
  }

  return { runtime, errors: [createRecoveredMissingResultError(command.id)], commandResult: null };
};

