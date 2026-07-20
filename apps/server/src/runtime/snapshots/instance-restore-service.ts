import type { ServerInstanceId } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance";
import type { InstanceSnapshotController } from "./instance-snapshot-controller";

/**
 * Responsibility: Restores authoritative state from snapshots without replacing a warm runtime when none exists.
 * Belongs here: restore delegation for instance boot and restart.
 * Does not belong here: registry orchestration or scheduler control.
 */
export const restoreOrCreateInitialState = async (
  snapshotController: InstanceSnapshotController,
  instanceId: ServerInstanceId,
  runtime: ServerInstanceRuntime
): Promise<ServerInstanceRuntime> => snapshotController.restore(instanceId, runtime);
