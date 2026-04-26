import type { ServerInstanceId } from "@empire/shared-types";
import { createNullLogSink } from "./log-sink";
import type { LogSink } from "./log-sink";

/**
 * Responsibility: Minimal structured logger bound to one instance context.
 * Belongs here: instance-scoped log helpers and contextual tagging.
 * Does not belong here: transport output formatting or external log shipping.
 */
export interface InstanceLogger {
  instanceId: ServerInstanceId;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export const createInstanceLogger = (
  instanceId: ServerInstanceId,
  sink: LogSink = createNullLogSink()
): InstanceLogger => ({
  instanceId,
  info: (message, context) => {
    sink.write({
      level: "info",
      message,
      timestamp: new Date(0).toISOString(),
      instanceId,
      context
    });
  },
  warn: (message, context) => {
    sink.write({
      level: "warn",
      message,
      timestamp: new Date(0).toISOString(),
      instanceId,
      context
    });
  },
  error: (message, context) => {
    sink.write({
      level: "error",
      message,
      timestamp: new Date(0).toISOString(),
      instanceId,
      context
    });
  }
});
