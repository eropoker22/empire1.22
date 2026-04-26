import { describe, expect, it } from "vitest";
import { createAdminInstanceViewModel } from "../../apps/admin/src/read-models/admin-instance-view-model";

describe("createAdminInstanceViewModel", () => {
  it("combines read-model summaries into a UI-safe admin view model", () => {
    const result = createAdminInstanceViewModel(
      {
        instanceId: "instance:1",
        mode: "free",
        status: "running",
        tick: 10,
        playerCount: 4,
        allianceCount: 2
      },
      {
        instanceId: "instance:1",
        status: "healthy",
        warnings: [],
        lastErrorAt: null
      },
      {
        instanceId: "instance:1",
        lastSnapshotAt: "2024-01-01T00:00:00.000Z",
        snapshotSchemaVersion: 1,
        lastCrashAt: null,
        diagnosticErrorCount: 0
      }
    );

    expect(result).toEqual({
      instanceId: "instance:1",
      mode: "free",
      status: "running",
      tick: 10,
      playerCount: 4,
      allianceCount: 2,
      healthStatus: "healthy",
      lastSnapshotAt: "2024-01-01T00:00:00.000Z"
    });
  });
});
