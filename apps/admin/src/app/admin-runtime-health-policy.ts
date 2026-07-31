import type { AdminOverviewView } from "@empire/shared-types";

const RUNTIME_REQUIRED_STATUSES = new Set(["running", "restarting"]);

export const requiresAdminInstanceRuntime = (status: string): boolean =>
  RUNTIME_REQUIRED_STATUSES.has(String(status || "unknown").trim().toLowerCase());

export const resolveRuntimeWorkerCounts = (
  overview: AdminOverviewView
): AdminOverviewView["runtimeWorkers"] => {
  if (overview.runtimeWorkers) return overview.runtimeWorkers;
  const instances = overview.instances.filter((entry) => requiresAdminInstanceRuntime(entry.status));
  return {
    expected: instances.length,
    live: instances.filter((entry) => entry.workerStatus === "live").length,
    stale: instances.filter((entry) => entry.workerStatus === "stale").length,
    offline: instances.filter((entry) => entry.workerStatus === "offline").length,
    noWorker: instances.filter((entry) => entry.workerStatus === "no-worker").length
  };
};
