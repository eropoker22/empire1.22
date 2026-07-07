import { describe, expect, it } from "vitest";
import {
  createAdminDashboardReadModel,
  createAdminInstanceViewModelFromMonitoringSummary,
  createAdminOverviewViewModel
} from "../../apps/admin/src/read-models";
import { renderInstanceListPage } from "../../apps/admin/src/pages/instance-list-page";

describe("admin operations console", () => {
  it("builds a read-only operations model without inferring live gameplay authority", () => {
    const overview = createOverview();
    const model = createAdminDashboardReadModel(overview, {
      generatedAt: "2026-07-07T10:00:00.000Z"
    });

    expect(model.environment.label).toBe("DEMO SAMPLE");
    expect(model.projectionSource).toBe("demo-sample");
    expect(model.servers).toEqual([
      expect.objectContaining({
        serverInstanceId: "instance:ops:free",
        runtimeMarker: "sample projection",
        phase: "live",
        districtCount: 64,
        activeOrdersCount: 2
      })
    ]);
    expect(model.orders).toEqual([
      expect.objectContaining({
        id: "sample:order:spy",
        type: "spy",
        remainingLabel: "0:30"
      }),
      expect.objectContaining({
        id: "sample:order:attack",
        type: "attack",
        remainingLabel: "21:30"
      })
    ]);
    expect(model.economy.marketRiskNotes.join(" ")).toContain("No grants");
    expect(model.presetDraft.draftOnly).toBe(true);
    expect(model.lockedControls.every((control) => control.auditLogRequired && control.rollbackRequired)).toBe(true);
  });

  it("renders locked write controls, disabled message send, and exportable preset JSON", () => {
    const html = renderInstanceListPage(createOverview());

    expect(html).toContain("Operations Console v1");
    expect(html).toContain("Future Controls / Locked");
    expect(html).toContain("data-admin-locked-control=\"grant-resources\"");
    expect(html).toContain("data-admin-message-send");
    expect(html).toMatch(/<button[^>]*disabled[^>]*data-admin-message-send/);
    expect(html).toContain("Apply to live server locked");
    expect(html).toContain("Recent commands");
    expect(html).toContain("WAR CLOSED");

    const href = html.match(/download="empire-server-preset-draft\.json" href="([^"]+)"/)?.[1];
    expect(href).toBeTruthy();
    const json = decodeURIComponent(href!.replace("data:application/json;charset=utf-8,", ""));
    expect(JSON.parse(json)).toMatchObject({
      name: "Free demo staging preset",
      draftOnly: true,
      startingPopulation: 250,
      heatStart: 50
    });
  });

  it("redacts secret-like diagnostic values before rendering", () => {
    const html = renderInstanceListPage(createOverview({
      diagnosticMessage: "worker failed sessionToken=abc123 postgres://user:pass@example/db"
    }));

    expect(html).not.toContain("abc123");
    expect(html).not.toContain("user:pass@example");
    expect(html).toContain("sessionToken=[redacted]");
    expect(html).toContain("postgres://[redacted]");
  });
});

const createOverview = (options: {
  diagnosticMessage?: string;
} = {}) => createAdminOverviewViewModel([
  createAdminInstanceViewModelFromMonitoringSummary({
    instanceId: "instance:ops:free",
    mode: "free",
    status: "running",
    displayName: "Free Ops",
    region: "eu-central",
    currentTick: 42,
    playerCount: 3,
    allianceCount: 1,
    crashCount: 0,
    healthStatus: "healthy",
    warningCount: 0,
    lastTickStartedAt: "2026-07-07T09:59:55.000Z",
    lastTickCompletedAt: "2026-07-07T10:00:00.000Z",
    lastErrorAt: null,
    queuedEventCount: 0,
    commandCount: 2,
    eventCount: 1,
    diagnosticErrorCount: 0,
    lastSnapshotAt: "2026-07-07T09:58:00.000Z"
  })
], {
  serverSummaries: [{
    serverInstanceId: "instance:ops:free",
    displayName: "Free Ops",
    mode: "free",
    region: "eu-central",
    status: "running",
    playerCount: 3,
    maxPlayers: 64,
    joinPolicy: "open",
    startedAt: "2026-07-07T09:50:00.000Z",
    createdAt: "2026-07-07T09:49:00.000Z",
    tick: 42,
    joinable: true,
    phase: "live",
    map: {
      totalDistricts: 64,
      downtownDistricts: 8,
      commercialDistricts: 16,
      industrialDistricts: 16,
      residentialDistricts: 18,
      parkDistricts: 6
    }
  }],
  selectedLogs: {
    instanceId: "instance:ops:free",
    commands: [{
      id: "command-log:spy:1",
      instanceId: "instance:ops:free",
      commandId: "command:spy:1",
      commandType: "spy-district",
      actorId: "player:ops",
      correlationId: "corr:spy:1",
      receivedAt: "2026-07-07T09:59:00.000Z",
      tickAtReceive: 42,
      status: "recorded"
    }, {
      id: "command-log:collect:1",
      instanceId: "instance:ops:free",
      commandId: "command:collect:1",
      commandType: "collect-production",
      actorId: "player:ops",
      correlationId: "corr:collect:1",
      receivedAt: "2026-07-07T09:59:10.000Z",
      tickAtReceive: 42,
      status: "recorded"
    }],
    events: [{
      id: "event-log:1",
      instanceId: "instance:ops:free",
      eventType: "spy-mission-started",
      causedByCommandId: "command:spy:1",
      recordedAt: "2026-07-07T09:59:01.000Z",
      tickAtEmit: 42
    }],
    diagnostics: [{
      id: "diagnostic-log:1",
      instanceId: "instance:ops:free",
      level: "info",
      category: "runtime",
      message: options.diagnosticMessage ?? "Instance healthy.",
      occurredAt: "2026-07-07T09:59:30.000Z"
    }]
  }
});
