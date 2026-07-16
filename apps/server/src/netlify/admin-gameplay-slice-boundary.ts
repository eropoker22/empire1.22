import type { AdminDurableRepositories } from "../admin/read-only";
import { resolveAdminDurableRepositories } from "../admin/read-only";
import { createAdminReadOnlyNetlifyHandler, isAdminApiPath } from "./admin-read-only-netlify";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";

export const createAdminGameplaySliceBoundary = (options: {
  environment: Record<string, string | undefined>;
  repositories?: AdminDurableRepositories;
}) => {
  const resolution = resolveAdminDurableRepositories(options.environment, options.repositories);
  const handler = resolution.accepted
    ? createAdminReadOnlyNetlifyHandler({ repositories: resolution.repositories, environment: options.environment })
    : null;
  return async (event: {
    httpMethod: string;
    path: string;
    body: string | null;
    headers?: Record<string, string | string[] | undefined>;
  }): Promise<NetlifyFunctionResponse | null> => {
    if (!isAdminApiPath(event.path)) return null;
    if (!handler) return unavailable("ADMIN_CONFIGURATION_UNAVAILABLE", "Admin durable repository is unavailable.");
    try {
      return await handler({ httpMethod: event.httpMethod, path: event.path, body: parseBody(event.body), headers: event.headers });
    } catch (_error) {
      return unavailable("ADMIN_DATABASE_UNAVAILABLE", "Admin server is unavailable.");
    }
  };
};

const unavailable = (code: string, message: string) => createJsonResponse(503, {
  accepted: false, data: null, errors: [{ code, message }]
}, { "cache-control": "no-store" });
const parseBody = (body: string | null): unknown => {
  if (!body) return null;
  try { return JSON.parse(body) as unknown; } catch (_error) { return null; }
};
