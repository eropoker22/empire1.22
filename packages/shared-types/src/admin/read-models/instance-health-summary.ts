/**
 * Responsibility: Admin-safe health summary describing the current health posture of one instance.
 * Belongs here: stale/degraded health indicators and high-level status flags.
 * Does not belong here: transport internals or raw scheduler handles.
 */
export interface InstanceHealthSummary {
  instanceId: string;
  status: "healthy" | "degraded" | "unhealthy";
  warnings: string[];
  lastErrorAt: string | null;
}

