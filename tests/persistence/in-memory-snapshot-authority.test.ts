import { describe, expect, it } from "vitest";
import {
  createInstanceSnapshot,
  createServerInstanceRuntime
} from "../../apps/server/src/runtime";
import {
  createInMemorySnapshotRepository
} from "../../apps/server/src/runtime/persistence/repositories";

describe("in-memory snapshot authority", () => {
  it("rejects stale and divergent writes while allowing exact retries and advances", async () => {
    const repository = createInMemorySnapshotRepository();
    const runtime = createServerInstanceRuntime("instance:memory:snapshot-authority", "free");
    runtime.state.root.version = 5;
    const current = createInstanceSnapshot(runtime);

    await repository.save(current);
    await repository.save(structuredClone(current));
    const retryCreatedLater = structuredClone(current);
    retryCreatedLater.createdAt = "2026-07-19T12:00:00.000Z";
    await repository.save(retryCreatedLater);
    await expect(repository.loadLatest(runtime.record.id)).resolves.toEqual(current);

    const divergent = structuredClone(current);
    divergent.lobby!.displayName = "Divergent server";
    await expect(repository.save(divergent)).rejects.toThrow("Refusing divergent snapshot");

    const stale = structuredClone(current);
    stale.integrity.rootVersion = 4;
    stale.state.root.version = 4;
    await expect(repository.save(stale)).rejects.toThrow("stale rootVersion");

    const advanced = structuredClone(current);
    advanced.integrity.rootVersion = 6;
    advanced.state.root.version = 6;
    await repository.save(advanced);
    await expect(repository.loadLatest(runtime.record.id)).resolves.toEqual(advanced);
  });

  it("isolates persisted snapshots from caller mutation", async () => {
    const repository = createInMemorySnapshotRepository();
    const runtime = createServerInstanceRuntime("instance:memory:snapshot-copy", "free");
    const snapshot = createInstanceSnapshot(runtime);

    await repository.save(snapshot);
    snapshot.lobby!.displayName = "Caller mutation";
    const loaded = await repository.loadLatest(runtime.record.id);
    loaded!.lobby!.displayName = "Reader mutation";

    await expect(repository.loadLatest(runtime.record.id)).resolves.not.toMatchObject({
      lobby: { displayName: "Caller mutation" }
    });
    await expect(repository.loadLatest(runtime.record.id)).resolves.not.toMatchObject({
      lobby: { displayName: "Reader mutation" }
    });
  });
});
