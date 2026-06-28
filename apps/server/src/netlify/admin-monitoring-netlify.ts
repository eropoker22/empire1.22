import type { DomainError } from "@empire/shared-types";
import type { ServerApp } from "../app/server-app";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";

export const ADMIN_MONITORING_SECRET_HEADER = "x-empire-admin-secret";

export interface AdminMonitoringAccessRequest {
  headers?: Record<string, string | string[] | undefined>;
}

export interface AdminMonitoringAccessResult {
  accepted: boolean;
  statusCode: number;
  errors: DomainError[];
}

export const handleAdminMonitoringNetlifyRequest = async (
  server: ServerApp,
  request: AdminMonitoringAccessRequest,
  environment?: Record<string, string | undefined>
): Promise<NetlifyFunctionResponse> => {
  const adminAccess = validateAdminMonitoringAccess(request, environment);
  return adminAccess.accepted
    ? createJsonResponse(200, await createAdminMonitoringPayload(server))
    : createJsonResponse(adminAccess.statusCode, createAdminMonitoringErrorResponse(adminAccess.errors));
};

export const validateAdminMonitoringAccess = (
  request: AdminMonitoringAccessRequest,
  environment: Record<string, string | undefined> = readProcessEnvironment()
): AdminMonitoringAccessResult => {
  const configuredSecret = readAdminMonitoringSecret(environment);
  const isProduction = environment.NODE_ENV === "production";

  if (!configuredSecret) {
    return isProduction
      ? createUnauthorizedAdminMonitoringResult()
      : {
          accepted: true,
          statusCode: 200,
          errors: []
        };
  }

  const requestSecret = readHeader(request.headers, ADMIN_MONITORING_SECRET_HEADER)?.trim() ?? "";
  return timingSafeEquals(requestSecret, configuredSecret)
    ? {
        accepted: true,
        statusCode: 200,
        errors: []
      }
    : createUnauthorizedAdminMonitoringResult();
};

export const createAdminMonitoringPayload = async (server: ServerApp) => {
  const summaries = await server.adminMonitoring.listInstanceMonitoringSummaries();
  const serverSummaries = server.adminMonitoring.listServerSummaries();
  const healthSummary = server.adminMonitoring.getHealthSummary();
  const selectedInstanceId = summaries[0]?.instanceId ?? null;
  const [selectedHealth, selectedDiagnostics, selectedLogs] = selectedInstanceId
    ? await Promise.all([
        Promise.resolve(server.adminMonitoring.getInstanceHealthSummary(selectedInstanceId)),
        server.adminMonitoring.getDiagnosticsSummary(selectedInstanceId),
        createSelectedLogs(server, selectedInstanceId)
      ])
    : [null, null, {
        instanceId: null,
        commands: [],
        events: [],
        diagnostics: []
      }];

  return {
    accepted: true,
    instances: summaries,
    serverSummaries,
    healthSummary,
    overview: {
      serverSummaries,
      healthSummary,
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
      selectedHealth,
      selectedDiagnostics,
      selectedLogs
    },
    errors: []
  };
};

const readAdminMonitoringSecret = (
  environment: Record<string, string | undefined>
): string | null =>
  environment.EMPIRE_ADMIN_SECRET?.trim()
    || null;

const readHeader = (
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
): string | null => {
  const target = name.toLowerCase();
  const entry = Object.entries(headers ?? {})
    .find(([headerName]) => headerName.toLowerCase() === target)?.[1];

  if (Array.isArray(entry)) {
    return entry[0] ?? null;
  }

  return entry ?? null;
};

const createUnauthorizedAdminMonitoringResult = (): AdminMonitoringAccessResult => ({
  accepted: false,
  statusCode: 403,
  errors: [
    {
      code: "transport.admin_monitoring_unauthorized",
      message: "Admin monitoring is unavailable."
    }
  ]
});

const createAdminMonitoringErrorResponse = (
  errors: DomainError[]
) => ({
  accepted: false,
  readModel: null,
  errors
});

const timingSafeEquals = (left: string, right: string): boolean => {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
};

const readProcessEnvironment = (): Record<string, string | undefined> =>
  (globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  }).process?.env ?? {};

const createSelectedLogs = async (
  server: ServerApp,
  instanceId: string
) => {
  const [commands, events, diagnostics] = await Promise.all([
    server.adminMonitoring.listRecentCommandRecords(instanceId, 20),
    server.adminMonitoring.listRecentEventRecords(instanceId, 20),
    server.adminMonitoring.listRecentDiagnosticRecords(instanceId, 20)
  ]);

  return {
    instanceId,
    commands: commands.map((record) => ({
      id: record.id,
      instanceId: record.instanceId,
      commandId: record.command.id,
      commandType: record.command.type,
      actorId: record.actorId,
      correlationId: record.correlationId,
      receivedAt: record.receivedAt,
      tickAtReceive: record.tickAtReceive,
      status: "recorded"
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
      occurredAt: record.occurredAt,
      commandId: typeof record.context.commandId === "string" ? record.context.commandId : null,
      correlationId: typeof record.context.correlationId === "string" ? record.context.correlationId : null
    }))
  };
};
