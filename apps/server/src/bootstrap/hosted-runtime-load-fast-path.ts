import type { DomainError, ServerInstanceId } from "@empire/shared-types";
import type { HostedServerRecord } from "../admin/hosted";
import type { ServerInstanceRuntime } from "../runtime/instance";
import type { SnapshotRepository } from "../runtime/persistence";

export type HostedRuntimeLoadResult =
  | { accepted: true; runtime: ServerInstanceRuntime; unchanged: false; errors: [] }
  | {
      accepted: true;
      runtime: null;
      unchanged: true;
      metadata: { stateVersion: number; serverTick: number };
      errors: [];
    }
  | { accepted: false; runtime: null; errors: DomainError[] };

export interface HostedRuntimeLoadOptions {
  requireRunning?: boolean;
  knownStateVersion?: number | null;
  allowUnhydratedUnchanged?: boolean;
}

export interface HostedRuntimeLoader {
  load(serverInstanceId: ServerInstanceId, options?: HostedRuntimeLoadOptions): Promise<HostedRuntimeLoadResult>;
}

export const loadHostedRuntimeFastPath = async (input: {
  snapshotRepository: SnapshotRepository;
  getRuntime(): ServerInstanceRuntime | null;
  syncRuntime(runtime: ServerInstanceRuntime): void;
  record: HostedServerRecord;
  loadOptions: HostedRuntimeLoadOptions;
}): Promise<HostedRuntimeLoadResult | null> => {
  const metadata = await input.snapshotRepository.loadRecoveryMetadata(input.record.serverInstanceId);
  if (!metadata) {
    return { accepted: false, runtime: null, errors: [{
      code: "server.snapshot_not_found",
      message: "Hosted server snapshot is not available."
    }] };
  }
  const pointerMatches = !input.record.currentSnapshotId
    || input.record.currentSnapshotId === metadata.snapshotId;
  if (input.loadOptions.allowUnhydratedUnchanged === true
    && Number.isSafeInteger(input.loadOptions.knownStateVersion)
    && input.loadOptions.knownStateVersion === metadata.rootVersion
    && pointerMatches) {
    return { accepted: true, runtime: null, unchanged: true,
      metadata: { stateVersion: metadata.rootVersion, serverTick: metadata.tick }, errors: [] };
  }
  const runtime = input.getRuntime();
  if (runtime && runtime.state.root.version === metadata.rootVersion
    && runtime.state.root.tick === metadata.tick && pointerMatches) {
    input.syncRuntime(runtime);
    return { accepted: true, runtime, unchanged: false, errors: [] };
  }
  return null;
};
