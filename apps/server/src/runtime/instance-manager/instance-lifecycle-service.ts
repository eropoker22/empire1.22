import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  isDevSetupGameLifecyclePhase
} from "@empire/shared-types";
import type { GameCommand } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { writeDiagnosticLog } from "../logging";
import type { CommandDispatchOptions } from "../orchestration/command-dispatch-options";
import { restoreOrCreateInitialState } from "../snapshots/instance-restore-service";
import { runInstanceTick } from "../scheduling/tick-runner";
import { runAtomicInstanceTick } from "../scheduling/atomic-tick-runner";
import type { InstanceCommandDispatchResult } from "../orchestration/instance-command-dispatch-result";
import { dispatchInstanceCommand } from "./instance-command-dispatch";
import type { RuntimeTickLeaseFence } from "./atomic-command-transaction";

export type { CommandDispatchOptions } from "../orchestration/command-dispatch-options";

/**
 * Responsibility: Encapsulates lifecycle transitions and safe tick execution for one runtime.
 * Belongs here: create/start/stop/restart/destroy state transitions and tick orchestration.
 * Does not belong here: registry lookups or transport-facing code.
 */
export class InstanceLifecycleService {
  start(runtime: ServerInstanceRuntime): ServerInstanceRuntime {
    const nowIso = runtime.clock.nowIso();
    const startedAt = resolveInitialStartedAt(runtime, nowIso);
    runtime.record.status = "booting";
    runtime.eventPublisher.publish({
      type: "instance-status-changed",
      payload: { status: runtime.record.status },
      occurredAt: nowIso
    });
    runtime = ensureProductionLifecyclePhase(runtime, PRODUCTION_GAME_LIFECYCLE_PHASES.live);
    runtime.record.status = "running";
    runtime.record.startedAt = startedAt;
    runtime = synchronizeStartedServerInstance(runtime, startedAt);
    runtime.scheduler.isRunning = true;
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "lifecycle", "Instance started.", {}, runtime.clock).catch(() => undefined);
    runtime.eventPublisher.publish({
      type: "instance-status-changed",
      payload: { status: runtime.record.status },
      occurredAt: nowIso
    });
    return runtime;
  }

  pause(runtime: ServerInstanceRuntime): ServerInstanceRuntime {
    runtime.record.status = "pausing";
    runtime.scheduler.isRunning = false;
    runtime.eventPublisher.publish({
      type: "instance-status-changed",
      payload: { status: runtime.record.status },
      occurredAt: runtime.clock.nowIso()
    });
    runtime.record.status = "paused";
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "lifecycle", "Instance paused.", {}, runtime.clock).catch(() => undefined);
    runtime.eventPublisher.publish({
      type: "instance-status-changed",
      payload: { status: runtime.record.status },
      occurredAt: runtime.clock.nowIso()
    });
    return runtime;
  }

  stop(runtime: ServerInstanceRuntime): ServerInstanceRuntime {
    runtime.record.status = "stopping";
    runtime.record.status = "stopped";
    runtime.record.stoppedAt = runtime.clock.nowIso();
    runtime.scheduler.isRunning = false;
    if (!runtime.atomicCommandTransaction) {
      void runtime.snapshotController.save(runtime).catch(() => undefined);
      void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "snapshot", "Stop triggered snapshot save.", {}, runtime.clock).catch(() => undefined);
    }
    runtime.eventPublisher.publish({
      type: "instance-status-changed",
      payload: { status: runtime.record.status },
      occurredAt: runtime.clock.nowIso()
    });
    return runtime;
  }

  restart(runtime: ServerInstanceRuntime): ServerInstanceRuntime {
    runtime.record.status = "restarting";
    runtime.scheduler.isRunning = false;
    runtime.record.status = "running";
    runtime.scheduler.isRunning = true;
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "lifecycle", "Instance restarted.", {}, runtime.clock).catch(() => undefined);
    return runtime;
  }

  destroy(runtime: ServerInstanceRuntime): ServerInstanceRuntime {
    runtime.record.status = "destroying";
    runtime.record.status = "destroyed";
    runtime.scheduler.isRunning = false;
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "warn", "lifecycle", "Instance destroyed.", {}, runtime.clock).catch(() => undefined);
    runtime.eventPublisher.publish({
      type: "instance-status-changed",
      payload: { status: runtime.record.status },
      occurredAt: runtime.clock.nowIso()
    });
    return runtime;
  }

  tick(runtime: ServerInstanceRuntime): ServerInstanceRuntime {
    return runInstanceTick(runtime, runtime.clock);
  }

  tickDurably(runtime: ServerInstanceRuntime, runtimeLeaseFence?: RuntimeTickLeaseFence): Promise<ServerInstanceRuntime> {
    return runAtomicInstanceTick(runtime, runtime.clock, runtimeLeaseFence);
  }

  async dispatch(
    runtime: ServerInstanceRuntime,
    command: GameCommand,
    options: CommandDispatchOptions = {}
  ): Promise<InstanceCommandDispatchResult> {
    return dispatchInstanceCommand(runtime, command, options);
  }

  async restore(runtime: ServerInstanceRuntime): Promise<ServerInstanceRuntime> {
    const status = runtime.record.status;
    const schedulerRunning = runtime.scheduler.isRunning;
    runtime.record.status = "booting";
    runtime = await restoreOrCreateInitialState(
      runtime.snapshotController,
      runtime.record.id,
      runtime
    );
    runtime.record.status = status;
    runtime.scheduler.isRunning = schedulerRunning;
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "snapshot", "Instance restore completed; warm state was retained when no snapshot existed.", {}, runtime.clock).catch(() => undefined);
    return runtime;
  }
}

const ensureProductionLifecyclePhase = (
  runtime: ServerInstanceRuntime,
  nextPhase: typeof PRODUCTION_GAME_LIFECYCLE_PHASES.live
): ServerInstanceRuntime => {
  if (isDevSetupGameLifecyclePhase(runtime.state.root.phase) || runtime.state.root.phase === nextPhase) {
    return runtime;
  }

  runtime.state.root = {
    ...runtime.state.root,
    phase: nextPhase,
    version: runtime.state.root.version + 1
  };

  return runtime;
};

const resolveInitialStartedAt = (runtime: ServerInstanceRuntime, nowIso: string): string => {
  if (runtime.record.startedAt) return runtime.record.startedAt;
  const stateStartedAt = runtime.state.serverInstance.startedAt;
  const stateStartedAtMs = Date.parse(stateStartedAt);
  return Number.isFinite(stateStartedAtMs) && stateStartedAtMs > 0 ? stateStartedAt : nowIso;
};

const synchronizeStartedServerInstance = (
  runtime: ServerInstanceRuntime,
  startedAt: string
): ServerInstanceRuntime => {
  const serverInstance = runtime.state.serverInstance;
  if (
    serverInstance.status === "running" &&
    serverInstance.startedAt === startedAt &&
    serverInstance.currentTick === runtime.state.root.tick
  ) {
    return runtime;
  }

  runtime.state.serverInstance = {
    ...serverInstance,
    status: "running",
    startedAt,
    currentTick: runtime.state.root.tick,
    version: serverInstance.version + 1
  };
  return runtime;
};
