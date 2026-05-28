import { applyCommand } from "@empire/game-core";
import type { CoreGameState } from "@empire/game-core";
import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  isDevSetupGameLifecyclePhase
} from "@empire/shared-types";
import type { GameCommand, InstanceRuntimeEvent } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { writeCommandRejectionDiagnostic, writeDiagnosticLog } from "../logging";
import { restoreOrCreateInitialState } from "../snapshots/instance-restore-service";
import { runInstanceTick } from "../scheduling/tick-runner";
import type { InstanceCommandDispatchResult } from "../orchestration/instance-command-dispatch-result";
import {
  recordCommandRateLimitUsage,
  validateCommandDispatchGate
} from "./instance-command-gates";

export interface CommandDispatchOptions {
  expectedStateVersion?: number | null;
}

/**
 * Responsibility: Encapsulates lifecycle transitions and safe tick execution for one runtime.
 * Belongs here: create/start/stop/restart/destroy state transitions and tick orchestration.
 * Does not belong here: registry lookups or transport-facing code.
 */
export class InstanceLifecycleService {
  start(runtime: ServerInstanceRuntime): ServerInstanceRuntime {
    const nowIso = runtime.clock.nowIso();
    runtime.record.status = "booting";
    runtime.eventPublisher.publish({
      type: "instance-status-changed",
      payload: { status: runtime.record.status },
      occurredAt: nowIso
    });
    runtime = ensureProductionLifecyclePhase(runtime, PRODUCTION_GAME_LIFECYCLE_PHASES.live);
    runtime.record.status = "running";
    runtime.record.startedAt = runtime.clock.nowIso();
    runtime.scheduler.isRunning = true;
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "lifecycle", "Instance started.", {}, runtime.clock);
    runtime.eventPublisher.publish({
      type: "instance-status-changed",
      payload: { status: runtime.record.status },
      occurredAt: runtime.clock.nowIso()
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
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "lifecycle", "Instance paused.", {}, runtime.clock);
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
    void runtime.snapshotController.save(runtime);
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "snapshot", "Stop triggered snapshot save.", {}, runtime.clock);
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
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "lifecycle", "Instance restarted.", {}, runtime.clock);
    return runtime;
  }

  destroy(runtime: ServerInstanceRuntime): ServerInstanceRuntime {
    runtime.record.status = "destroying";
    runtime.record.status = "destroyed";
    runtime.scheduler.isRunning = false;
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "warn", "lifecycle", "Instance destroyed.", {}, runtime.clock);
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

  dispatch(
    runtime: ServerInstanceRuntime,
    command: GameCommand,
    options: CommandDispatchOptions = {}
  ): InstanceCommandDispatchResult {
    const gateErrors = validateCommandDispatchGate(runtime, command, options);

    if (gateErrors.length > 0) {
      void writeCommandRejectionDiagnostic({
        runtime,
        command,
        errors: gateErrors,
        category: "command_rejected",
        message: "Command rejected before core dispatch.",
        expectedStateVersion: options.expectedStateVersion
      });

      return {
        runtime,
        errors: gateErrors
      };
    }

    void runtime.replayLogWriter.writeCommand({
      id: `cmd:${command.id}`,
      instanceId: runtime.record.id,
      command,
      receivedAt: runtime.clock.nowIso(),
      actorId: command.playerId,
      correlationId: command.clientRequestId,
      tickAtReceive: runtime.state.root.tick
    });
    runtime.processedCommandIds.add(command.id);
    recordCommandRateLimitUsage(runtime, command);

    const previousRootVersion = runtime.state.root.version;
    const result = applyCommand(runtime.state, command, {
      config: runtime.config
    });

    if (result.errors.length > 0) {
      void writeCommandRejectionDiagnostic({
        runtime,
        command,
        errors: result.errors,
        category: "command_rejected",
        message: "Command rejected."
      });

      return {
        runtime,
        errors: result.errors
      };
    }

    runtime.state = ensureAdvancedRootVersion(result.nextState, previousRootVersion);

    const appliedEvent: InstanceRuntimeEvent = {
      type: "command-applied",
      payload: {
        commandId: command.id,
        eventCount: result.events.length
      },
      occurredAt: runtime.clock.nowIso()
    };

    runtime.eventQueue.enqueue(appliedEvent);
    runtime.eventPublisher.publish(appliedEvent);
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "command", "Command dispatched.", {
      commandId: command.id,
      commandType: command.type
    }, runtime.clock);
    void runtime.replayLogWriter.writeEvent({
      id: `evt:${command.id}:${runtime.state.root.tick}`,
      instanceId: runtime.record.id,
      event: appliedEvent,
      causedByCommandId: command.id,
      recordedAt: runtime.clock.nowIso(),
      tickAtEmit: runtime.state.root.tick
    });

    return {
      runtime,
      errors: []
    };
  }

  async restore(runtime: ServerInstanceRuntime): Promise<ServerInstanceRuntime> {
    runtime.record.status = "booting";
    runtime = await restoreOrCreateInitialState(
      runtime.snapshotController,
      runtime.record.id,
      runtime
    );
    runtime.record.status = "stopped";
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "snapshot", "Instance restored from snapshot or initial state.", {}, runtime.clock);
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

const ensureAdvancedRootVersion = (
  state: CoreGameState,
  previousRootVersion: number
): CoreGameState =>
  state.root.version > previousRootVersion
    ? state
    : {
        ...state,
        root: {
          ...state.root,
          version: previousRootVersion + 1
        }
      };
