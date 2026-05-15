import type { GameModeId, ServerInstanceId } from "@empire/shared-types";
import type { ServerInstanceManager } from "../runtime";
import { createPersistenceRestoreService, type SnapshotTokenCodec } from "../runtime/persistence/services";
import type { InstanceSnapshotDto } from "../runtime/persistence/dto";

export interface EnsureGameplaySliceSessionOptions {
  snapshotToken?: string | null;
  snapshotTokenCodec?: SnapshotTokenCodec;
}

interface GameplaySliceSnapshotRestoreRequest {
  serverInstanceId: ServerInstanceId;
  fallbackMode: GameModeId;
}

/**
 * Responsibility: Restores the temporary gameplay slice runtime from an opaque
 * snapshot token when serverless does not have a warm process-local instance.
 * Belongs here: snapshot token validation and restore workflow wiring.
 * Does not belong here: seed generation or HTTP parsing.
 */
export const restoreGameplaySliceSessionFromSnapshot = async (
  instanceManager: ServerInstanceManager,
  request: GameplaySliceSnapshotRestoreRequest,
  options: EnsureGameplaySliceSessionOptions
): Promise<boolean> => {
  const snapshot = await openGameplaySliceSnapshot(request.serverInstanceId, options);

  if (!snapshot) {
    return false;
  }

  const existingRuntime = instanceManager.getInstanceById(request.serverInstanceId);

  if (existingRuntime) {
    return false;
  }

  const mode = normalizeMode(snapshot.mode) ?? request.fallbackMode;
  const runtime = instanceManager.createInstance(request.serverInstanceId, mode);

  await createPersistenceRestoreService({
    save: async () => undefined,
    loadLatest: async () => snapshot
  }).restore(runtime);

  instanceManager.startInstance(request.serverInstanceId);
  return true;
};

const openGameplaySliceSnapshot = async (
  serverInstanceId: ServerInstanceId,
  options: EnsureGameplaySliceSessionOptions
): Promise<InstanceSnapshotDto | null> => {
  const token = String(options.snapshotToken ?? "").trim();
  const snapshot = token && options.snapshotTokenCodec
    ? await options.snapshotTokenCodec.open(token)
    : null;

  return snapshot?.instanceId === serverInstanceId ? snapshot : null;
};

const normalizeMode = (mode: string): GameModeId | null =>
  mode === "free" || mode === "war" ? mode : null;
