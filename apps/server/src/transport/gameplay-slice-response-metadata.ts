import type { GameplaySliceResponse } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../runtime/instance/server-instance-runtime";
import { isRuntimePerformanceDiagnosticsEnabled } from "../runtime/monitoring/runtime-performance-diagnostics";

export const createGameplaySliceResponseMetadata = (
  runtime: ServerInstanceRuntime,
  commandId?: string
): GameplaySliceResponse["metadata"] => {
  const commandTiming = isRuntimePerformanceDiagnosticsEnabled(runtime)
    && commandId
    && runtime.runtimeHealth.performanceDiagnostics.lastCommand?.commandId === commandId
      ? runtime.runtimeHealth.performanceDiagnostics.lastCommand
      : null;
  return {
    serverTick: runtime.state.root.tick,
    stateVersion: runtime.state.root.version,
    ...(commandTiming ? { commandTiming: { ...commandTiming } } : {})
  };
};
