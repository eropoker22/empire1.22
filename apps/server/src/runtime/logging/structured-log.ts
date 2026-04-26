/**
 * Responsibility: Canonical structured log entry shape for server diagnostics.
 * Belongs here: normalized fields used by instance and app-level loggers.
 * Does not belong here: output sinks or transport concerns.
 */
export interface StructuredLogEntry {
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
  instanceId?: string;
  context?: Record<string, unknown>;
}

