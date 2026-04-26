import type { ServerInstanceId } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance";
import type { InstanceSnapshotController } from "./instance-snapshot-controller";

/**
 * Responsibility: Restores authoritative state from snapshots or creates a clean initial state.
 * Belongs here: restore fallback logic for instance boot and restart.
 * Does not belong here: registry orchestration or scheduler control.
 */
export const restoreOrCreateInitialState = async (
  snapshotController: InstanceSnapshotController,
  instanceId: ServerInstanceId,
  runtime: ServerInstanceRuntime
): Promise<ServerInstanceRuntime> => snapshotController.restore(instanceId, runtime);
