/**
 * Responsibility: Runtime-only health bookkeeping for one instance.
 * Belongs here: last error timestamp and rolling runtime diagnostics.
 * Does not belong here: persistent game truth or client-visible projections.
 */
export interface InstanceRuntimeHealth {
  lastErrorAt: string | null;
  lastTickStartedAt: string | null;
  lastTickCompletedAt: string | null;
}

