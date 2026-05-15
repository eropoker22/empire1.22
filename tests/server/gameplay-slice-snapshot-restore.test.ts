import { describe, expect, it } from "vitest";
import type { LoadGameplaySliceRequest } from "@empire/shared-types";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap";
import { restoreGameplaySliceSessionFromSnapshot } from "../../apps/server/src/bootstrap/gameplay-slice-snapshot-restore";
import { ServerInstanceManager } from "../../apps/server/src/runtime";
import type { InstanceSnapshotDto } from "../../apps/server/src/runtime/persistence/dto";
import { createInstanceSnapshot } from "../../apps/server/src/runtime/persistence/mappers";
import type { SnapshotTokenCodec } from "../../apps/server/src/runtime/persistence/services";

const createCodec = (snapshot: InstanceSnapshotDto | null): SnapshotTokenCodec => ({
  seal: async () => "sealed:test-token",
  open: async () => snapshot
});

const createLoadRequest = (
  serverInstanceId: string,
  playerId: string,
  districtId: string
): LoadGameplaySliceRequest => ({
  serverInstanceId,
  playerId,
  districtId,
  factionId: "mafian"
});

const createSnapshot = async ({
  instanceId,
  tick,
  players
}: {
  instanceId: string;
  tick: number;
  players: string[];
}): Promise<InstanceSnapshotDto> => {
  const manager = new ServerInstanceManager();

  for (const [index, playerId] of players.entries()) {
    await ensureGameplaySliceSessionResult(
      manager,
      createLoadRequest(instanceId, playerId, `district:${100 + index}`)
    );
  }

  const runtime = manager.getInstanceById(instanceId);

  if (!runtime) {
    throw new Error("Snapshot fixture failed to create a runtime.");
  }

  runtime.state.root.tick = tick;
  return createInstanceSnapshot(runtime);
};

describe("gameplay slice snapshot restore guard", () => {
  it("restores a snapshot when no warm runtime exists", async () => {
    const instanceId = "instance:snapshot:cold";
    const snapshot = await createSnapshot({
      instanceId,
      tick: 7,
      players: ["player:snapshot:cold:1"]
    });
    const manager = new ServerInstanceManager();

    const restored = await restoreGameplaySliceSessionFromSnapshot(
      manager,
      {
        serverInstanceId: instanceId,
        fallbackMode: "free"
      },
      {
        snapshotToken: "sealed:test-token",
        snapshotTokenCodec: createCodec(snapshot)
      }
    );

    const runtime = manager.getInstanceById(instanceId);

    expect(restored).toBe(true);
    expect(runtime?.state.root.tick).toBe(7);
    expect(runtime?.state.playersById["player:snapshot:cold:1"]).toBeDefined();
  });

  it("ignores a stale snapshot when a newer warm runtime already exists", async () => {
    const instanceId = "instance:snapshot:stale";
    const staleSnapshot = await createSnapshot({
      instanceId,
      tick: 2,
      players: ["player:snapshot:stale:1"]
    });
    const manager = new ServerInstanceManager();

    await ensureGameplaySliceSessionResult(
      manager,
      createLoadRequest(instanceId, "player:snapshot:stale:1", "district:201")
    );
    await ensureGameplaySliceSessionResult(
      manager,
      createLoadRequest(instanceId, "player:snapshot:stale:2", "district:202")
    );

    const runtime = manager.getInstanceById(instanceId);

    if (!runtime) {
      throw new Error("Warm runtime fixture failed to create a runtime.");
    }

    runtime.state.root.tick = 9;

    const restored = await restoreGameplaySliceSessionFromSnapshot(
      manager,
      {
        serverInstanceId: instanceId,
        fallbackMode: "free"
      },
      {
        snapshotToken: "sealed:stale-token",
        snapshotTokenCodec: createCodec(staleSnapshot)
      }
    );

    expect(restored).toBe(false);
    expect(runtime.state.root.tick).toBe(9);
    expect(runtime.state.playersById["player:snapshot:stale:2"]).toBeDefined();
  });

  it("does not restore a snapshot for a different instance id", async () => {
    const snapshot = await createSnapshot({
      instanceId: "instance:snapshot:other",
      tick: 4,
      players: ["player:snapshot:other:1"]
    });
    const manager = new ServerInstanceManager();

    const restored = await restoreGameplaySliceSessionFromSnapshot(
      manager,
      {
        serverInstanceId: "instance:snapshot:requested",
        fallbackMode: "free"
      },
      {
        snapshotToken: "sealed:mismatch-token",
        snapshotTokenCodec: createCodec(snapshot)
      }
    );

    expect(restored).toBe(false);
    expect(manager.getInstanceById("instance:snapshot:requested")).toBeUndefined();
  });
});
