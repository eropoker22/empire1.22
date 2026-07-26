import type { ServerInstanceId } from "@empire/shared-types";
import type { ServerApp } from "../../app/server-app";
import type { ServerInstanceRuntime } from "../../runtime/instance";
import {
  createInstanceSnapshot,
  createLifecycleCheckpoint
} from "../../runtime/persistence";
import type { HostedActionRequestRecord } from "./hosted-control-plane-repository";

const DURABLE_LIFECYCLE_ACTIONS = new Set<HostedActionRequestRecord["action"]>([
  "start",
  "pause",
  "resume",
  "restart",
  "stop"
]);

export const runHostedSnapshotMaintenance = (
  server: ServerApp,
  nowIso: string
): Promise<unknown> => server.instanceManager.getPersistenceRepositories()
  .snapshotMaintenance?.runIfDue(nowIso) ?? Promise.resolve();

export const saveHostedProvisioningCheckpoint = (
  server: ServerApp,
  instanceId: ServerInstanceId
): Promise<unknown> => server.instanceManager.saveInstanceCheckpoint(
  instanceId,
  "instance-provisioned",
  { protected: true }
);

export const saveHostedLifecycleCheckpoint = (
  server: ServerApp,
  instanceId: ServerInstanceId,
  action: HostedActionRequestRecord["action"]
): Promise<unknown> => {
  if (!DURABLE_LIFECYCLE_ACTIONS.has(action)) return Promise.resolve();
  return server.instanceManager.saveInstanceCheckpoint(
    instanceId,
    lifecycleCheckpointReason(action),
    {
      protected: action === "start",
      terminal: action === "stop"
    }
  );
};

export const createHostedProvisioningSnapshotWrite = (
  runtime: ServerInstanceRuntime
) => {
  const snapshot = createInstanceSnapshot(runtime);
  return {
    snapshot,
    checkpoint: createLifecycleCheckpoint(snapshot, "instance-provisioned", {
      protected: true
    })
  };
};

export const createHostedLifecycleSnapshotWrite = (
  runtime: ServerInstanceRuntime,
  action: HostedActionRequestRecord["action"]
) => {
  if (!DURABLE_LIFECYCLE_ACTIONS.has(action)) return null;
  const snapshot = createInstanceSnapshot(runtime);
  return {
    snapshot,
    checkpoint: createLifecycleCheckpoint(snapshot, lifecycleCheckpointReason(action), {
      protected: action === "start",
      terminal: action === "stop"
    })
  };
};

export const isHostedLifecycleSnapshotAction = (
  action: HostedActionRequestRecord["action"]
): boolean => DURABLE_LIFECYCLE_ACTIONS.has(action);

const lifecycleCheckpointReason = (
  action: HostedActionRequestRecord["action"]
): string => {
  if (action === "start") return "instance-started";
  if (action === "pause") return "instance-paused";
  if (action === "resume") return "instance-resumed";
  if (action === "restart") return "instance-restarted";
  if (action === "stop") return "instance-stopped";
  return `instance-${action}`;
};
