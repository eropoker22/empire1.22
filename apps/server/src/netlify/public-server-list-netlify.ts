import { publicServerRegistry } from "@empire/game-config";
import type { ServerApp } from "../app";
import { createJsonResponse } from "./netlify-json-response";

export const createPublicServerListResponse = (server: ServerApp) => {
  const publicIds = new Set(publicServerRegistry.filter((entry) => entry.isPublic).map((entry) => entry.serverInstanceId));
  return createJsonResponse(200, {
    accepted: true,
    servers: server.adminMonitoring.listServerSummaries().filter((summary) => publicIds.has(summary.serverInstanceId)),
    errors: []
  });
};
