import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap";
import { sharedCitySpawnDistrictIds } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import {
  createAttackDistrictCommandFixture,
  createSelectSpawnDistrictCommandFixture
} from "../fixtures/command-fixtures";

describe("admin monitoring facade", () => {
  it("returns an empty monitoring list when no runtime instances exist", async () => {
    const server = createServerApp();

    await expect(server.adminMonitoring.listInstanceMonitoringSummaries()).resolves.toEqual([]);
  });

  it("reads real instance status and tick data from server runtime", async () => {
    const server = createServerApp();
    const request = {
      serverInstanceId: "instance:free-admin-facade-list",
      playerId: "player:admin-facade-list",
      districtId: "district:admin-facade-list"
    };

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const beforeTick = server.adminMonitoring.listInstances()[0];
    server.instanceManager.tickInstance(request.serverInstanceId);
    const afterTick = server.adminMonitoring.listInstances()[0];

    expect(beforeTick).toMatchObject({
      instanceId: request.serverInstanceId,
      mode: "free",
      status: "running",
      tick: 0,
      playerCount: 1,
      allianceCount: 0
    });
    expect(afterTick?.tick).toBe(1);
  });

  it("builds admin monitoring rows from real runtime, health, queue, and log history", async () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:admin-monitoring-row", "free", {
      displayName: "Admin Monitoring Row",
      region: "eu-central",
      capacity: 64
    });

    server.instanceManager.startInstance(runtime.record.id);
    server.instanceManager.tickInstance(runtime.record.id);
    runtime.eventQueue.enqueue({ type: "test-event" });

    const rows = await server.adminMonitoring.listInstanceMonitoringSummaries();

    expect(rows).toEqual([
      expect.objectContaining({
        instanceId: runtime.record.id,
        mode: "free",
        status: "running",
        displayName: "Admin Monitoring Row",
        region: "eu-central",
        currentTick: 1,
        playerCount: 0,
        crashCount: 0,
        commandCount: 0,
        eventCount: 0,
        diagnosticErrorCount: 0,
        lastErrorAt: null
      })
    ]);
    expect(rows[0]?.queuedEventCount).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.lastTickStartedAt).toEqual(expect.any(String));
    expect(rows[0]?.lastTickCompletedAt).toEqual(expect.any(String));
  });


  it("reads command volume and event logs after successful command dispatch", async () => {
    const server = createServerApp();
    const request = {
      serverInstanceId: "instance:free-admin-facade-command",
      playerId: "player:admin-facade-command",
      districtId: "district:admin-facade-command"
    };

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const spawnDistrictId = sharedCitySpawnDistrictIds[0] ?? "district:1";
    const response = await server.instanceManager.dispatchCommand(
      request.serverInstanceId,
      createSelectSpawnDistrictCommandFixture({
        id: "command:admin-facade:spawn:1",
        playerId: request.playerId,
        serverInstanceId: request.serverInstanceId,
        payload: {
          districtId: spawnDistrictId
        }
      })
    );

    const commandVolume = await server.adminMonitoring.getCommandVolumeSummary(request.serverInstanceId);
    const events = await server.adminMonitoring.listRecentEventRecords(request.serverInstanceId);

    expect(response?.errors ?? []).toEqual([]);
    expect(commandVolume.totalCommands).toBe(1);
    expect(events).toContainEqual(expect.objectContaining({
      instanceId: request.serverInstanceId,
      causedByCommandId: "command:admin-facade:spawn:1",
      tickAtEmit: 0
    }));
  });

  it("surfaces rejected commands and lifecycle diagnostics in summaries and recent logs", async () => {
    const server = createServerApp();
    const runtime = server.instanceManager.createInstance("instance:admin-facade-diagnostics", "free");

    server.instanceManager.startInstance(runtime.record.id);
    server.instanceManager.pauseInstance(runtime.record.id);
    server.instanceManager.stopInstance(runtime.record.id);
    await server.instanceManager.dispatchCommand(
      runtime.record.id,
      createAttackDistrictCommandFixture({
        serverInstanceId: "instance:other"
      })
    );

    const diagnostics = await server.adminMonitoring.listRecentDiagnosticRecords(runtime.record.id);
    const summary = await server.adminMonitoring.getDiagnosticsSummary(runtime.record.id);

    expect(diagnostics.map((record) => record.message)).toEqual([
      "Instance started.",
      "Instance paused.",
      "Stop triggered snapshot save.",
      "Command rejected."
    ]);
    expect(diagnostics.at(-1)).toMatchObject({
      level: "warn",
      category: "command_rejected"
    });
    expect(summary.diagnosticErrorCount).toBe(0);
  });

  it("summarizes total, running, and crashed instances", () => {
    const server = createServerApp();
    const running = server.instanceManager.createInstance("instance:admin-running", "free");
    const crashed = server.instanceManager.createInstance("instance:admin-crashed", "free");

    server.instanceManager.startInstance(running.record.id);
    crashed.record.status = "crashed";

    expect(server.adminMonitoring.getHealthSummary()).toEqual({
      totalInstances: 2,
      runningInstances: 1,
      crashedInstances: 1
    });
  });
});
