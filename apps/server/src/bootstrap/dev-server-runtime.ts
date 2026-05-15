import { createServerApp, type ServerApp } from "../app";
import type { TickLoop } from "../runtime/scheduling";

export interface DevServerRuntimeServer {
  tickLoop: Pick<TickLoop, "start" | "stop" | "isRunning">;
}

export interface DevServerRuntime<TServer extends DevServerRuntimeServer = ServerApp> {
  server: TServer;
  start(): void;
  stop(): void;
  dispose(): void;
  isRunning(): boolean;
}

export interface DevServerRuntimeOptions<TServer extends DevServerRuntimeServer> {
  server: TServer;
}

/**
 * Responsibility: explicit local/dev runtime control for authoritative ticks.
 * Belongs here: opt-in tick-loop lifecycle ownership for development.
 * Does not belong here: serverless startup, HTTP transport, persistence, or gameplay rules.
 */
export function createDevServerRuntime(): DevServerRuntime<ServerApp>;
export function createDevServerRuntime<TServer extends DevServerRuntimeServer>(
  options: DevServerRuntimeOptions<TServer>
): DevServerRuntime<TServer>;
export function createDevServerRuntime<TServer extends DevServerRuntimeServer>(
  options?: DevServerRuntimeOptions<TServer>
): DevServerRuntime<ServerApp | TServer> {
  const server = options?.server ?? createServerApp();

  const stop = (): void => {
    server.tickLoop.stop();
  };

  return {
    server,
    start: () => {
      server.tickLoop.start();
    },
    stop,
    dispose: stop,
    isRunning: () => server.tickLoop.isRunning()
  };
}

export function startDevServerRuntime(): DevServerRuntime<ServerApp>;
export function startDevServerRuntime<TServer extends DevServerRuntimeServer>(
  options: DevServerRuntimeOptions<TServer>
): DevServerRuntime<TServer>;
export function startDevServerRuntime<TServer extends DevServerRuntimeServer>(
  options?: DevServerRuntimeOptions<TServer>
): DevServerRuntime<ServerApp | TServer> {
  const runtime = options ? createDevServerRuntime(options) : createDevServerRuntime();
  runtime.start();
  return runtime;
}
