import type { ServerInstanceId } from "@empire/shared-types";

/**
 * Responsibility: Persistent diagnostic record for operational and crash-level visibility.
 * Belongs here: structured server/runtime diagnostics separate from command and event history.
 * Does not belong here: gameplay state or player-facing notifications.
 */
export interface DiagnosticRecord {
  id: string;
  instanceId: ServerInstanceId;
  level: "info" | "warn" | "error";
  category: "lifecycle" | "tick" | "command" | "snapshot" | "crash" | "transport";
  message: string;
  occurredAt: string;
  context: Record<string, unknown>;
}

