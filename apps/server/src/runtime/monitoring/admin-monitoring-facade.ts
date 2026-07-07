import type { ServerInstanceManager } from "../server-instance-manager";
import type { InstanceHealthService } from "../orchestration/instance-health-service";
import { createReplayLogReader } from "../persistence/services/replay-log-reader";
import type {
  AlliancePopulationSummary,
  CommandVolumeSummary,
  ErrorSummary,
  InstanceDiagnosticsSummary,
  InstanceHealthSummary,
  InstanceMonitoringSummary,
  InstanceSummary,
  ModeSummary,
  PlayerPopulationSummary,
  QueueSummary,
  SnapshotSummary
} from "@empire/shared-types";
import { createAdminRuntimeDetailProjection } from "./admin-runtime-projection";

/**
 * Responsibility: Read-only admin-facing monitoring facade over instance runtime data.
 * Belongs here: safe access to monitor snapshots and aggregated health summaries.
 * Does not belong here: direct state mutation or gameplay command execution.
 */
export const createAdminMonitoringFacade = (
  instanceManager: ServerInstanceManager,
  healthService: InstanceHealthService
) => {
  const persistence = instanceManager.getPersistenceRepositories();
  const replayLogReader = createReplayLogReader(
    persistence.snapshotRepository,
    persistence.commandLogRepository,
    persistence.eventLogRepository,
    persistence.diagnosticLogRepository
  );

  return {
    listServerSummaries: () => instanceManager.listServerSummaries(),
    listInstances: (): InstanceSummary[] =>
      instanceManager.listInstances().map((runtime) => ({
        instanceId: runtime.record.id,
        mode: runtime.record.mode,
        status: runtime.record.status,
        tick: runtime.state.root.tick,
        playerCount: runtime.state.root.playerIds.length,
        allianceCount: runtime.state.root.allianceIds.length
      })),
    listInstanceMonitoringSummaries: async (): Promise<InstanceMonitoringSummary[]> =>
      Promise.all(instanceManager.listInstances().map(async (runtime) => {
        const snapshot = instanceManager.getInstanceMonitorSnapshot(runtime.record.id);
        const history = await replayLogReader.getInstanceSummary(runtime.record.id);
        const health = instanceManager.getInstanceHealth(runtime.record.id);

        return {
          instanceId: runtime.record.id,
          mode: runtime.record.mode,
          status: runtime.record.status,
          displayName: runtime.lobby.displayName,
          region: runtime.lobby.region,
          currentTick: snapshot?.tick ?? runtime.state.root.tick,
          playerCount: snapshot?.playerCount ?? runtime.state.root.playerIds.length,
          allianceCount: runtime.state.root.allianceIds.length,
          crashCount: snapshot?.crashCount ?? runtime.record.crashCount,
          healthStatus: health?.status ?? "unhealthy",
          warningCount: health?.warnings.length ?? 1,
          lastTickStartedAt: snapshot?.lastTickStartedAt ?? runtime.runtimeHealth.lastTickStartedAt,
          lastTickCompletedAt: snapshot?.lastTickCompletedAt ?? runtime.runtimeHealth.lastTickCompletedAt,
          lastErrorAt: snapshot?.lastErrorAt ?? health?.lastErrorAt ?? history.lastCrashAt,
          queuedEventCount: snapshot?.queuedEventCount ?? runtime.eventQueue.size(),
          commandCount: history.commandVolume,
          eventCount: history.eventVolume,
          diagnosticErrorCount: history.diagnosticErrorCount,
          lastSnapshotAt: history.lastSnapshotAt
        };
      })),
    getModeSummary: (instanceId: string): ModeSummary => {
      const runtime = instanceManager.getInstanceById(instanceId);
      return {
        instanceId,
        mode: runtime?.record.mode ?? "unknown",
        configKey: runtime?.record.configKey ?? "unknown"
      };
    },
    getPlayerPopulationSummary: (instanceId: string): PlayerPopulationSummary => {
      const runtime = instanceManager.getInstanceById(instanceId);
      return {
        instanceId,
        totalPlayers: runtime?.state.root.playerIds.length ?? 0,
        connectedPlayers: runtime?.state.root.playerIds.length ?? 0
      };
    },
    getAlliancePopulationSummary: (instanceId: string): AlliancePopulationSummary => {
      const runtime = instanceManager.getInstanceById(instanceId);
      return {
        instanceId,
        totalAlliances: runtime?.state.root.allianceIds.length ?? 0
      };
    },
    getInstanceHealthSummary: (instanceId: string): InstanceHealthSummary => {
      const health = instanceManager.getInstanceHealth(instanceId);
      return {
        instanceId,
        status: health?.status ?? "unhealthy",
        warnings: health?.warnings ?? ["Instance was not found."],
        lastErrorAt: health?.lastErrorAt ?? null
      };
    },
    getCommandVolumeSummary: async (instanceId: string): Promise<CommandVolumeSummary> => ({
      instanceId,
      totalCommands: (await instanceManager.listCommandRecords(instanceId)).length
    }),
    getErrorSummary: async (instanceId: string): Promise<ErrorSummary> => {
      const diagnostics = await instanceManager.listDiagnosticRecords(instanceId);
      const errorDiagnostics = diagnostics.filter((record) => record.level === "error");
      const lastError = errorDiagnostics
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

      return {
        instanceId,
        errorCount: errorDiagnostics.length,
        lastErrorAt: lastError?.occurredAt ?? instanceManager.getInstanceHealth(instanceId)?.lastErrorAt ?? null
      };
    },
    getDiagnosticsSummary: async (instanceId: string): Promise<InstanceDiagnosticsSummary> => {
      const history = await replayLogReader.getInstanceSummary(instanceId);
      return {
        instanceId,
        lastSnapshotAt: history.lastSnapshotAt,
        snapshotSchemaVersion: history.snapshotSchemaVersion,
        lastCrashAt: history.lastCrashAt,
        diagnosticErrorCount: history.diagnosticErrorCount
      };
    },
    getQueueSummary: (instanceId: string): QueueSummary => {
      const snapshot = instanceManager.getInstanceMonitorSnapshot(instanceId);
      return {
        instanceId,
        queuedEvents: snapshot?.queuedEventCount ?? 0,
        queuedCommands: 0
      };
    },
    getSnapshotSummary: async (instanceId: string): Promise<SnapshotSummary | null> => {
      const history = await replayLogReader.getInstanceSummary(instanceId);
      if (!history.lastSnapshotAt || !history.snapshotSchemaVersion) {
        return null;
      }

      const runtime = instanceManager.getInstanceById(instanceId);
      return {
        snapshotId: `snapshot:${instanceId}:latest`,
        instanceId,
        createdAt: history.lastSnapshotAt,
        tick: runtime?.state.root.tick ?? 0,
        schemaVersion: history.snapshotSchemaVersion
      };
    },
    listRecentCommandRecords: async (instanceId: string, limit = 20) =>
      limitRecords(await instanceManager.listCommandRecords(instanceId), limit),
    listRecentEventRecords: async (instanceId: string, limit = 20) =>
      limitRecords(await instanceManager.listEventRecords(instanceId), limit),
    listRecentDiagnosticRecords: async (instanceId: string, limit = 20) =>
      limitRecords(await instanceManager.listDiagnosticRecords(instanceId), limit),
    listInstanceSnapshots: () =>
      instanceManager
        .listInstances()
        .map((runtime) => instanceManager.getInstanceMonitorSnapshot(runtime.record.id))
        .filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot)),
    getHealthSummary: () => healthService.getSummary(),
    getInstanceHistorySummary: (instanceId: string) => replayLogReader.getInstanceSummary(instanceId),
    getRuntimeDetailProjection: () =>
      createAdminRuntimeDetailProjection(instanceManager.listInstances(), new Date().toISOString())
  };
};

const limitRecords = <TRecord>(records: TRecord[], limit: number): TRecord[] =>
  records.slice(Math.max(0, records.length - Math.max(0, limit)));
