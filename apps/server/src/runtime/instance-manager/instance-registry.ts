import type { ServerInstanceId } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";

/**
 * Responsibility: Small in-memory registry for active instance runtimes.
 * Belongs here: add, get, list, and remove operations on isolated runtimes.
 * Does not belong here: lifecycle transitions or gameplay execution.
 */
export class InstanceRegistry {
  private readonly runtimes = new Map<ServerInstanceId, ServerInstanceRuntime>();

  set(runtime: ServerInstanceRuntime): void {
    this.runtimes.set(runtime.record.id, runtime);
  }

  get(instanceId: ServerInstanceId): ServerInstanceRuntime | undefined {
    return this.runtimes.get(instanceId);
  }

  list(): ServerInstanceRuntime[] {
    return [...this.runtimes.values()];
  }

  remove(instanceId: ServerInstanceId): void {
    this.runtimes.delete(instanceId);
  }
}

