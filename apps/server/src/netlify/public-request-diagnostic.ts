import { createHash, randomUUID } from "node:crypto";
import type { GameplaySessionTokenCodec } from "../transport/gameplay-session-token-codec";
import { readGameplaySessionCookie } from "./gameplay-session-cookie";
import type { GameplaySliceFunctionEvent } from "./gameplay-slice-function-request";
import type { NetlifyFunctionResponse } from "./netlify-json-response";

type NetlifyRequestHandler = (
  event: GameplaySliceFunctionEvent
) => Promise<NetlifyFunctionResponse>;

export const withPublicRequestDiagnostics = (
  handler: NetlifyRequestHandler,
  options: {
    environment: Record<string, string | undefined>;
    sessionTokenCodec: GameplaySessionTokenCodec | null;
    now?: () => Date;
    performanceNow?: () => number;
  }
): NetlifyRequestHandler => async (event) => {
  const startedAt = (options.performanceNow ?? performance.now.bind(performance))();
  const requestId = resolveRequestId(event.headers);
  const identity = resolveSignedIdentity(event.headers, options.sessionTokenCodec);
  try {
    const response = await handler(event);
    writePublicRequestDiagnostic({
      event,
      response,
      requestId,
      identity,
      environment: options.environment,
      timestamp: (options.now ?? (() => new Date()))().toISOString(),
      durationMs: elapsed(startedAt, options.performanceNow)
    });
    return {
      ...response,
      headers: { ...response.headers, "x-request-id": requestId }
    };
  } catch (_error) {
    writePublicRequestDiagnostic({
      event,
      response: null,
      requestId,
      identity,
      environment: options.environment,
      timestamp: (options.now ?? (() => new Date()))().toISOString(),
      durationMs: elapsed(startedAt, options.performanceNow)
    });
    throw _error;
  }
};

const writePublicRequestDiagnostic = (input: {
  event: GameplaySliceFunctionEvent;
  response: NetlifyFunctionResponse | null;
  requestId: string;
  identity: { serverInstanceHash: string | null; playerHash: string | null };
  environment: Record<string, string | undefined>;
  timestamp: string;
  durationMs: number;
}): void => {
  const errorCode = input.response ? responseErrorCode(input.response.body) : "UNHANDLED_REQUEST_ERROR";
  const status = input.response?.statusCode ?? 500;
  const entry = {
    timestamp: input.timestamp,
    level: status >= 500 ? "error" : errorCode || status >= 400 ? "warn" : "info",
    event: "http_request",
    component: "netlify-api",
    requestId: input.requestId,
    method: safeMethod(input.event.httpMethod),
    route: safeRoute(input.event.path),
    status,
    durationMs: input.durationMs,
    serverInstanceHash: input.identity.serverInstanceHash,
    playerHash: input.identity.playerHash,
    buildSha: exactSha(input.environment.EMPIRE_BUILD_SHA),
    workerId: null,
    environment: releaseEnvironment(input.environment.EMPIRE_RELEASE_ENVIRONMENT),
    region: safeIdentifier(input.environment.EMPIRE_RUNTIME_REGION),
    errorCode
  };
  console.log(JSON.stringify(entry));
};

const resolveSignedIdentity = (
  headers: GameplaySliceFunctionEvent["headers"],
  codec: GameplaySessionTokenCodec | null
): { serverInstanceHash: string | null; playerHash: string | null } => {
  const payload = codec?.open(String(readGameplaySessionCookie(headers) ?? ""));
  return payload
    ? { serverInstanceHash: safeHash(payload.serverInstanceId), playerHash: safeHash(payload.playerId) }
    : { serverInstanceHash: null, playerHash: null };
};

const responseErrorCode = (body: string): string | null => {
  try {
    const parsed = JSON.parse(body) as { code?: unknown; errors?: Array<{ code?: unknown }> };
    return safeErrorCode(parsed.code ?? parsed.errors?.[0]?.code);
  } catch {
    return null;
  }
};

const safeRoute = (rawPath: string): string => {
  const path = String(rawPath ?? "").split("?")[0] ?? "";
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "api") return "unknown";
  if (parts[1] === "admin") {
    if (parts[2] === "servers" && parts.length === 5 && parts[4] === "actions") return "/api/admin/servers/:id/actions";
    if (parts[2] === "instances" && parts.length >= 4) return `/api/admin/instances/:id${parts[4] === "logs" ? "/logs" : ""}`;
    if (parts[2] === "control-plane" && parts[3] === "instances") return "/api/admin/control-plane/instances/:id";
  }
  if (parts[1] === "lobby") {
    if (parts[2] === "servers" && parts.length === 5) return `/api/lobby/servers/:id/${knownSegment(parts[4])}`;
    if (parts[2] === "memberships" && parts.length >= 4) return `/api/lobby/memberships/:id${parts[4] ? `/${knownSegment(parts[4])}` : ""}`;
  }
  return parts.length <= 4 && parts.every((part) => /^[a-z0-9-]{1,48}$/u.test(part))
    ? `/${parts.join("/")}`
    : "unknown";
};

const knownSegment = (value: string | undefined): string =>
  ["results", "spawn-districts", "join-ticket", "leave", "logs"].includes(String(value)) ? String(value) : "action";
const resolveRequestId = (headers: GameplaySliceFunctionEvent["headers"]): string => {
  const supplied = header(headers, "x-request-id") || header(headers, "x-nf-request-id");
  return /^[a-zA-Z0-9:._-]{1,120}$/u.test(supplied) ? supplied : `api-request:${randomUUID()}`;
};
const header = (headers: GameplaySliceFunctionEvent["headers"], name: string): string => {
  const value = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];
  return (Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "")).trim();
};
const elapsed = (startedAt: number, read?: () => number): number =>
  Math.max(0, Math.round((read ?? performance.now.bind(performance))() - startedAt));
const safeHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 16);
const safeMethod = (value: string): string => /^[A-Z]{3,10}$/u.test(String(value).toUpperCase()) ? String(value).toUpperCase() : "UNKNOWN";
const safeErrorCode = (value: unknown): string | null => /^[A-Za-z0-9_.:-]{1,100}$/u.test(String(value ?? "")) ? String(value) : null;
const exactSha = (value: string | undefined): string | null => /^[0-9a-f]{40}$/u.test(String(value ?? "")) ? String(value) : null;
const releaseEnvironment = (value: string | undefined): string | null => ["staging", "production"].includes(String(value)) ? String(value) : null;
const safeIdentifier = (value: string | undefined): string | null => /^[a-z0-9._:-]{2,64}$/u.test(String(value ?? "")) ? String(value) : null;
