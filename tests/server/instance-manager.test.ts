import { describe, expect, it } from "vitest";
import {
  PRODUCTION_GAME_LIFECYCLE_PHASES,
  isDevSetupGameLifecyclePhase,
  isProductionGameLifecyclePhase
} from "@empire/shared-types";
import { createServerApp } from "../../apps/server/src/app";
import { createInstanceManagerFixture } from "../fixtures/runtime-fixtures";

describe("ServerInstanceManager", () => {
  it("keeps instances isolated", () => {
    const manager = createInstanceManagerFixture();
    manager.createInstance("instance:1", "free");
    manager.createInstance("instance:2", "war");

    expect(manager.listInstances()).toHaveLength(2);
    expect(manager.getInstanceById("instance:1")?.record.mode).toBe("free");
    expect(manager.getInstanceById("instance:2")?.record.mode).toBe("war");
  });

  it("starts free and war instances without requiring dev setup phases", () => {
    const server = createServerApp();
    const freeRuntime = server.instanceManager.createInstance("instance:free", "free");
    const warRuntime = server.instanceManager.createInstance("instance:war", "war");

    server.instanceManager.startInstance(freeRuntime.record.id);
    server.instanceManager.startInstance(warRuntime.record.id);

    [freeRuntime, warRuntime].forEach((runtime) => {
      expect(runtime.record.status).toBe("running");
      expect(runtime.state.root.phase).toBe(PRODUCTION_GAME_LIFECYCLE_PHASES.live);
      expect(isProductionGameLifecyclePhase(runtime.state.root.phase)).toBe(true);
      expect(isDevSetupGameLifecyclePhase(runtime.state.root.phase)).toBe(false);
    });
  });
});
