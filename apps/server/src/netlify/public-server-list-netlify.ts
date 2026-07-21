import { publicServerRegistry } from "@empire/game-config";
import type { ServerApp } from "../app";
import type { AdminDurableRepositories } from "../admin/read-only";
import { listHostedPublicServers } from "./hosted-public-server-read-model";
import { createJsonResponse } from "./netlify-json-response";

export const createPublicServerListResponse = async (
  server: ServerApp,
  environment: Record<string, string | undefined>,
  repositories: AdminDurableRepositories | null
) => {
  if (repositories?.kind !== "postgres" && environment.NODE_ENV !== "production") {
    const publicIds = new Set(publicServerRegistry.filter((entry) => entry.isPublic).map((entry) => entry.serverInstanceId));
    return createJsonResponse(200, { accepted: true,
      servers: server.adminMonitoring.listServerSummaries().filter((summary) => publicIds.has(summary.serverInstanceId)), errors: [] });
  }
  if (!repositories || repositories.kind !== "postgres") {
    return createJsonResponse(503, { accepted: false, servers: [],
      errors: [{ code: "SERVER_REGISTRY_UNAVAILABLE", message: "Server registry is unavailable." }] });
  }
  try {
    const servers = (await listHostedPublicServers(repositories)).map(({ view }) => view);
    return createJsonResponse(200, { accepted: true, servers, errors: [] });
  } catch (_error) {
    return createJsonResponse(503, { accepted: false, servers: [],
      errors: [{ code: "SERVER_REGISTRY_UNAVAILABLE", message: "Server registry is unavailable." }] });
  }
};
