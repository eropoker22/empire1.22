import type {
  DomainError,
  GameplaySliceResponse,
  JoinGameplaySliceRequest,
  LoadGameplaySliceRequest,
  LogoutGameplaySliceRequest
} from "@empire/shared-types";
import type { ServerApp } from "../app";
import { ensureGameplaySliceSessionResult } from "../bootstrap";
import type { SnapshotTokenCodec } from "../runtime/persistence/services";
import type { GameplaySessionTokenCodec } from "../transport/gameplay-session-token-codec";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";
import {
  createGameplaySessionClearCookie,
  createGameplaySessionSetCookie,
  readGameplaySessionCookie
} from "./gameplay-session-cookie";

interface GameplaySessionNetlifyHandlersOptions {
  server: ServerApp;
  sessionTokenCodec: GameplaySessionTokenCodec;
  snapshotTokenCodec: SnapshotTokenCodec;
  allowImplicitInstanceCreation: boolean;
  environment?: Record<string, string | undefined>;
  toFunctionResponse(response: { status: number; body: GameplaySliceResponse }, instanceId: string): Promise<NetlifyFunctionResponse>;
}

export const createGameplaySessionNetlifyHandlers = (
  options: GameplaySessionNetlifyHandlersOptions
) => ({
  handleJoin: (body: unknown, headers?: Record<string, string | string[] | undefined>) =>
    handleJoin(options, body, headers),
  handleLogout: (body: unknown, headers?: Record<string, string | string[] | undefined>) =>
    handleLogout(options, body, headers),
  validateRequestSession: (
    sessionToken: string | null | undefined,
    serverInstanceId: string
  ) => validateRequestSession(options, sessionToken, serverInstanceId),
  validateProductionSessionRuntime: () => validateProductionSessionRuntime(options)
});

const validateRequestSession = async (
  options: GameplaySessionNetlifyHandlersOptions,
  sessionToken: string | null | undefined,
  serverInstanceId: string
) => {
  const rawSessionToken = String(sessionToken ?? "").trim();
  if (!rawSessionToken) {
    return {
      accepted: false as const,
      errors: [{ code: "SESSION_REQUIRED", message: "Gameplay session is required." }]
    };
  }

  const tokenPayload = options.sessionTokenCodec.open(rawSessionToken);
  if (!tokenPayload || tokenPayload.serverInstanceId !== serverInstanceId) {
    return {
      accepted: false as const,
      errors: [{ code: "SESSION_INVALID", message: "Gameplay session is invalid." }]
    };
  }

  const validated = await options.server.gameplaySessionService.validateSession({
    sessionId: tokenPayload.sessionId,
    accountId: tokenPayload.accountId,
    serverInstanceId,
    nowIso: new Date().toISOString()
  });
  if (!validated.accepted || validated.session.playerId !== tokenPayload.playerId) {
    return validated.accepted
      ? {
          accepted: false as const,
          errors: [{ code: "SESSION_INVALID", message: "Gameplay session is invalid." }]
        }
      : validated;
  }

  return validated;
};

const handleJoin = async (
  options: GameplaySessionNetlifyHandlersOptions,
  body: unknown,
  headers?: Record<string, string | string[] | undefined>
): Promise<NetlifyFunctionResponse> => {
  if (!isRecord(body)) {
    return createJsonResponse(200, createErrorResponse("transport.invalid_request", "Join request must be an object."));
  }
  const request = body as unknown as JoinGameplaySliceRequest;
  const identity = await options.server.accountIdentityProvider.resolve({ body, headers });
  if (!identity) return createJsonResponse(200, createErrorResponse("SESSION_REQUIRED", "Account identity is required for join."));
  const consumed = await options.server.gameplaySessionService.consumeJoinTicket({
    ticketId: String(request.joinTicket ?? ""),
    accountId: identity.accountId,
    serverInstanceId: String(request.serverInstanceId ?? ""),
    nowIso: new Date().toISOString()
  });
  if (!consumed.accepted) {
    return createJsonResponse(200, createErrorResponseFromErrors(consumed.errors));
  }
  let runtime = options.server.instanceManager.getInstanceById(consumed.registration.serverInstanceId);
  if (options.environment?.NODE_ENV === "production" && !runtime?.state.playersById[consumed.registration.playerId]) {
    return createJsonResponse(200, createErrorResponse("server.player_not_ready", "Hosted player state is not ready."));
  }
  const loadRequest: LoadGameplaySliceRequest = {
    serverInstanceId: consumed.registration.serverInstanceId,
    playerId: consumed.registration.playerId,
    preferredStartDistrictId: request.preferredStartDistrictId,
    factionId: request.factionId ?? consumed.ticket.factionId ?? null
  };
  const ensureResult = await ensureGameplaySliceSessionResult(options.server.instanceManager, loadRequest, {
    snapshotToken: null,
    snapshotTokenCodec: options.snapshotTokenCodec,
    allowImplicitInstanceCreation: options.allowImplicitInstanceCreation
  });
  if (!ensureResult.accepted) {
    return createJsonResponse(200, createErrorResponseFromErrors(ensureResult.errors));
  }
  runtime = options.server.instanceManager.getInstanceById(consumed.registration.serverInstanceId);
  if (!runtime) {
    return createJsonResponse(200, createErrorResponse("server.instance_not_found", "Joined runtime was not found."));
  }
  const session = await options.server.gameplaySessionService.createSession({
    registration: consumed.registration,
    nowIso: runtime.clock.nowIso(),
    ttlMs: runtime.config.technical.sessionTtlMs
  });
  const sessionToken = options.sessionTokenCodec.seal({
    sessionId: session.sessionId,
    accountId: session.accountId,
    serverInstanceId: session.serverInstanceId,
    playerId: session.playerId,
    factionId: runtime.state.playersById[session.playerId]?.factionId ?? request.factionId ?? null,
    issuedAt: session.createdAt,
    expiresAt: session.expiresAt,
    version: session.version
  });
  const response = await options.server.gameplaySliceJsonHandler.handle({
    method: "POST",
    path: "/api/gameplay-slice/load",
    body: {
      serverInstanceId: session.serverInstanceId,
      playerId: session.playerId,
      districtId: request.preferredStartDistrictId ?? null,
      sessionToken
    }
  });
  const bodySessionToken = options.environment?.NODE_ENV === "production" ? null : sessionToken;
  const functionResponse = await options.toFunctionResponse({
    status: response.status,
    body: {
      ...response.body,
      sessionToken: bodySessionToken
    }
  }, session.serverInstanceId);
  return {
    ...functionResponse,
    headers: {
      ...functionResponse.headers,
      "set-cookie": createGameplaySessionSetCookie(sessionToken, session.expiresAt, options.environment)
    }
  };
};

const handleLogout = async (
  options: GameplaySessionNetlifyHandlersOptions,
  body: unknown,
  headers?: Record<string, string | string[] | undefined>
): Promise<NetlifyFunctionResponse> => {
  const request = (isRecord(body) ? body : {}) as unknown as LogoutGameplaySliceRequest;
  const token = resolveRequestSessionToken(headers, request.sessionToken, options.environment);
  if (!token) {
    return createJsonResponse(200, {
      accepted: true,
      readModel: null,
      errors: [],
      sessionToken: null
    }, {
      "set-cookie": createGameplaySessionClearCookie(options.environment)
    });
  }
  const tokenPayload = options.sessionTokenCodec.open(token);
  if (!tokenPayload) {
    return createJsonResponse(200, createErrorResponse("SESSION_INVALID", "Gameplay session is invalid."), {
      "set-cookie": createGameplaySessionClearCookie(options.environment)
    });
  }
  await options.server.gameplaySessionService.revokeSession(String(tokenPayload.sessionId), new Date().toISOString());
  return createJsonResponse(200, {
    accepted: true,
    readModel: null,
    errors: [],
    sessionToken: null
  }, {
    "set-cookie": createGameplaySessionClearCookie(options.environment)
  });
};

const validateProductionSessionRuntime = (
  options: GameplaySessionNetlifyHandlersOptions
): DomainError | null => {
  if (options.environment?.NODE_ENV !== "production") {
    return null;
  }
  if (!options.server.gameplaySessionService.productionReady) {
    return {
      code: "SESSION_INVALID",
      message: "Production gameplay session repository is not configured."
    };
  }
  if (!options.server.accountIdentityProvider.productionReady) {
    return {
      code: "SESSION_INVALID",
      message: "Production account identity provider is not configured."
    };
  }
  return null;
};

const createErrorResponse = (
  code: string,
  message: string
): GameplaySliceResponse => ({
  accepted: false,
  readModel: null,
  errors: [{ code, message }]
});

const createErrorResponseFromErrors = (
  errors: DomainError[]
): GameplaySliceResponse => ({
  accepted: false,
  readModel: null,
  errors
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const resolveRequestSessionToken = (
  headers: Record<string, string | string[] | undefined> | undefined,
  bodySessionToken: unknown,
  environment?: Record<string, string | undefined>
): string | null => {
  const cookieToken = String(readGameplaySessionCookie(headers) ?? "").trim();
  if (cookieToken) return cookieToken;
  if (environment?.NODE_ENV === "production") return null;
  return String(bodySessionToken ?? "").trim() || null;
};
