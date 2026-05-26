import { describe, expect, it, vi } from "vitest";
import { createAdminApp } from "../../apps/admin/src/app";

describe("createAdminApp", () => {
  it("renders empty monitoring state without a server facade", async () => {
    const target = { innerHTML: "" } as HTMLElement;

    await createAdminApp({
      fetchMonitoringSummaries: async () => []
    }).mount(target);

    expect(target.innerHTML).toContain("Žádné instance");
    expect(target.innerHTML).not.toContain("instance:placeholder");
  });

  it("renders server facade monitoring rows", async () => {
    const target = { innerHTML: "" } as HTMLElement;

    await createAdminApp({
      fetchMonitoringSummaries: async () => [{
        instanceId: "instance:admin-app:1",
        mode: "free",
        status: "running",
        displayName: "Admin App Server",
        region: "eu-central",
        currentTick: 4,
        playerCount: 2,
        allianceCount: 1,
        crashCount: 0,
        healthStatus: "healthy",
        warningCount: 0,
        lastTickStartedAt: null,
        lastTickCompletedAt: null,
        lastErrorAt: null,
        queuedEventCount: 1,
        commandCount: 3,
        eventCount: 4,
        diagnosticErrorCount: 0,
        lastSnapshotAt: null
      }]
    }).mount(target);

    expect(target.innerHTML).toContain("Admin App Server");
    expect(target.innerHTML).toContain("instance:admin-app:1");
    expect(target.innerHTML).toContain("Recent commands");
  });

  it("renders degraded diagnostics and queue backlog", async () => {
    const target = { innerHTML: "" } as HTMLElement;

    await createAdminApp({
      fetchAdminOverview: async () => ({
        selectedInstanceId: "instance:admin-app:error",
        instances: [{
          instanceId: "instance:admin-app:error",
          mode: "free",
          status: "running",
          displayName: "Error Instance",
          region: "eu-central",
          tick: 12,
          currentTick: 12,
          playerCount: 3,
          allianceCount: 1,
          crashCount: 0,
          healthStatus: "degraded",
          warningCount: 2,
          lastSnapshotAt: "2026-05-21T10:00:00.000Z",
          lastTickStartedAt: "2026-05-21T10:00:01.000Z",
          lastTickCompletedAt: "2026-05-21T10:00:02.000Z",
          totalCommands: 9,
          commandCount: 9,
          eventCount: 4,
          diagnosticErrorCount: 1,
          diagnosticWarningCount: 2,
          lastErrorAt: "2026-05-21T10:00:03.000Z",
          queuedEvents: 7,
          queuedEventCount: 7
        }],
        selectedLogs: {
          instanceId: "instance:admin-app:error",
          commands: [],
          events: [],
          diagnostics: [{
            id: "diagnostic:1",
            instanceId: "instance:admin-app:error",
            level: "error",
            category: "tick",
            message: "Tick failed.",
            occurredAt: "2026-05-21T10:00:03.000Z"
          }]
        }
      })
    }).mount(target);

    expect(target.innerHTML).toContain("Error Instance");
    expect(target.innerHTML).toContain("degraded");
    expect(target.innerHTML).toContain("warn 2");
    expect(target.innerHTML).toContain("<td>7</td>");
    expect(target.innerHTML).toContain("Tick failed.");
  });

  it("renders recent command and event logs for the selected instance", async () => {
    const target = { innerHTML: "" } as HTMLElement;

    await createAdminApp({
      fetchAdminOverview: async () => ({
        selectedInstanceId: "instance:admin-app:logs",
        instances: [{
          instanceId: "instance:admin-app:logs",
          mode: "free",
          status: "running",
          displayName: "Log Instance",
          region: "eu-central",
          tick: 3,
          currentTick: 3,
          playerCount: 1,
          allianceCount: 0,
          crashCount: 0,
          healthStatus: "healthy",
          warningCount: 0,
          lastSnapshotAt: null,
          lastTickStartedAt: null,
          lastTickCompletedAt: null,
          totalCommands: 1,
          commandCount: 1,
          eventCount: 1,
          diagnosticErrorCount: 0,
          diagnosticWarningCount: 0,
          lastErrorAt: null,
          queuedEvents: 0,
          queuedEventCount: 0
        }],
        selectedLogs: {
          instanceId: "instance:admin-app:logs",
          commands: [{
            id: "command-log:1",
            instanceId: "instance:admin-app:logs",
            commandId: "command:admin:1",
            commandType: "collect-production",
            actorId: "player:admin",
            receivedAt: "2026-05-21T10:00:00.000Z",
            tickAtReceive: 3
          }],
          events: [{
            id: "event-log:1",
            instanceId: "instance:admin-app:logs",
            eventType: "production-collected",
            causedByCommandId: "command:admin:1",
            recordedAt: "2026-05-21T10:00:01.000Z",
            tickAtEmit: 3
          }],
          diagnostics: []
        }
      })
    }).mount(target);

    expect(target.innerHTML).toContain("collect-production");
    expect(target.innerHTML).toContain("command:admin:1");
    expect(target.innerHTML).toContain("production-collected");
  });

  it("sends an admin monitoring token header when configured", async () => {
    const target = { innerHTML: "" } as HTMLElement;
    const previousFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        accepted: true,
        overview: {
          selectedInstanceId: null,
          instances: [],
          selectedLogs: {
            instanceId: null,
            commands: [],
            events: [],
            diagnostics: []
          }
        },
        errors: []
      })
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    try {
      await createAdminApp({
        adminMonitoringToken: "configured-admin-token"
      }).mount(target);
    } finally {
      globalThis.fetch = previousFetch;
    }

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/monitoring", {
      headers: {
        accept: "application/json",
        "x-empire-admin-token": "configured-admin-token"
      }
    });
  });
});
