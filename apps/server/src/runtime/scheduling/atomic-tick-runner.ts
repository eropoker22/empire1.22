import { runTick, type CoreGameState } from "@empire/game-core";
import { PRODUCTION_GAME_LIFECYCLE_PHASES, type InstanceRuntimeEvent } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import {
  isRuntimeLeaseFenceRejectedError,
  RuntimeLeaseFenceRejectedError,
  type RuntimeTickLeaseFence
} from "../instance-manager/atomic-command-transaction";
import { writeDiagnosticLog } from "../logging";
import { createInstanceSnapshot, restoreInstanceState } from "../persistence";
import type { Clock } from "./clock";
import { isInstanceTickDue } from "./instance-scheduler";
import { runInstanceTick } from "./tick-runner";

interface CommittedTick {
  nextState: CoreGameState;
  events: ReturnType<typeof runTick>["events"];
  processedCommandIds: Set<string>;
  commandRateLimitWindow: ServerInstanceRuntime["commandRateLimitWindow"];
}

/**
 * Runs hosted ticks through the same per-instance transaction row lock used by commands.
 * Runtime state and events are published only after the snapshot transaction commits.
 */
export const runAtomicInstanceTick = async (
  runtime: ServerInstanceRuntime,
  clock: Clock = runtime.clock,
  runtimeLeaseFence?: RuntimeTickLeaseFence
): Promise<ServerInstanceRuntime> => {
  if (!runtime.atomicCommandTransaction) {
    if (runtimeLeaseFence?.isCurrent && !await runtimeLeaseFence.isCurrent()) {
      throw new RuntimeLeaseFenceRejectedError(runtime.record.id);
    }
    const previousTick = runtime.state.root.tick;
    runInstanceTick(runtime, clock);
    if (runtime.state.root.tick !== previousTick) await runtime.snapshotController.save(runtime);
    return runtime;
  }
  if (!runtime.scheduler.isRunning || runtime.scheduler.tickInProgress) return runtime;
  const tickNow = clock.now();
  if (!isInstanceTickDue(runtime.scheduler, tickNow)) return runtime;

  runtime.scheduler.tickInProgress = true;
  runtime.runtimeHealth.lastTickStartedAt = clock.nowIso();
  try {
    const committed = await runtime.atomicCommandTransaction.run(runtime.record.id, async (repositories) => {
      const latest = await repositories.snapshotRepository.loadLatest(runtime.record.id);
      const baseState = prepareHostedTickState(runtime, latest ? restoreInstanceState(latest) : structuredClone(runtime.state));
      const result = runTick(baseState, { config: runtime.config });
      const nextState = ensureAdvancedRootVersion(result.nextState, baseState.root.version);
      const processedCommandIds = new Set(latest?.runtime?.processedCommandIds ?? runtime.processedCommandIds);
      const commandRateLimitWindow = {
        tick: nextState.root.tick,
        commandCountsByPlayerId: {}
      };
      const stagedRuntime: ServerInstanceRuntime = {
        ...runtime,
        state: nextState,
        processedCommandIds,
        commandRateLimitWindow
      };
      await repositories.snapshotRepository.save(createInstanceSnapshot(stagedRuntime));
      return { nextState, events: result.events, processedCommandIds, commandRateLimitWindow } satisfies CommittedTick;
    }, { runtimeLeaseFence });

    runtime.state = committed.nextState;
    runtime.processedCommandIds = committed.processedCommandIds;
    runtime.commandRateLimitWindow = committed.commandRateLimitWindow;
    for (const event of committed.events) runtime.eventQueue.enqueue(event);
    const tickEvent: InstanceRuntimeEvent = {
      type: "tick-completed",
      payload: { tick: runtime.state.root.tick },
      occurredAt: clock.nowIso()
    };
    runtime.eventQueue.enqueue(tickEvent);
    runtime.eventPublisher.publish(tickEvent);
    runtime.runtimeHealth.lastTickCompletedAt = clock.nowIso();
    runtime.scheduler.lastTickAtMs = tickNow.getTime();
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "info", "tick", "Tick completed.", {
      tick: runtime.state.root.tick
    }, clock).catch(() => undefined);
  } catch (error) {
    if (isRuntimeLeaseFenceRejectedError(error)) {
      runtime.runtimeHealth.lastErrorAt = clock.nowIso();
      void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "warn", "tick",
        "Atomic tick lease fence rejected commit.", { tick: readRuntimeTick(runtime) }, clock).catch(() => undefined);
      throw error;
    }
    runtime.record.status = "crashed";
    runtime.record.crashCount += 1;
    runtime.scheduler.isRunning = false;
    runtime.runtimeHealth.lastErrorAt = clock.nowIso();
    void writeDiagnosticLog(runtime.replayLogWriter, runtime.record.id, "error", "crash", "Atomic tick execution crashed.", {
      tick: readRuntimeTick(runtime)
    }, clock).catch(() => undefined);
  } finally {
    runtime.scheduler.tickInProgress = false;
  }
  return runtime;
};

const prepareHostedTickState = (runtime: ServerInstanceRuntime, state: CoreGameState): CoreGameState => {
  if (runtime.record.status !== "running" || state.root.phase !== PRODUCTION_GAME_LIFECYCLE_PHASES.bootstrapping) {
    return state;
  }
  return {
    ...state,
    serverInstance: {
      ...state.serverInstance,
      status: "running",
      startedAt: runtime.record.startedAt ?? state.serverInstance.startedAt,
      version: state.serverInstance.version + 1
    },
    root: { ...state.root, phase: PRODUCTION_GAME_LIFECYCLE_PHASES.live }
  };
};

const ensureAdvancedRootVersion = (state: CoreGameState, previousRootVersion: number): CoreGameState =>
  state.root.version > previousRootVersion
    ? state
    : { ...state, root: { ...state.root, version: previousRootVersion + 1 } };

const readRuntimeTick = (runtime: ServerInstanceRuntime): number => {
  const tick = Number((runtime.state.root as { tick?: unknown } | null | undefined)?.tick ?? 0);
  return Number.isFinite(tick) ? tick : 0;
};
