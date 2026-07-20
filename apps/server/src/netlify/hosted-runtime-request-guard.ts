import type { ServerInstanceId } from "@empire/shared-types";
import type { AdminDurableRepositories } from "../admin/read-only";
import type { ServerApp } from "../app";
import { createHostedRuntimeLoader, type HostedRuntimeLoader } from "../bootstrap/hosted-runtime-loader";
import { createGameplayFunctionErrorResponse } from "./gameplay-function-error-response";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";

export const createHostedRuntimeRequestGuard = (options: {
  server: ServerApp;
  repositories: AdminDurableRepositories | null;
  environment: Record<string, string | undefined>;
}) => {
  const production = options.environment.NODE_ENV === "production";
  const loader = production && options.repositories?.kind === "postgres"
    ? createHostedRuntimeLoader({ server: options.server, controlPlane: options.repositories.hosted })
    : null;

  return {
    prepare: (serverInstanceId: string) => prepareHostedRuntime(production, loader, serverInstanceId),
    prepareSubmit: (serverInstanceId: string) => prepareHostedRuntime(production, loader, serverInstanceId, true),
    prepareJoin: (body: unknown) => prepareHostedRuntime(production, loader, readServerInstanceId(body))
  };
};

const prepareHostedRuntime = async (
  production: boolean,
  loader: HostedRuntimeLoader | null,
  serverInstanceId: string,
  requireRunning = false
): Promise<NetlifyFunctionResponse | null> => {
  if (!production) return null;
  if (!serverInstanceId) return createJsonResponse(200, createGameplayFunctionErrorResponse([{
    code: "transport.invalid_request",
    message: "Gameplay request requires serverInstanceId."
  }]));
  if (!loader) return createJsonResponse(503, createGameplayFunctionErrorResponse([{
    code: "server.runtime_authority_unavailable",
    message: "Hosted server authority is not configured."
  }]));
  const result = await loader.load(serverInstanceId as ServerInstanceId, { requireRunning });
  if (result.accepted) return null;
  const unavailable = result.errors.some((error) =>
    error.code === "server.runtime_authority_unavailable" || error.code === "server.snapshot_not_found");
  return createJsonResponse(unavailable ? 503 : 200, createGameplayFunctionErrorResponse(result.errors));
};

const readServerInstanceId = (body: unknown): string => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  return String((body as Record<string, unknown>).serverInstanceId ?? "").trim();
};
