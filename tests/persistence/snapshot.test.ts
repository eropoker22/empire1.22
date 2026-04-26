import { describe, expect, it } from "vitest";
import { createInstanceSnapshot } from "../../apps/server/src/runtime/persistence/mappers/create-instance-snapshot";
import { createServerInstanceRuntime } from "../../apps/server/src/runtime/instance-manager/instance-factory";

describe("instance snapshot mapping", () => {
  it("creates a versioned snapshot dto", () => {
    const runtime = createServerInstanceRuntime("instance:1", "free");
    const snapshot = createInstanceSnapshot(runtime);

    expect(snapshot.instanceId).toBe("instance:1");
    expect(snapshot.version.schemaVersion).toBe(1);
    expect(snapshot.integrity.rootVersion).toBe(runtime.state.root.version);
  });
});

