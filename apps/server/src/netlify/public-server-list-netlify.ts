import { publicServerRegistry } from "@empire/game-config";
import type { ServerApp } from "../app";
import type { AdminDurableRepositories } from "../admin/read-only";
import { createJsonResponse } from "./netlify-json-response";

const PUBLIC_HEARTBEAT_MAX_AGE_MS = 60_000;

export const createPublicServerListResponse = async (
  server: ServerApp,
  environment: Record<string, string | undefined>,
  repositories: AdminDurableRepositories | null
) => {
  if (environment.NODE_ENV !== "production") {
    const publicIds = new Set(publicServerRegistry.filter((entry) => entry.isPublic).map((entry) => entry.serverInstanceId));
    return createJsonResponse(200, { accepted: true,
      servers: server.adminMonitoring.listServerSummaries().filter((summary) => publicIds.has(summary.serverInstanceId)), errors: [] });
  }
  if (!repositories || repositories.kind !== "postgres") {
    return createJsonResponse(503, { accepted: false, servers: [],
      errors: [{ code: "SERVER_REGISTRY_UNAVAILABLE", message: "Server registry is unavailable." }] });
  }
  try {
    const [hosted, summaries] = await Promise.all([
      repositories.hosted.listServers(),
      repositories.monitoring.listKnownInstances()
    ]);
    const summaryById = new Map(summaries.map((entry) => [entry.serverInstanceId, entry]));
    const now = Date.now();
    const servers = hosted.filter((entry) => {
      const summary = summaryById.get(entry.serverInstanceId);
      return entry.provisioningState === "ready" && entry.joinPolicy === "open" &&
        (entry.status === "lobby" || entry.status === "running") && Boolean(entry.currentSnapshotId) &&
        Boolean(summary) && summary!.playerCount < entry.capacity && summary!.workerStatus === "live" &&
        Boolean(entry.lastWorkerHeartbeatAt) && now - Date.parse(entry.lastWorkerHeartbeatAt!) <= PUBLIC_HEARTBEAT_MAX_AGE_MS;
    }).map((entry) => {
      const summary = summaryById.get(entry.serverInstanceId)!;
      return { serverInstanceId: entry.serverInstanceId, displayName: entry.displayName, mode: entry.mode,
        region: entry.region, status: entry.status, joinPolicy: entry.joinPolicy, playerCount: summary.playerCount,
        capacity: entry.capacity, currentTick: summary.currentTick };
    });
    return createJsonResponse(200, { accepted: true, servers, errors: [] });
  } catch (_error) {
    return createJsonResponse(503, { accepted: false, servers: [],
      errors: [{ code: "SERVER_REGISTRY_UNAVAILABLE", message: "Server registry is unavailable." }] });
  }
};
