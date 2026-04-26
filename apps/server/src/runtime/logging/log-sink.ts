import type { StructuredLogEntry } from "./structured-log";

/**
 * Responsibility: Output boundary for server log entries.
 * Belongs here: sink interface for console, files, or external log collectors.
 * Does not belong here: gameplay code or lifecycle orchestration.
 */
export interface LogSink {
  write(entry: StructuredLogEntry): void;
}

export const createNullLogSink = (): LogSink => ({
  write: (_entry) => {
    return;
  }
});

