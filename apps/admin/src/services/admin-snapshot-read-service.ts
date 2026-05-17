import type { SnapshotSummary } from "@empire/shared-types";

/**
 * Responsibility: Admin read service for snapshot metadata and history summaries.
 * Belongs here: read-only snapshot summary access for monitoring screens.
 * Does not belong here: snapshot creation or restore control logic.
 */
export interface AdminSnapshotReadService {
  getSnapshotSummary(instanceId: string): Promise<SnapshotSummary | null>;
}

export interface AdminSnapshotReadFacade {
  getSnapshotSummary(instanceId: string): Promise<SnapshotSummary | null>;
}

export const createAdminSnapshotReadService = (options: {
  facade?: AdminSnapshotReadFacade;
} = {}): AdminSnapshotReadService => ({
  getSnapshotSummary: async (instanceId) => options.facade?.getSnapshotSummary(instanceId) ?? null
});
