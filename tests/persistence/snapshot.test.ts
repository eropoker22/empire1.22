import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { createInstanceSnapshot } from "../../apps/server/src/runtime/persistence/mappers/create-instance-snapshot";
import { createPersistenceRestoreService } from "../../apps/server/src/runtime/persistence/services/instance-restore-service";
import { createSnapshotTokenCodec } from "../../apps/server/src/runtime/persistence/services/snapshot-token-codec";
import { createServerInstanceRuntime } from "../../apps/server/src/runtime/instance-manager/instance-factory";
import { restoreInstanceState } from "../../apps/server/src/runtime/persistence/mappers/restore-instance-state";
import { resolvePlayerOperationalLiveness } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createCoreStateFixture } from "../fixtures/game-state-fixtures";

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

  it("restores liveness lifecycle, confirmation and pending delivery state without duplication", () => {
    const runtime = createServerInstanceRuntime("instance:1", "free");
    runtime.state = createCoreStateFixture();
    runtime.state.playersById["player:1"] = {
      ...runtime.state.playersById["player:1"],
      lastStandUsedAtTick: 10,
      lastStandDistrictId: "district:1",
      lastStandProtectedUntilTick: 100,
      emergencyRecoveryUsedAtTick: 5
    };
    runtime.state.encirclementConfirmationTokensById = {
      "encirclement-confirmation:1": {
        id: "encirclement-confirmation:1",
        actorPlayerId: "player:1",
        targetDistrictId: "district:2",
        sourceDistrictId: "district:1",
        affectedPlayerIds: ["player:2"],
        targetVersion: 1,
        allianceId: "alliance:1",
        allianceVersion: 1,
        issuedAtTick: 0,
        expiresAtTick: 20,
        consumedAtTick: null,
        version: 1
      }
    };
    runtime.state.playerCityEventStatesByPlayerId = {
      "player:1": {
        version: 1,
        offersByAgent: { victor: [], leon: [], nyra: [] },
        activeRun: null,
        attemptedOfferIds: [],
        pendingRewards: [{
          pendingRewardId: "pending:1",
          sourceOfferId: "offer:1",
          resourceKey: "chemicals",
          amount: 3,
          reason: "storage-capacity",
          createdAtTick: 4
        }],
        lastProcessedScheduleWindowByAgent: {}
      }
    };
    const context = { config: resolveModeConfig("free") };
    const before = resolvePlayerOperationalLiveness(runtime.state, "player:1", context);
    const serialized = JSON.parse(JSON.stringify(createInstanceSnapshot(runtime)));
    const restored = restoreInstanceState(serialized);
    const after = resolvePlayerOperationalLiveness(restored, "player:1", context);

    expect(after).toEqual(before);
    expect(restored.playersById["player:1"]).toMatchObject({
      lastStandUsedAtTick: 10,
      lastStandProtectedUntilTick: 100,
      emergencyRecoveryUsedAtTick: 5
    });
    expect(Object.keys(restored.encirclementConfirmationTokensById ?? {})).toEqual(["encirclement-confirmation:1"]);
    expect(restored.playerCityEventStatesByPlayerId?.["player:1"]?.pendingRewards).toHaveLength(1);
  });
});
