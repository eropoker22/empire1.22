import type { AdminRuntimeDetailProjection } from "@empire/shared-types";
import { resolvePlayerOperationalLiveness } from "@empire/game-core";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { sanitizeAdminMonitoringText } from "./admin-monitoring-sanitizer";

export const createAdminLivenessProjection = (
  runtimes: ServerInstanceRuntime[]
): AdminRuntimeDetailProjection["liveness"] => {
  const views = runtimes.flatMap((runtime) => runtime.state.root.playerIds
    .map((playerId) => ({
      playerId,
      status: runtime.state.playersById[playerId]?.status,
      view: resolvePlayerOperationalLiveness(runtime.state, playerId, { config: runtime.config })
    }))
    .filter((entry) => entry.status === "active"));
  const stateCounts: Record<string, number> = {};
  const blockingReasonCounts: Record<string, number> = {};
  for (const entry of views) {
    stateCounts[entry.view.state] = (stateCounts[entry.view.state] || 0) + 1;
    for (const reason of entry.view.blockingReasons) {
      blockingReasonCounts[reason] = (blockingReasonCounts[reason] || 0) + 1;
    }
  }
  return {
    activePlayers: views.length,
    playablePlayers: views.filter((entry) => entry.view.canProgressNow).length,
    temporarilySealedPlayers: stateCounts.temporarily_sealed || 0,
    encircledPlayers: (stateCounts.hostile_encircled || 0) + (stateCounts.allied_encircled || 0) + (stateCounts.mixed_encircled || 0),
    lastStandPlayers: stateCounts.last_stand || 0,
    emergencyRecoveryEligiblePlayers: views.filter((entry) => entry.view.emergencyRecovery.canClaim).length,
    invalidSoftlocks: views.filter((entry) => entry.view.invalidInvariant).length,
    stateCounts,
    blockingReasonCounts,
    invalidPlayerIds: views.filter((entry) => entry.view.invalidInvariant).map((entry) => sanitizeAdminMonitoringText(entry.playerId))
  };
};
