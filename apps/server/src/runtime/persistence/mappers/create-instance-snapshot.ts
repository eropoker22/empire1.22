import type { ServerInstanceRuntime } from "../../instance";
import type { InstanceSnapshotDto } from "../dto";

/**
 * Responsibility: Converts runtime state into a persistence-safe snapshot DTO.
 * Belongs here: pure mapping from authoritative instance runtime to stored snapshot shape.
 * Does not belong here: repository calls or gameplay logic.
 */
export const createInstanceSnapshot = (runtime: ServerInstanceRuntime): InstanceSnapshotDto => ({
  snapshotId: `snapshot:${runtime.record.id}:${runtime.state.root.tick}`,
  instanceId: runtime.record.id,
  createdAt: runtime.clock.nowIso(),
  tick: runtime.state.root.tick,
  mode: runtime.record.mode,
  metadata: {
    instanceId: runtime.record.id,
    mode: runtime.record.mode,
    configKey: runtime.record.configKey,
    status: runtime.record.status,
    createdAt: runtime.record.createdAt,
    startedAt: runtime.record.startedAt,
    stoppedAt: runtime.record.stoppedAt,
    crashCount: runtime.record.crashCount,
    lastCrashAt: runtime.runtimeHealth.lastErrorAt,
    version: runtime.record.version
  },
  version: {
    schemaVersion: 1,
    coreVersion: "1",
    configVersion: runtime.config.mode
  },
  integrity: {
    entityCounts: {
      players: Object.keys(runtime.state.playersById).length,
      alliances: Object.keys(runtime.state.alliancesById).length,
      districts: Object.keys(runtime.state.districtsById).length,
      buildings: Object.keys(runtime.state.buildingsById).length
    },
    rootVersion: runtime.state.root.version
  },
  runtime: {
    processedCommandIds: [...runtime.processedCommandIds],
    commandRateLimitWindow: {
      tick: runtime.commandRateLimitWindow.tick,
      commandCountsByPlayerId: {
        ...runtime.commandRateLimitWindow.commandCountsByPlayerId
      }
    }
  },
  state: runtime.state
});
