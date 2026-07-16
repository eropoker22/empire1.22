import type { AdminInstanceDetailView, AdminInstanceSummaryView } from "@empire/shared-types";
import type { InMemoryAdminRepositorySeed } from "../../apps/server/src/admin/read-only";

export const createAdminReadOnlySeed = (): InMemoryAdminRepositorySeed => {
  const detailA = detail("server:A", 2, 10, 20, 5);
  const detailB = detail("server:B", 5, 30, 80, 14);
  return { instances: [detailA.summary, detailB.summary], details: [detailA, detailB] };
};

const detail = (id: string, playerCount: number, districtCount: number, heat: number, commandCount: number): AdminInstanceDetailView => {
  const summary = instanceSummary(id, playerCount);
  return {
    serverInstanceId: id, generatedAt: NOW, summary, freshness: summary.freshness, runtimeAvailable: id === "server:A",
    players: Array.from({ length: playerCount }, (_, index) => ({
      serverInstanceId: id, playerId: `${id}:player:${index}`, displayName: `${id} Player ${index}`, factionId: "faction:test",
      status: "active", homeDistrictId: `${id}:district:0`, ownedDistrictCount: Math.floor(districtCount / playerCount),
      cash: id === "server:A" ? 100 : 900, dirtyCash: 0, population: 100, heat, wantedLevel: heat >= 40 ? 2 : 0, lastActionAt: NOW
    })),
    districts: Array.from({ length: districtCount }, (_, index) => ({
      serverInstanceId: id, districtId: `${id}:district:${index}`, name: `${id} District ${index}`, zone: "residential",
      status: "active", ownerPlayerId: `${id}:player:${index % playerCount}`, influence: 10, heat, buildingCount: 1
    })),
    economy: { serverInstanceId: id, totalCleanCash: id === "server:A" ? 200 : 4_500, totalDirtyCash: 0, totalResources: { cash: id === "server:A" ? 200 : 4_500 } },
    production: { serverInstanceId: id, productionBuildingCount: districtCount, readyToCollectCount: id === "server:A" ? 1 : 7, activeCraftCount: 0, storageFullCount: 0 },
    police: { serverInstanceId: id, heatPressure: heat >= 40 ? "medium" : "low", maxPlayerHeat: heat, wantedPlayerCount: heat >= 40 ? playerCount : 0, pendingRaidCount: 0 },
    liveness: { serverInstanceId: id, activePlayers: playerCount, playablePlayers: playerCount, temporarilySealedPlayers: 0,
      encircledPlayers: 0, lastStandPlayers: 0, emergencyRecoveryEligiblePlayers: 0, invalidSoftlocks: 0 },
    alliances: [{ serverInstanceId: id, allianceId: `${id}:alliance`, memberCount: playerCount }],
    snapshot: { serverInstanceId: id, snapshotId: `${id}:snapshot`, createdAt: NOW, tick: 42, stateVersion: 3, schemaVersion: 1, stale: false },
    commands: Array.from({ length: commandCount }, (_, index) => ({ serverInstanceId: id, commandId: `${id}:command:${index}`,
      commandType: "collect-production", actorId: `${id}:player:0`, status: "recorded", receivedAt: NOW, tickAtReceive: index })),
    events: [{ serverInstanceId: id, eventId: `${id}:event`, eventType: "tick-completed", causedByCommandId: null, occurredAt: NOW, tick: 42 }],
    diagnostics: [{ serverInstanceId: id, diagnosticId: `${id}:diagnostic`, level: "info", category: "runtime", messageCode: "diagnostic.runtime", occurredAt: NOW, commandId: null }]
  };
};

const instanceSummary = (id: string, playerCount: number): AdminInstanceSummaryView => ({
  serverInstanceId: id, displayName: id === "server:A" ? "Server A" : "Server B", mode: "free", region: "eu-central",
  capacity: 20, joinPolicy: "open", status: id === "server:A" ? "running" : "paused", currentTick: 42,
  stateVersion: 3, playerCount, workerStatus: id === "server:A" ? "live" : "offline", lastHeartbeatAt: NOW,
  leaseOwner: id === "server:A" ? "worker:A" : null, leaseExpiresAt: NOW, lastSnapshotAt: NOW, snapshotStale: false, lastErrorAt: null,
  freshness: { serverInstanceId: id, generatedAt: NOW, source: "durable-snapshot", dataAsOf: NOW, lastSnapshotAt: NOW,
    lastHeartbeatAt: NOW, stale: id !== "server:A", staleReason: id === "server:A" ? null : "worker-offline" }
});

const NOW = "2026-07-16T10:00:00.000Z";
