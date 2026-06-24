import type { CommandResultRecord } from "../persistence";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { createRecoveredRejectedCommandResult } from "./atomic-command-records";

export const recoverPendingCommandReservations = async (
  runtime: ServerInstanceRuntime,
  options: {
    olderThanIso?: string;
  } = {}
): Promise<CommandResultRecord[]> => {
  const reservations = await runtime.commandReservationRepository?.listPendingByInstance?.(runtime.record.id) ?? [];
  const recovered: CommandResultRecord[] = [];
  for (const reservation of reservations) {
    if (options.olderThanIso && reservation.reservedAt >= options.olderThanIso) {
      continue;
    }

    const storedResult = await runtime.commandResultRepository?.getByCommandId(runtime.record.id, reservation.commandId);
    if (storedResult) {
      if (storedResult.status === "applied") {
        await runtime.commandReservationRepository?.markApplied(runtime.record.id, reservation.commandId, {
          updatedAt: storedResult.appliedAt ?? runtime.clock.nowIso(),
          rootVersion: storedResult.rootVersionAfter,
          eventCount: storedResult.eventCount,
          eventIds: storedResult.eventIds,
          snapshotId: storedResult.snapshotId,
          recoveredReason: "server.command_recovered_applied"
        });
      } else {
        await runtime.commandReservationRepository?.markRejected(
          runtime.record.id,
          reservation.commandId,
          storedResult.responseErrors
        );
      }
      recovered.push(storedResult);
      continue;
    }

    const errors = [{
      code: "server.command_abandoned_after_crash",
      message: "Pending command was abandoned during crash recovery.",
      details: {
        commandId: reservation.commandId,
        reservedAt: reservation.reservedAt,
        updatedAt: runtime.clock.nowIso()
      }
    }];
    const abandoned = createRecoveredRejectedCommandResult(runtime, reservation, errors);
    await runtime.commandResultRepository?.save(abandoned);
    await runtime.commandReservationRepository?.markRejected(runtime.record.id, reservation.commandId, errors);
    recovered.push(abandoned);
  }
  return recovered;
};

