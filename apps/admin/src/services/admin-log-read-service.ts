import type { CommandVolumeSummary, ErrorSummary } from "@empire/shared-types";

/**
 * Responsibility: Admin read service for command volume and error summary data.
 * Belongs here: read-only access to log-derived summaries.
 * Does not belong here: raw log storage or gameplay logic.
 */
export interface AdminLogReadService {
  getCommandVolumeSummary(instanceId: string): Promise<CommandVolumeSummary>;
  getErrorSummary(instanceId: string): Promise<ErrorSummary>;
}

export const createAdminLogReadService = (): AdminLogReadService => ({
  getCommandVolumeSummary: async (instanceId) => ({
    instanceId,
    totalCommands: 0
  }),
  getErrorSummary: async (instanceId) => ({
    instanceId,
    errorCount: 0,
    lastErrorAt: null
  })
});

