import * as crypto from "node:crypto";
import type { AdminApiErrorView, AdminOverviewView, AdminSessionView } from "@empire/shared-types";
import { createAdminSessionService, type AdminDurableRepositories } from "../admin/read-only";
import { createHostedControlPlaneService } from "../admin/hosted";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";
import { validateStateChangingOrigin } from "./csrf-origin-guard";
import { createAdminSessionClearCookie, createAdminSessionSetCookie, readAdminSessionCookie } from "./admin-session-cookie";

export interface AdminNetlifyRequest {
  httpMethod: string;
  path: string;
  body: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

export const isAdminApiPath = (path: string): boolean => {
  const segments = split(path);
  return segments[0] === "api" && segments[1] === "admin";
};

export const createAdminReadOnlyNetlifyHandler = (options: {
  repositories: AdminDurableRepositories;
  environment: Record<string, string | undefined>;
  now?: () => Date;
  allowInMemoryForTests?: boolean;
}) => {
  const sessions = createAdminSessionService(options);
  const controlPlane = createHostedControlPlaneService(options);
  return async (request: AdminNetlifyRequest): Promise<NetlifyFunctionResponse> => {
    const method = request.httpMethod.toUpperCase();
    const route = resolveRoute(request.path);
    const correlationId = resolveCorrelationId(request.headers);
    if (!route) return error(404, "ADMIN_NOT_FOUND", "Admin endpoint was not found.");
    if (method === "OPTIONS") return createJsonResponse(204, null);

    if (route.kind === "session" && method === "POST") {
      const stateChangeError = validateAdminStateChange(request, options.environment);
      if (stateChangeError) return stateChangeError;
      const username = isRecord(request.body) ? String(request.body.username ?? "") : "";
      const password = isRecord(request.body) ? String(request.body.password ?? "") : "";
      const result = await sessions.login({ username, password, fingerprint: resolveFingerprint(request.headers), correlationId });
      if (!result.accepted) return error(result.errors[0]!.code === "ADMIN_LOGIN_RATE_LIMITED" ? 429 : 401,
        result.errors[0]!.code, result.errors[0]!.message);
      return createJsonResponse(200, success(result.session), {
        "set-cookie": createAdminSessionSetCookie(result.token, result.session.expiresAt, options.environment),
        "cache-control": "no-store"
      });
    }

    const authentication = await sessions.authenticate(readAdminSessionCookie(request.headers), correlationId);
    if (!authentication.accepted) {
      return error(authentication.errors[0]?.code === "ADMIN_SESSION_EXPIRED" ? 401 : 401,
        authentication.errors[0]!.code, authentication.errors[0]!.message,
        { "set-cookie": createAdminSessionClearCookie(options.environment) });
    }

    if (route.kind === "session" && method === "DELETE") {
      const stateChangeError = validateAdminStateChange(request, options.environment);
      if (stateChangeError) return stateChangeError;
      await sessions.logout(authentication.storedSession, correlationId);
      return createJsonResponse(200, success(null), {
        "set-cookie": createAdminSessionClearCookie(options.environment),
        "cache-control": "no-store"
      });
    }
    if (route.kind === "session" && method === "GET") {
      return createJsonResponse(200, success(authentication.session), { "cache-control": "no-store" });
    }
    if (route.kind === "control-plane" && method === "GET") {
      return createJsonResponse(200, success(await controlPlane.availability()), { "cache-control": "no-store" });
    }
    if (route.kind === "servers" && method === "POST") {
      const stateChangeError = validateAdminStateChange(request, options.environment);
      if (stateChangeError) return stateChangeError;
      const result = await controlPlane.createServer({ session: authentication.session, payload: request.body,
        idempotencyKey: header(request.headers, "idempotency-key"), correlationId });
      if (!result.accepted) return controlPlaneError(result.errors[0]!);
      return createJsonResponse(202, success(result.data), { "cache-control": "no-store" });
    }
    if (route.kind === "server-action" && method === "POST") {
      const stateChangeError = validateAdminStateChange(request, options.environment);
      if (stateChangeError) return stateChangeError;
      const result = await controlPlane.requestAction({ session: authentication.session,
        serverInstanceId: route.serverInstanceId, payload: request.body,
        idempotencyKey: header(request.headers, "idempotency-key"), correlationId });
      if (!result.accepted) return controlPlaneError(result.errors[0]!);
      return createJsonResponse(202, success(result.data), { "cache-control": "no-store" });
    }
    if (method !== "GET") return error(405, "ADMIN_METHOD_NOT_ALLOWED", "Admin endpoint is read-only.");

    if (route.kind === "overview" || route.kind === "compat-monitoring") {
      const instances = await options.repositories.monitoring.listKnownInstances();
      const overview = createOverview(instances, options.now?.() ?? new Date());
      await sessions.auditAccess(authentication.session, "overview-access", correlationId);
      return createJsonResponse(200, success(overview), { "cache-control": "no-store" });
    }
    if (route.kind === "instance") {
      const detail = await options.repositories.monitoring.getInstanceRuntimeProjection(route.serverInstanceId);
      if (!detail) return error(404, "ADMIN_INSTANCE_NOT_FOUND", "Admin instance was not found.");
      await sessions.auditAccess(authentication.session, "instance-detail-access", correlationId, route.serverInstanceId);
      return createJsonResponse(200, success(detail), { "cache-control": "no-store" });
    }
    if (route.kind === "logs") {
      if (!await options.repositories.monitoring.getInstanceSummary(route.serverInstanceId)) {
        return error(404, "ADMIN_INSTANCE_NOT_FOUND", "Admin instance was not found.");
      }
      const [commands, events, diagnostics] = await Promise.all([
        options.repositories.monitoring.listInstanceCommandSummaries(route.serverInstanceId, 100),
        options.repositories.monitoring.listInstanceEventSummaries(route.serverInstanceId, 100),
        options.repositories.monitoring.listInstanceDiagnosticSummaries(route.serverInstanceId, 100)
      ]);
      await sessions.auditAccess(authentication.session, "instance-detail-access", correlationId, route.serverInstanceId);
      return createJsonResponse(200, success({ serverInstanceId: route.serverInstanceId, commands, events, diagnostics }), { "cache-control": "no-store" });
    }
    if (route.kind === "audit") {
      if (authentication.session.role !== "owner") {
        await options.repositories.audit.append(auditForbidden(authentication.session, correlationId));
        return error(403, "ADMIN_FORBIDDEN", "Admin role does not permit this read.");
      }
      await sessions.auditAccess(authentication.session, "audit-access", correlationId);
      return createJsonResponse(200, success(await options.repositories.audit.list(200)), { "cache-control": "no-store" });
    }
    return error(404, "ADMIN_NOT_FOUND", "Admin endpoint was not found.");
  };
};

const createOverview = (instances: Awaited<ReturnType<AdminDurableRepositories["monitoring"]["listKnownInstances"]>>, now: Date): AdminOverviewView => ({
  generatedAt: now.toISOString(),
  databaseStatus: "available",
  instances,
  counts: {
    known: instances.length,
    live: instances.filter((entry) => entry.workerStatus === "live").length,
    stale: instances.filter((entry) => entry.workerStatus === "stale").length,
    offline: instances.filter((entry) => entry.workerStatus === "offline").length,
    noWorker: instances.filter((entry) => entry.workerStatus === "no-worker").length,
    failed: instances.filter((entry) => entry.status === "crashed" || Boolean(entry.lastErrorAt)).length,
    running: instances.filter((entry) => entry.status === "running").length,
    lobby: instances.filter((entry) => entry.status === "lobby").length,
    paused: instances.filter((entry) => entry.status === "paused").length,
    players: instances.reduce((sum, entry) => sum + entry.playerCount, 0)
  }
});

type Route = { kind: "session" | "overview" | "compat-monitoring" | "audit" | "control-plane" | "servers" }
  | { kind: "instance" | "logs" | "server-action"; serverInstanceId: string };
const resolveRoute = (path: string): Route | null => {
  const parts = split(path);
  if (parts[0] !== "api" || parts[1] !== "admin") return null;
  if (parts.length === 3 && parts[2] === "session") return { kind: "session" };
  if (parts.length === 3 && parts[2] === "overview") return { kind: "overview" };
  if (parts.length === 3 && parts[2] === "monitoring") return { kind: "compat-monitoring" };
  if (parts.length === 3 && parts[2] === "audit") return { kind: "audit" };
  if (parts.length === 3 && parts[2] === "control-plane") return { kind: "control-plane" };
  if (parts.length === 3 && parts[2] === "servers") return { kind: "servers" };
  if (parts.length === 5 && parts[2] === "servers" && parts[4] === "actions") return { kind: "server-action", serverInstanceId: decodeURIComponent(parts[3]!) };
  if (parts.length === 4 && parts[2] === "instances") return { kind: "instance", serverInstanceId: decodeURIComponent(parts[3]!) };
  if (parts.length === 5 && parts[2] === "instances" && parts[4] === "logs") return { kind: "logs", serverInstanceId: decodeURIComponent(parts[3]!) };
  return null;
};

const validateAdminStateChange = (request: AdminNetlifyRequest, env: Record<string, string | undefined>): NetlifyFunctionResponse | null => {
  const contentType = header(request.headers, "content-type").toLowerCase();
  if (!contentType.startsWith("application/json")) return error(415, "ADMIN_JSON_REQUIRED", "Admin request requires JSON.");
  const origin = validateStateChangingOrigin(request.headers, env);
  return origin ? error(403, origin.code, origin.message) : null;
};
const success = <T>(data: T) => ({ accepted: true as const, data, errors: [] as [] });
const controlPlaneError = (entry: AdminApiErrorView) => error(
  entry.code === "ADMIN_FORBIDDEN" ? 403
    : entry.code === "ADMIN_INSTANCE_NOT_FOUND" ? 404
    : entry.code === "ADMIN_STALE_VERSION" || entry.code === "ADMIN_IDEMPOTENCY_CONFLICT"
      || entry.code === "SERVER_LIFECYCLE_OPERATION_ACTIVE" ? 409
    : entry.code.includes("UNAVAILABLE") || entry.code.includes("DISABLED") || entry.code.includes("OFFLINE") || entry.code.includes("PENDING") ? 503
    : 400,
  entry.code,
  entry.message
);
const error = (status: number, code: string, message: string, headers: Record<string, string> = {}) =>
  createJsonResponse(status, { accepted: false, data: null, errors: [{ code, message } satisfies AdminApiErrorView] }, { "cache-control": "no-store", ...headers });
const split = (path: string): string[] => String(path).split("?")[0]!.split("/").filter(Boolean);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const header = (headers: AdminNetlifyRequest["headers"], name: string): string => {
  const value = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
};
const resolveFingerprint = (headers: AdminNetlifyRequest["headers"]): string =>
  (header(headers, "cf-connecting-ip") || header(headers, "x-forwarded-for").split(",")[0] || "unknown").trim();
const resolveCorrelationId = (headers: AdminNetlifyRequest["headers"]): string => {
  const supplied = header(headers, "x-request-id").trim();
  return /^[a-zA-Z0-9:._-]{1,120}$/u.test(supplied) ? supplied : `admin-request:${randomId()}`;
};
const auditForbidden = (session: AdminSessionView, correlationId: string) => ({
  id: `admin-audit:${randomId()}`,
  adminSessionId: session.adminSessionId,
  actorId: session.actorId,
  role: session.role,
  action: "forbidden-access" as const,
  targetInstanceId: null,
  result: "forbidden" as const,
  createdAt: new Date().toISOString(),
  correlationId
});

const randomId = (): string => {
  const bytes = new Uint8Array(16);
  crypto.webcrypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};
