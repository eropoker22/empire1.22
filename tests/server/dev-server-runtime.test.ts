import { describe, expect, it, vi } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import {
  createDevServerRuntime,
  startDevServerRuntime,
  type DevServerRuntimeServer
} from "../../apps/server/src/bootstrap/dev-server-runtime";

const createFakeServer = (): DevServerRuntimeServer => {
  let running = false;

  return {
    tickLoop: {
      start: vi.fn(() => {
        running = true;
      }),
      stop: vi.fn(() => {
        running = false;
      }),
      isRunning: vi.fn(() => running)
    }
  };
};

describe("dev server runtime tick loop bootstrap", () => {
  it("createServerApp creates a tick loop without starting it", () => {
    const server = createServerApp();

    expect(server.tickLoop.isRunning()).toBe(false);
  });

  it("explicit dev start path starts the tick loop", () => {
    const server = createFakeServer();
    const runtime = startDevServerRuntime({ server });

    expect(server.tickLoop.start).toHaveBeenCalledTimes(1);
    expect(runtime.isRunning()).toBe(true);
  });

  it("dev runtime factory does not start until start is called", () => {
    const server = createFakeServer();
    const runtime = createDevServerRuntime({ server });

    expect(server.tickLoop.start).not.toHaveBeenCalled();
    expect(runtime.isRunning()).toBe(false);
  });

  it("dev runtime stop and dispose stop the tick loop safely", () => {
    const server = createFakeServer();
    const runtime = createDevServerRuntime({ server });

    runtime.start();
    runtime.stop();
    runtime.dispose();

    expect(server.tickLoop.start).toHaveBeenCalledTimes(1);
    expect(server.tickLoop.stop).toHaveBeenCalledTimes(2);
    expect(runtime.isRunning()).toBe(false);
  });

});
