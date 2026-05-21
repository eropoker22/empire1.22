import type { ServerApp } from "../app/server-app";

export const createAdminMonitoringPayload = async (server: ServerApp) => {
  const summaries = await server.adminMonitoring.listInstanceMonitoringSummaries();
  const selectedInstanceId = summaries[0]?.instanceId ?? null;

  return {
    accepted: true,
    instances: summaries,
    overview: {
      instances: summaries.map((summary) => ({
        instanceId: summary.instanceId,
        mode: summary.mode,
        status: summary.status,
        displayName: summary.displayName,
        region: summary.region,
        tick: summary.currentTick,
        currentTick: summary.currentTick,
        playerCount: summary.playerCount,
        allianceCount: summary.allianceCount,
        crashCount: summary.crashCount,
        healthStatus: summary.healthStatus,
        warningCount: summary.warningCount,
        lastSnapshotAt: summary.lastSnapshotAt,
        lastTickStartedAt: summary.lastTickStartedAt,
        lastTickCompletedAt: summary.lastTickCompletedAt,
        totalCommands: summary.commandCount,
        commandCount: summary.commandCount,
        eventCount: summary.eventCount,
        diagnosticErrorCount: summary.diagnosticErrorCount,
        diagnosticWarningCount: 0,
        lastErrorAt: summary.lastErrorAt,
        queuedEvents: summary.queuedEventCount,
        queuedEventCount: summary.queuedEventCount
      })),
      selectedInstanceId,
      selectedLogs: selectedInstanceId
        ? await createSelectedLogs(server, selectedInstanceId)
        : {
            instanceId: null,
            commands: [],
            events: [],
            diagnostics: []
          }
    },
    errors: []
  };
};

const createSelectedLogs = async (
  server: ServerApp,
  instanceId: string
) => {
  const [commands, events, diagnostics] = await Promise.all([
    server.adminMonitoring.listRecentCommandRecords(instanceId, 5),
    server.adminMonitoring.listRecentEventRecords(instanceId, 5),
    server.adminMonitoring.listRecentDiagnosticRecords(instanceId, 5)
  ]);

  return {
    instanceId,
    commands: commands.map((record) => ({
      id: record.id,
      instanceId: record.instanceId,
      commandId: record.command.id,
      commandType: record.command.type,
      actorId: record.actorId,
      receivedAt: record.receivedAt,
      tickAtReceive: record.tickAtReceive
    })),
    events: events.map((record) => ({
      id: record.id,
      instanceId: record.instanceId,
      eventType: record.event.type,
      causedByCommandId: record.causedByCommandId,
      recordedAt: record.recordedAt,
      tickAtEmit: record.tickAtEmit
    })),
    diagnostics: diagnostics.map((record) => ({
      id: record.id,
      instanceId: record.instanceId,
      level: record.level,
      category: record.category,
      message: record.message,
      occurredAt: record.occurredAt
    }))
  };
};
