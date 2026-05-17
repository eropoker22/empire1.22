import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import {
  createAdminDiagnosticsReadService,
  createAdminInstanceReadService,
  createAdminLogReadService,
  createAdminSnapshotReadService
} from "../../apps/admin/src/services";

describe("admin read services", () => {
  it("keeps fallback placeholder behavior when no facade is provided", async () => {
    const instanceService = createAdminInstanceReadService();
    const logService = createAdminLogReadService();
    const diagnosticsService = createAdminDiagnosticsReadService();
    const snapshotService = createAdminSnapshotReadService();

    expect(await instanceService.listInstances()).toEqual([]);
    expect(await logService.getCommandVolumeSummary("instance:missing")).toEqual({
      instanceId: "instance:missing",
      totalCommands: 0
    });
    expect(await diagnosticsService.getDiagnosticsSummary("instance:missing")).toEqual({
      instanceId: "instance:missing",
      lastSnapshotAt: null,
      snapshotSchemaVersion: null,
      lastCrashAt: null,
      diagnosticErrorCount: 0
    });
    expect(await snapshotService.getSnapshotSummary("instance:missing")).toBeNull();
  });

  it("reads real server runtime data through injected facades", async () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:admin-service", "free");

    server.instanceManager.startInstance(runtime.record.id);

    const instanceService = createAdminInstanceReadService({
      facade: server.adminMonitoring
    });
    const logService = createAdminLogReadService({
      facade: server.adminMonitoring
    });
    const diagnosticsService = createAdminDiagnosticsReadService({
      facade: server.adminMonitoring
    });

    expect(await instanceService.listInstances()).toEqual([
      expect.objectContaining({
        instanceId: runtime.record.id,
        status: "running"
      })
    ]);
    expect(await instanceService.getHealthSummary(runtime.record.id)).toMatchObject({
      instanceId: runtime.record.id,
      status: "healthy"
    });
    expect(await logService.getCommandVolumeSummary(runtime.record.id)).toEqual({
      instanceId: runtime.record.id,
      totalCommands: 0
    });
    expect(await diagnosticsService.listRecentDiagnosticLogs(runtime.record.id)).toEqual([
      expect.objectContaining({
        instanceId: runtime.record.id,
        level: "info",
        message: "Instance started."
      })
    ]);
  });
});
