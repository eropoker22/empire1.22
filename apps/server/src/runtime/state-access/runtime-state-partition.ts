import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";

/**
 * Responsibility: Documents and exposes the split between persistent and runtime-only instance state.
 * Belongs here: explicit partition helpers for persistence-safe server architecture.
 * Does not belong here: mutation logic or transport adapters.
 */
export const splitRuntimeState = (runtime: ServerInstanceRuntime) => ({
  persistent: {
    record: runtime.record,
    configMetadata: {
      mode: runtime.config.mode,
      configKey: runtime.record.configKey,
      configVersion: runtime.config.mode
    },
    state: runtime.state
  },
  runtimeOnly: {
    eventQueue: runtime.eventQueue,
    eventPublisher: runtime.eventPublisher,
    runtimeHealth: runtime.runtimeHealth,
    logger: runtime.logger,
    scheduler: runtime.scheduler
  }
});
