import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { createInstanceSnapshot } from "../../apps/server/src/runtime/persistence/mappers/create-instance-snapshot";
import { createPersistenceRestoreService } from "../../apps/server/src/runtime/persistence/services/instance-restore-service";
import { createSnapshotTokenCodec } from "../../apps/server/src/runtime/persistence/services/snapshot-token-codec";
import { createServerInstanceRuntime } from "../../apps/server/src/runtime/instance-manager/instance-factory";

describe("instance snapshot mapping", () => {
  it("creates a versioned snapshot dto", () => {
    const runtime = createServerInstanceRuntime("instance:1", "free");
    runtime.processedCommandIds.add("command:1");
    runtime.commandRateLimitWindow.commandCountsByPlayerId["player:1"] = 2;
    const snapshot = createInstanceSnapshot(runtime);

    expect(snapshot.instanceId).toBe("instance:1");
    expect(snapshot.version.schemaVersion).toBe(1);
    expect(snapshot.integrity.rootVersion).toBe(runtime.state.root.version);
    expect(snapshot.runtime.processedCommandIds).toEqual(["command:1"]);
    expect(snapshot.runtime.commandRateLimitWindow.commandCountsByPlayerId).toEqual({
      "player:1": 2
    });
  });

  it("restores runtime anti-replay metadata from snapshots", async () => {
    const runtime = createServerInstanceRuntime("instance:1", "free");
    runtime.processedCommandIds.add("command:restored");
    runtime.commandRateLimitWindow.commandCountsByPlayerId["player:1"] = 3;
    const snapshot = createInstanceSnapshot(runtime);
    const freshRuntime = createServerInstanceRuntime("instance:1", "free");
    const restoreService = createPersistenceRestoreService({
      save: async () => undefined,
      loadLatest: async () => snapshot
    });

    const restored = await restoreService.restore(freshRuntime);

    expect(restored.processedCommandIds.has("command:restored")).toBe(true);
    expect(restored.commandRateLimitWindow.commandCountsByPlayerId["player:1"]).toBe(3);
  });

  it("seals snapshot DTOs into opaque tokens and rejects tampering", async () => {
    const runtime = createServerInstanceRuntime("instance:token", "free");
    runtime.processedCommandIds.add("command:sealed");
    const snapshot = createInstanceSnapshot(runtime);
    const codec = createSnapshotTokenCodec({
      secret: "test-secret",
      cryptoProvider: () => webcrypto
    });

    const token = await codec.seal(snapshot);
    const opened = await codec.open(token);
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;

    expect(opened?.instanceId).toBe("instance:token");
    expect(opened?.runtime.processedCommandIds).toEqual(["command:sealed"]);
    expect(await codec.open(tamperedToken)).toBeNull();
    expect(await createSnapshotTokenCodec({
      secret: "other-secret",
      cryptoProvider: () => webcrypto
    }).open(token)).toBeNull();
  });
});
