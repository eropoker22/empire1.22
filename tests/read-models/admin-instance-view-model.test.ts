import { describe, expect, it } from "vitest";
import {
  createAdminInstanceViewModel,
  createAdminInstanceViewModelFromMonitoringSummary
} from "../../apps/admin/src/read-models/admin-instance-view-model";
import { renderInstanceListPage } from "../../apps/admin/src/pages/instance-list-page";

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
      displayName: "instance:1",
      region: "unknown",
      tick: 10,
      currentTick: 10,
      playerCount: 4,
      allianceCount: 2,
      crashCount: 0,
      healthStatus: "healthy",
      warningCount: 0,
      lastSnapshotAt: "2024-01-01T00:00:00.000Z",
      lastTickStartedAt: null,
      lastTickCompletedAt: null,
      totalCommands: 0,
      commandCount: 0,
      eventCount: 0,
      diagnosticErrorCount: 0,
      diagnosticWarningCount: 0,
      lastErrorAt: null,
      queuedEvents: 0,
      queuedEventCount: 0
    });
  });

  it("maps the admin monitoring summary into the table view model", () => {
    const result = createAdminInstanceViewModelFromMonitoringSummary({
      instanceId: "instance:admin:1",
      mode: "war",
      status: "running",
      displayName: "War EU 1",
      region: "eu-central",
      currentTick: 12,
      playerCount: 8,
      allianceCount: 2,
      crashCount: 1,
      healthStatus: "healthy",
      warningCount: 0,
      lastTickStartedAt: "2026-05-21T10:00:00.000Z",
      lastTickCompletedAt: "2026-05-21T10:00:01.000Z",
      lastErrorAt: null,
      queuedEventCount: 3,
      commandCount: 5,
      eventCount: 7,
      diagnosticErrorCount: 0,
      lastSnapshotAt: "2026-05-21T10:00:02.000Z"
    });

    expect(result).toMatchObject({
      instanceId: "instance:admin:1",
      displayName: "War EU 1",
      region: "eu-central",
      currentTick: 12,
      allianceCount: 2,
      healthStatus: "healthy",
      warningCount: 0,
      lastSnapshotAt: "2026-05-21T10:00:02.000Z",
      queuedEventCount: 3,
      commandCount: 5,
      eventCount: 7
    });
  });

  it("renders empty and populated admin monitoring states without placeholders", () => {
    expect(renderInstanceListPage([])).toContain("Žádné instance");

    const html = renderInstanceListPage([
      createAdminInstanceViewModelFromMonitoringSummary({
        instanceId: "instance:admin:render",
        mode: "free",
        status: "running",
        displayName: "Free EU Render",
        region: "eu-central",
        currentTick: 2,
        playerCount: 1,
        allianceCount: 0,
        crashCount: 0,
        healthStatus: "healthy",
        warningCount: 0,
        lastTickStartedAt: null,
        lastTickCompletedAt: null,
        lastErrorAt: null,
        queuedEventCount: 0,
        commandCount: 1,
        eventCount: 2,
        diagnosticErrorCount: 0,
        lastSnapshotAt: null
      })
    ]);

    expect(html).toContain("Free EU Render");
    expect(html).toContain("instance:admin:render");
    expect(html).not.toContain("instance:placeholder");
  });
});
