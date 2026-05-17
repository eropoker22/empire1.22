import type { CommandVolumeSummary, ErrorSummary } from "@empire/shared-types";

export interface AdminCommandLogEntry {
  id: string;
  instanceId: string;
  commandId: string;
  commandType: string;
  actorId: string;
  receivedAt: string;
  tickAtReceive: number;
}

export interface AdminEventLogEntry {
  id: string;
  instanceId: string;
  eventType: string;
  causedByCommandId: string | null;
  recordedAt: string;
  tickAtEmit: number;
}

/**
 * Responsibility: Admin read service for command volume and error summary data.
 * Belongs here: read-only access to log-derived summaries.
 * Does not belong here: raw log storage or gameplay logic.
 */
export interface AdminLogReadService {
  getCommandVolumeSummary(instanceId: string): Promise<CommandVolumeSummary>;
  getErrorSummary(instanceId: string): Promise<ErrorSummary>;
  listRecentCommandLogs(instanceId: string, limit?: number): Promise<AdminCommandLogEntry[]>;
  listRecentEventLogs(instanceId: string, limit?: number): Promise<AdminEventLogEntry[]>;
}

export interface AdminLogReadFacade {
  getCommandVolumeSummary(instanceId: string): Promise<CommandVolumeSummary>;
  getErrorSummary(instanceId: string): Promise<ErrorSummary>;
  listRecentCommandRecords(instanceId: string, limit?: number): Promise<Array<{
    id: string;
    instanceId: string;
    command: {
      id: string;
      type: string;
    };
    actorId: string;
    receivedAt: string;
    tickAtReceive: number;
  }>>;
  listRecentEventRecords(instanceId: string, limit?: number): Promise<Array<{
    id: string;
    instanceId: string;
    event: {
      type: string;
    };
    causedByCommandId: string | null;
    recordedAt: string;
    tickAtEmit: number;
  }>>;
}

export const createAdminLogReadService = (options: {
  facade?: AdminLogReadFacade;
} = {}): AdminLogReadService => ({
  getCommandVolumeSummary: async (instanceId) => options.facade?.getCommandVolumeSummary(instanceId) ?? ({
    instanceId,
    totalCommands: 0
  }),
  getErrorSummary: async (instanceId) => options.facade?.getErrorSummary(instanceId) ?? ({
    instanceId,
    errorCount: 0,
    lastErrorAt: null
  }),
  listRecentCommandLogs: async (instanceId, limit) =>
    (await options.facade?.listRecentCommandRecords(instanceId, limit) ?? []).map((record) => ({
      id: record.id,
      instanceId: record.instanceId,
      commandId: record.command.id,
      commandType: record.command.type,
      actorId: record.actorId,
      receivedAt: record.receivedAt,
      tickAtReceive: record.tickAtReceive
    })),
  listRecentEventLogs: async (instanceId, limit) =>
    (await options.facade?.listRecentEventRecords(instanceId, limit) ?? []).map((record) => ({
      id: record.id,
      instanceId: record.instanceId,
      eventType: record.event.type,
      causedByCommandId: record.causedByCommandId,
      recordedAt: record.recordedAt,
      tickAtEmit: record.tickAtEmit
    }))
});
