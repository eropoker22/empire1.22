import type { ReplayLogWriter } from "../persistence/services/replay-log-writer";
import { systemClock, type Clock } from "../scheduling/clock";

/**
 * Responsibility: Writes operational diagnostics into the separated diagnostic log stream.
 * Belongs here: bridge from runtime logging to diagnostic persistence.
 * Does not belong here: gameplay event persistence or UI notifications.
 */
export const writeDiagnosticLog = (
  replayLogWriter: ReplayLogWriter,
  instanceId: string,
  level: "info" | "warn" | "error",
  category:
    | "lifecycle"
    | "tick"
    | "command"
    | "command_rejected"
    | "snapshot"
    | "crash"
    | "transport"
    | "transport_rejected",
  message: string,
  context: Record<string, unknown> = {},
  clock: Clock = systemClock
): Promise<void> =>
  replayLogWriter.writeDiagnostic({
    id: `diag:${instanceId}:${level}:${category}:${clock.now().getTime()}`,
    instanceId,
    level,
    category,
    message,
    occurredAt: clock.nowIso(),
    context
  });
