import type { GameCommand, GameModeId, ServerInstanceId } from "@empire/shared-types";
import { getInstanceHealth } from "./monitoring/instance-health";
import { createInstanceMonitorSnapshot } from "./monitoring/instance-metrics";
import type { ServerInstanceRuntime } from "./instance/server-instance-runtime";
import { InstanceLifecycleService } from "./instance-manager/instance-lifecycle-service";
import type { CommandDispatchOptions } from "./orchestration/command-dispatch-options";
import {
  createInMemoryRuntimePersistenceRepositories,
  createServerInstanceRuntime,
  type ServerInstanceRuntimeOptions,
  type ServerRuntimePersistenceRepositories
} from "./instance-manager/instance-factory";
import { InstanceRegistry } from "./instance-manager/instance-registry";
import { systemClock, type Clock } from "./scheduling/clock";
import { createServerInstanceSummary } from "./instance-manager/server-instance-summary";
import type { InstanceCommandDispatchResult } from "./orchestration/instance-command-dispatch-result";
import type { RuntimeTickLeaseFence } from "./instance-manager/atomic-command-transaction";
import { createGameplaySliceProjection } from "./projections/gameplay-slice-projection-service";
import { createPlayerProjection } from "./projections/player-projection-service";

/**
 * Responsibility: Top-level orchestrator for isolated server instance runtimes.
 * Belongs here: registry access and public lifecycle operations over instances.
 * Does not belong here: gameplay rules, websocket fanout, or persistence implementation details.
 */
export class ServerInstanceManager {
  private readonly registry = new InstanceRegistry();
  private readonly lifecycle = new InstanceLifecycleService();
  private readonly clock: Clock;
  private readonly persistence: ServerRuntimePersistenceRepositories;

  constructor(options: {
    clock?: Clock;
    persistence?: ServerRuntimePersistenceRepositories;
  } = {}) {
    this.clock = options.clock ?? systemClock;
    this.persistence = options.persistence ?? createInMemoryRuntimePersistenceRepositories();
  }

  createInstance(
    instanceId: ServerInstanceId,
    mode: GameModeId,
    options: Pick<ServerInstanceRuntimeOptions, "displayName" | "region" | "capacity"> = {}
  ): ServerInstanceRuntime {
    const runtime = createServerInstanceRuntime(instanceId, mode, {
      clock: this.clock,
      persistence: this.persistence,
      ...options
    });
    this.registry.set(runtime);
    return runtime;
  }

  startInstance(instanceId: ServerInstanceId): ServerInstanceRuntime | undefined {
    const runtime = this.registry.get(instanceId);
    return runtime ? this.lifecycle.start(runtime) : undefined;
  }

  pauseInstance(instanceId: ServerInstanceId): ServerInstanceRuntime | undefined {
    const runtime = this.registry.get(instanceId);
    return runtime ? this.lifecycle.pause(runtime) : undefined;
  }

  stopInstance(instanceId: ServerInstanceId): ServerInstanceRuntime | undefined {
    const runtime = this.registry.get(instanceId);
    return runtime ? this.lifecycle.stop(runtime) : undefined;
  }

  restartInstance(instanceId: ServerInstanceId): ServerInstanceRuntime | undefined {
    const runtime = this.registry.get(instanceId);
    return runtime ? this.lifecycle.restart(runtime) : undefined;
  }

  destroyInstance(instanceId: ServerInstanceId): boolean {
    const runtime = this.registry.get(instanceId);

    if (!runtime) {
      return false;
    }

    this.lifecycle.destroy(runtime);
    this.registry.remove(instanceId);
    return true;
  }

  getInstanceById(instanceId: ServerInstanceId): ServerInstanceRuntime | undefined {
    return this.registry.get(instanceId);
  }

  listInstances(): ServerInstanceRuntime[] {
    return this.registry.list();
  }

  listActiveInstances(): ServerInstanceRuntime[] {
    return this.registry
      .list()
      .filter((runtime) => runtime.record.status === "running");
  }

  listServerSummaries() {
    return this.registry.list().map(createServerInstanceSummary);
  }

  getServerSummary(instanceId: ServerInstanceId) {
    const runtime = this.registry.get(instanceId);
    return runtime ? createServerInstanceSummary(runtime) : undefined;
  }

  openInstanceForJoin(instanceId: ServerInstanceId): ServerInstanceRuntime | undefined {
    const runtime = this.registry.get(instanceId);
    if (!runtime) {
      return undefined;
    }

    runtime.lobby.joinPolicy = "open";
    if (runtime.record.status === "full") {
      runtime.record.status = "lobby";
    }
    return runtime;
  }

  closeInstanceForJoin(instanceId: ServerInstanceId): ServerInstanceRuntime | undefined {
    const runtime = this.registry.get(instanceId);
    if (!runtime) {
      return undefined;
    }

    runtime.lobby.joinPolicy = "closed";
    return runtime;
  }

  tickInstance(instanceId: ServerInstanceId): ServerInstanceRuntime | undefined {
    const runtime = this.registry.get(instanceId);
    return runtime ? this.lifecycle.tick(runtime) : undefined;
  }

  async tickInstanceDurably(
    instanceId: ServerInstanceId,
    runtimeLeaseFence?: RuntimeTickLeaseFence
  ): Promise<ServerInstanceRuntime | undefined> {
    const runtime = this.registry.get(instanceId);
    return runtime ? this.lifecycle.tickDurably(runtime, runtimeLeaseFence) : undefined;
  }

  async dispatchCommand(
    instanceId: ServerInstanceId,
    command: GameCommand,
    options?: CommandDispatchOptions
  ): Promise<InstanceCommandDispatchResult | undefined> {
    const runtime = this.registry.get(instanceId);
    return runtime ? this.lifecycle.dispatch(runtime, command, options) : undefined;
  }

  getPlayerProjection(instanceId: ServerInstanceId, playerId: string) {
    const runtime = this.registry.get(instanceId);
    return runtime ? createPlayerProjection(runtime, playerId) : undefined;
  }

  getGameplaySliceProjection(instanceId: ServerInstanceId, playerId: string, districtId: string) {
    const runtime = this.registry.get(instanceId);
    return runtime ? createGameplaySliceProjection(runtime, playerId, districtId) : undefined;
  }

  async restoreInstance(instanceId: ServerInstanceId): Promise<ServerInstanceRuntime | undefined> {
    const runtime = this.registry.get(instanceId);
    return runtime ? this.lifecycle.restore(runtime) : undefined;
  }

  getInstanceMonitorSnapshot(instanceId: ServerInstanceId) {
    const runtime = this.registry.get(instanceId);
    return runtime
      ? createInstanceMonitorSnapshot(
          runtime.record,
          runtime.state,
          runtime.eventQueue,
          runtime.runtimeHealth
        )
      : undefined;
  }

  getInstanceHealth(instanceId: ServerInstanceId) {
    const runtime = this.registry.get(instanceId);
    return runtime ? getInstanceHealth(runtime) : undefined;
  }

  getHealthSummary() {
    const instances = this.registry.list();
    return {
      totalInstances: instances.length,
      runningInstances: instances.filter((runtime) => runtime.record.status === "running").length,
      crashedInstances: instances.filter((runtime) => runtime.record.status === "crashed").length
    };
  }

  async saveInstanceSnapshot(instanceId: ServerInstanceId): Promise<boolean> {
    const runtime = this.registry.get(instanceId);

    if (!runtime) {
      return false;
    }

    await runtime.snapshotController.save(runtime);
    return true;
  }

  listCommandRecords(instanceId: ServerInstanceId) {
    return this.persistence.commandLogRepository.listByInstance(instanceId);
  }

  listEventRecords(instanceId: ServerInstanceId) {
    return this.persistence.eventLogRepository.listByInstance(instanceId);
  }

  listDiagnosticRecords(instanceId: ServerInstanceId) {
    return this.persistence.diagnosticLogRepository.listByInstance(instanceId);
  }

  getPersistenceRepositories(): ServerRuntimePersistenceRepositories {
    return this.persistence;
  }
}
