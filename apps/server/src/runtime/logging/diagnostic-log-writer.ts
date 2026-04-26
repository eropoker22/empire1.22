import type { ReplayLogWriter } from "../persistence/services/replay-log-writer";

/**
 * Responsibility: Writes operational diagnostics into the separated diagnostic log stream.
 * Belongs here: bridge from runtime logging to diagnostic persistence.
 * Does not belong here: gameplay event persistence or UI notifications.
 */
export const writeDiagnosticLog = (
  replayLogWriter: ReplayLogWriter,
  instanceId: string,
  level: "info" | "warn" | "error",
  category: "lifecycle" | "tick" | "command" | "snapshot" | "crash" | "transport",
  message: string,
  context: Record<string, unknown> = {}
): Promise<void> =>
  replayLogWriter.writeDiagnostic({
    id: `diag:${instanceId}:${level}:${category}:${Date.now()}`,
    instanceId,
    level,
    category,
    message,
    occurredAt: new Date(0).toISOString(),
    context
  });
