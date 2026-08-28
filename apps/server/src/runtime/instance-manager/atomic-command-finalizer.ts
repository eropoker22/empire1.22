import type { CoreGameState } from "@empire/game-core";
import type { GameCommand, InstanceRuntimeEvent } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { writeCommandRejectionDiagnostic, writeDiagnosticLog } from "../logging";
import type { CommandDispatchOptions, InstanceCommandDispatchResult } from "../orchestration";
import { publishOutbox } from "./atomic-command-outbox";

export type AtomicCommandCrashPoint = "afterReserve" | "afterCommandLog" | "afterApplyBeforeSnapshot" |
  "afterSnapshotBeforeMarkApplied" | "afterMarkAppliedBeforeCommit" | "afterCommitBeforePublish" |
  "duringOutboxPublish";

export interface BoundaryDispatchResult {
  errors: InstanceCommandDispatchResult["errors"];
  commandResult: InstanceCommandDispatchResult["commandResult"];
  nextState: CoreGameState | null;
  appliedEvent: InstanceRuntimeEvent | null;
  commandRateLimitWindow: ServerInstanceRuntime["commandRateLimitWindow"] | null;
}

export const finalizeCommittedCommand = async (
  runtime: ServerInstanceRuntime,
  command: GameCommand,
  options: CommandDispatchOptions,
  committed: BoundaryDispatchResult,
  crash: ((point: AtomicCommandCrashPoint) => void | Promise<void>) | undefined
): Promise<InstanceCommandDispatchResult> => {
  if (!committed.nextState || !committed.appliedEvent) {
    if (committed.errors.length > 0) {
      await writeCommandRejectionDiagnostic({
        runtime,
        command,
        errors: committed.errors,
        category: "command_rejected",
        message: "Command rejected.",
        expectedStateVersion: options.expectedStateVersion
      }).catch(() => undefined);
    }
    return { runtime, errors: committed.errors, commandResult: committed.commandResult };
  }
  await writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "command", "Command dispatched.", {
    commandId: command.id,
    commandType: command.type
  }, runtime.clock).catch(() => undefined);
  runtime.processedCommandIds.add(command.id);
  if (committed.commandRateLimitWindow) runtime.commandRateLimitWindow = committed.commandRateLimitWindow;
  runtime.state = committed.nextState;
  runtime.eventQueue.enqueue(committed.appliedEvent);
  await crash?.("afterCommitBeforePublish");
  await publishOutbox(runtime, crash);
  return { runtime, errors: committed.errors, commandResult: committed.commandResult };
};
