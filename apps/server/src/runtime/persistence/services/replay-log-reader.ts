import type { ServerInstanceId } from "@empire/shared-types";
import type { AdminInstanceHistorySummary } from "../dto";
import type {
  CommandLogRepository,
  DiagnosticLogRepository,
  EventLogRepository,
  SnapshotRepository
} from "../repositories";

/**
 * Responsibility: Reads audit history and admin-facing summaries from separated persistence streams.
 * Belongs here: replay/debug/admin read access over stored records.
 * Does not belong here: runtime logging or gameplay state mutation.
 */
export interface ReplayLogReader {
  getInstanceSummary(instanceId: ServerInstanceId): Promise<AdminInstanceHistorySummary>;
}

export const createReplayLogReader = (
  snapshotRepository: SnapshotRepository,
  commandLogRepository: CommandLogRepository,
  eventLogRepository: EventLogRepository,
  diagnosticLogRepository: DiagnosticLogRepository
): ReplayLogReader => ({
  getInstanceSummary: async (instanceId) => {
    const [snapshot, commands, events, diagnostics] = await Promise.all([
      snapshotRepository.loadLatest(instanceId),
      commandLogRepository.listByInstance(instanceId),
      eventLogRepository.listByInstance(instanceId),
      diagnosticLogRepository.listByInstance(instanceId)
    ]);

    const lastCrash = diagnostics
      .filter((record) => record.category === "crash")
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

    return {
      instanceId,
      lastSnapshotAt: snapshot?.createdAt ?? null,
      snapshotSchemaVersion: snapshot?.version.schemaVersion ?? null,
      commandVolume: commands.length,
      eventVolume: events.length,
      diagnosticErrorCount: diagnostics.filter((record) => record.level === "error").length,
      lastCrashAt: lastCrash?.occurredAt ?? null
    };
  }
});

