import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ServerInstanceManager } from "../../apps/server/src/runtime";
import {
  createFileRuntimePersistenceRepositories,
  createServerInstanceRuntime
} from "../../apps/server/src/runtime/instance-manager/instance-factory";
import { createInstanceSnapshot } from "../../apps/server/src/runtime/persistence/mappers";
import { createFileSnapshotRepository } from "../../apps/server/src/runtime/persistence/repositories";
import { createAttackDistrictCommandFixture } from "../fixtures/command-fixtures";
import { createCombatStateFixture } from "../fixtures/game-state-fixtures";

describe("file persistence repositories", () => {
  it("stores logs and snapshots across fresh repository instances", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "empire-file-persistence-"));
    try {
      const instanceId = "instance:file-persistence";
      const firstManager = new ServerInstanceManager({
        persistence: createFileRuntimePersistenceRepositories({ rootDir })
      });
      const runtime = firstManager.createInstance(instanceId, "free");

      runtime.state = createCombatStateFixture(instanceId);
      runtime.state.districtsById["district:2"] = {
        ...runtime.state.districtsById["district:2"],
        defenseLoadout: {}
      };
      firstManager.startInstance(instanceId);

      const result = await firstManager.dispatchCommand(
        instanceId,
        createAttackDistrictCommandFixture({
          id: "command:file-persistence:attack:1",
          serverInstanceId: instanceId
        })
      );

      expect(result?.errors).toEqual([]);
      await flushAsyncReplayWrites();
      await firstManager.saveInstanceSnapshot(instanceId);

      const secondManager = new ServerInstanceManager({
        persistence: createFileRuntimePersistenceRepositories({ rootDir })
      });
      secondManager.createInstance(instanceId, "free");
      await secondManager.restoreInstance(instanceId);
      const restoredRuntime = secondManager.getInstanceById(instanceId);

      expect(restoredRuntime?.state.districtsById["district:2"]?.ownerPlayerId).toBe("player:1");
      expect(restoredRuntime?.processedCommandIds.has("command:file-persistence:attack:1")).toBe(true);
      await expect(secondManager.listCommandRecords(instanceId)).resolves.toHaveLength(1);
      await expect(secondManager.listEventRecords(instanceId)).resolves.toHaveLength(1);
      await expect(secondManager.listDiagnosticRecords(instanceId)).resolves.not.toHaveLength(0);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects stale snapshot overwrites by rootVersion", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "empire-file-snapshot-guard-"));
    try {
      const repository = createFileSnapshotRepository({ rootDir });
      const runtime = createServerInstanceRuntime("instance:file-snapshot-guard", "free");
      runtime.state.root.version = 3;
      const currentSnapshot = createInstanceSnapshot(runtime);
      runtime.state.root.version = 2;
      const staleSnapshot = createInstanceSnapshot(runtime);

      await repository.save(currentSnapshot);
      await expect(repository.save(staleSnapshot)).rejects.toThrow("stale rootVersion");
      await expect(repository.loadLatest(runtime.record.id)).resolves.toMatchObject({
        integrity: {
          rootVersion: 3
        }
      });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

const flushAsyncReplayWrites = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 50);
  });
