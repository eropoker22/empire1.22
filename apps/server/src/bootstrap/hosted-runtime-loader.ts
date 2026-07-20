import type { DomainError, ServerInstanceId } from "@empire/shared-types";
import type { HostedControlPlaneRepository, HostedServerRecord } from "../admin/hosted";
import type { ServerApp } from "../app";
import type { ServerInstanceRuntime } from "../runtime/instance";
import type { InstanceSnapshotDto } from "../runtime/persistence/dto";
import { restoreRuntimeFromSnapshot } from "../runtime/persistence/services";
import type { ServerMapComposition } from "./gameplay-slice-shared-city-seed";

export type HostedRuntimeLoadResult =
  | { accepted: true; runtime: ServerInstanceRuntime; errors: [] }
  | { accepted: false; runtime: null; errors: DomainError[] };

export interface HostedRuntimeLoader {
  load(serverInstanceId: ServerInstanceId, options?: { requireRunning?: boolean }): Promise<HostedRuntimeLoadResult>;
}

const LOADABLE_STATUSES = new Set(["lobby", "running", "paused"]);

export const createHostedRuntimeLoader = (options: {
  server: ServerApp;
  controlPlane: Pick<HostedControlPlaneRepository, "getServer">;
}): HostedRuntimeLoader => {
  const pendingLoads = new Map<string, Promise<HostedRuntimeLoadResult>>();

  return {
    load: (serverInstanceId, loadOptions = {}) => {
      const loadKey = `${serverInstanceId}:${loadOptions.requireRunning === true ? "running" : "read"}`;
      const pending = pendingLoads.get(loadKey);
      if (pending) return pending;
      const load = loadHostedRuntime(options, serverInstanceId, loadOptions.requireRunning === true).finally(() => {
        if (pendingLoads.get(loadKey) === load) pendingLoads.delete(loadKey);
      });
      pendingLoads.set(loadKey, load);
      return load;
    }
  };
};

const loadHostedRuntime = async (
  options: { server: ServerApp; controlPlane: Pick<HostedControlPlaneRepository, "getServer"> },
  serverInstanceId: ServerInstanceId,
  requireRunning: boolean
): Promise<HostedRuntimeLoadResult> => {
  try {
    const record = await options.controlPlane.getServer(serverInstanceId);
    const recordError = validateHostedRecord(record, serverInstanceId, requireRunning);
    if (recordError) return rejected(recordError);

    const snapshot = await options.server.instanceManager.getPersistenceRepositories()
      .snapshotRepository.loadLatest(serverInstanceId);
    const snapshotError = validateSnapshot(snapshot, record!);
    if (snapshotError) return rejected(snapshotError);

    let runtime = options.server.instanceManager.getInstanceById(serverInstanceId);
    const mustRestore = !runtime;
    if (!runtime) {
      const created = options.server.serverInstanceCreationService.createGameServerInstanceResult({
        serverInstanceId,
        mode: record!.mode,
        displayName: record!.displayName,
        region: record!.region,
        capacity: record!.capacity,
        mapComposition: record!.mapComposition as ServerMapComposition,
        joinPolicy: record!.joinPolicy === "open" ? "open" : "closed",
        worldSeed: record!.worldSeed
      });
      if (!created.accepted) return rejected({
        code: "server.runtime_restore_failed",
        message: "Hosted server runtime could not be created."
      });
      runtime = created.runtime;
    }

    const snapshotIsNewer = snapshot!.integrity.rootVersion > runtime.state.root.version;
    const appliedSnapshot = mustRestore || snapshotIsNewer ? snapshot! : null;
    if (appliedSnapshot) restoreRuntimeFromSnapshot(runtime, appliedSnapshot);
    syncRuntimeMetadata(runtime, record!, appliedSnapshot);
    return { accepted: true, runtime, errors: [] };
  } catch (_error) {
    return rejected({
      code: "server.runtime_authority_unavailable",
      message: "Hosted server authority is temporarily unavailable."
    });
  }
};

const validateHostedRecord = (
  record: HostedServerRecord | null,
  serverInstanceId: string,
  requireRunning: boolean
): DomainError | null => {
  if (!record) return {
    code: "server.instance_not_found",
    message: "Hosted server instance was not found.",
    details: { serverInstanceId }
  };
  if (record.provisioningState !== "ready" || !LOADABLE_STATUSES.has(record.status)) return {
    code: "server.instance_not_ready",
    message: "Hosted server instance is not ready.",
    details: { serverInstanceId }
  };
  if (requireRunning && record.status !== "running") return {
    code: "server.instance_not_running",
    message: "Gameplay commands require a running hosted server.",
    details: { serverInstanceId, status: record.status }
  };
  return null;
};

const validateSnapshot = (
  snapshot: InstanceSnapshotDto | null,
  record: HostedServerRecord
): DomainError | null => {
  if (!snapshot) return {
    code: "server.snapshot_not_found",
    message: "Hosted server snapshot is not available."
  };
  if (snapshot.instanceId !== record.serverInstanceId
    || snapshot.mode !== record.mode
    || snapshot.state.root.serverInstanceId !== record.serverInstanceId
    || snapshot.state.serverInstance.id !== record.serverInstanceId
    || snapshot.state.serverInstance.worldSeed !== record.worldSeed) return {
    code: "server.snapshot_invalid",
    message: "Hosted server snapshot does not match its durable server record."
  };
  return null;
};

const syncRuntimeMetadata = (
  runtime: ServerInstanceRuntime,
  record: HostedServerRecord,
  appliedSnapshot: InstanceSnapshotDto | null
): void => {
  runtime.record.status = record.status === "running" ? "running" : record.status === "paused" ? "paused" : "lobby";
  if (appliedSnapshot) {
    runtime.record.createdAt = appliedSnapshot.metadata.createdAt;
    runtime.record.crashCount = appliedSnapshot.metadata.crashCount;
    runtime.record.version = appliedSnapshot.metadata.version;
  }
  runtime.record.startedAt = record.lastStartedAt ?? appliedSnapshot?.metadata.startedAt ?? runtime.record.startedAt;
  runtime.record.stoppedAt = record.lastStoppedAt ?? appliedSnapshot?.metadata.stoppedAt ?? runtime.record.stoppedAt;
  runtime.lobby.displayName = record.displayName;
  runtime.lobby.region = record.region;
  runtime.lobby.maxPlayers = record.capacity;
  runtime.lobby.joinPolicy = record.joinPolicy === "open" ? "open" : "closed";
  runtime.scheduler.isRunning = record.status === "running";
};

const rejected = (error: DomainError): HostedRuntimeLoadResult => ({
  accepted: false,
  runtime: null,
  errors: [error]
});
