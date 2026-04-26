import type { ServerInstanceManager } from "../server-instance-manager";
import type { InstanceHealthService } from "../orchestration/instance-health-service";
import { createReplayLogReader } from "../persistence/services/replay-log-reader";
import {
  createNullCommandLogRepository,
  createNullDiagnosticLogRepository,
  createNullEventLogRepository,
  createNullSnapshotRepository
} from "../persistence/repositories";

/**
 * Responsibility: Read-only admin-facing monitoring facade over instance runtime data.
 * Belongs here: safe access to monitor snapshots and aggregated health summaries.
 * Does not belong here: direct state mutation or gameplay command execution.
 */
export const createAdminMonitoringFacade = (
  instanceManager: ServerInstanceManager,
  healthService: InstanceHealthService
) => {
  const replayLogReader = createReplayLogReader(
    createNullSnapshotRepository(),
    createNullCommandLogRepository(),
    createNullEventLogRepository(),
    createNullDiagnosticLogRepository()
  );

  return {
    listInstanceSnapshots: () =>
      instanceManager
        .listInstances()
        .map((runtime) => instanceManager.getInstanceMonitorSnapshot(runtime.record.id))
        .filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot)),
    getHealthSummary: () => healthService.getSummary(),
    getInstanceHistorySummary: (instanceId: string) => replayLogReader.getInstanceSummary(instanceId)
  };
};
