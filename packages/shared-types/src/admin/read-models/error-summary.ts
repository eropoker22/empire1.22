/**
 * Responsibility: Summarizes operational error counts for one instance.
 * Belongs here: aggregated counts and last error timestamp for dashboards.
 * Does not belong here: raw stack traces or diagnostic payloads.
 */
export interface ErrorSummary {
  instanceId: string;
  errorCount: number;
  lastErrorAt: string | null;
}

