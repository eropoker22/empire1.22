import type { ServerApp } from "../../app/server-app";
import type { PostgresPlayerEntryRepository } from "../../player-entry/postgres-player-entry-repository";
import type { ServerInstanceRuntime } from "../../runtime/instance";
import type { HostedControlPlaneRepository, HostedServerRecord } from "./hosted-control-plane-repository";
import type { createHostedRuntimeLeaseClient } from "./hosted-runtime-lease-client";
import type { HostedRuntimeMutationCommitter } from "./postgres-hosted-runtime-mutation-committer";

export const HOSTED_JOB_CLAIM_TTL_MS = 30_000;
export const HOSTED_RUNTIME_LEASE_MS = 20_000;

export interface HostedRuntimePlayerMutationOptions {
  workerId: string;
  controlPlane: HostedControlPlaneRepository;
  server: ServerApp;
  playerEntry?: PostgresPlayerEntryRepository;
  runtimeMutationCommitter?: HostedRuntimeMutationCommitter;
  now: () => Date;
  lease: ReturnType<typeof createHostedRuntimeLeaseClient>;
  ensureRuntime(record: HostedServerRecord, restoreLatest?: boolean): Promise<ServerInstanceRuntime>;
}

export interface HostedRuntimeMutationStage {
  runtime: ServerInstanceRuntime;
  persist(): Promise<void>;
  publish(): Promise<void>;
  restore(): Promise<void>;
}

export const createHostedRuntimeMutationStage = (
  liveRuntime: ServerInstanceRuntime
): HostedRuntimeMutationStage => {
  const deferredSideEffects: Array<() => void | Promise<void>> = [];
  const stagedEventPublisher = {
    publish: (event: Parameters<ServerInstanceRuntime["eventPublisher"]["publish"]>[0]) => {
      deferredSideEffects.push(() => liveRuntime.eventPublisher.publish(event));
    }
  };
  const stagedReplayLogWriter: ServerInstanceRuntime["replayLogWriter"] = {
    writeCommand: async (record) => {
      deferredSideEffects.push(() => liveRuntime.replayLogWriter.writeCommand(record));
    },
    writeEvent: async (record) => {
      deferredSideEffects.push(() => liveRuntime.replayLogWriter.writeEvent(record));
    },
    writeDiagnostic: async (record) => {
      deferredSideEffects.push(() => liveRuntime.replayLogWriter.writeDiagnostic(record));
    }
  };
  const stagedSnapshotController: ServerInstanceRuntime["snapshotController"] = {
    save: async () => undefined,
    restore: (instanceId, runtime) => liveRuntime.snapshotController.restore(instanceId, runtime)
  };
  const stagedRuntime: ServerInstanceRuntime = {
    ...liveRuntime,
    record: { ...liveRuntime.record },
    lobby: { ...liveRuntime.lobby },
    state: structuredClone(liveRuntime.state),
    runtimeHealth: structuredClone(liveRuntime.runtimeHealth),
    scheduler: { ...liveRuntime.scheduler },
    eventPublisher: stagedEventPublisher,
    replayLogWriter: stagedReplayLogWriter,
    snapshotController: stagedSnapshotController,
    processedCommandIds: new Set(liveRuntime.processedCommandIds),
    commandRateLimitWindow: {
      tick: liveRuntime.commandRateLimitWindow.tick,
      commandCountsByPlayerId: {
        ...liveRuntime.commandRateLimitWindow.commandCountsByPlayerId
      }
    }
  };
  return {
    runtime: stagedRuntime,
    persist: () => liveRuntime.snapshotController.save(stagedRuntime),
    restore: async () => {
      await stagedSnapshotController.restore(stagedRuntime.record.id, stagedRuntime);
    },
    publish: async () => {
      liveRuntime.record = stagedRuntime.record;
      liveRuntime.lobby = stagedRuntime.lobby;
      liveRuntime.state = stagedRuntime.state;
      liveRuntime.runtimeHealth = stagedRuntime.runtimeHealth;
      liveRuntime.scheduler = stagedRuntime.scheduler;
      liveRuntime.processedCommandIds = stagedRuntime.processedCommandIds;
      liveRuntime.commandRateLimitWindow = stagedRuntime.commandRateLimitWindow;
      for (const sideEffect of deferredSideEffects) {
        try {
          await sideEffect();
        } catch {}
      }
    }
  };
};

export const requireHostedRuntimeMutationCommitter = (
  options: HostedRuntimePlayerMutationOptions
): HostedRuntimeMutationCommitter | null => {
  if (options.runtimeMutationCommitter) return options.runtimeMutationCommitter;
  if (options.controlPlane.durable) throw hostedMutationError("HOSTED_MUTATION_COMMITTER_UNAVAILABLE");
  return null;
};

export const hostedMutationError = (code: string): Error =>
  Object.assign(new Error(code), { safeCode: code });

export const hostedMutationErrorCode = (error: unknown): string =>
  typeof error === "object" && error !== null && "safeCode" in error
    ? String((error as { safeCode: unknown }).safeCode).slice(0, 80)
    : "HOSTED_WORKER_OPERATION_FAILED";
