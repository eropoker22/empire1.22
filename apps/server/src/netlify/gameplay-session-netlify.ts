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
  handleLogout: (body: unknown) => handleLogout(options, body),
  validateProductionSessionRuntime: () => validateProductionSessionRuntime(options)
});

const handleJoin = async (
  options: GameplaySessionNetlifyHandlersOptions,
  body: unknown,
  headers?: Record<string, string | string[] | undefined>
): Promise<NetlifyFunctionResponse> => {
  if (!isRecord(body)) {
    return createJsonResponse(200, createErrorResponse("transport.invalid_request", "Join request must be an object."));
  }
  const request = body as unknown as JoinGameplaySliceRequest;
  const identity = options.server.accountIdentityProvider.resolve({ body, headers });
  if (!identity) {
    return createJsonResponse(200, createErrorResponse("SESSION_REQUIRED", "Account identity is required for join."));
  }
  const consumed = options.server.gameplaySessionService.consumeJoinTicket({
    ticketId: String(request.joinTicket ?? ""),
    accountId: identity.accountId,
    serverInstanceId: String(request.serverInstanceId ?? ""),
    nowIso: new Date().toISOString()
  });
  if (!consumed.accepted) {
    return createJsonResponse(200, createErrorResponseFromErrors(consumed.errors));
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
  const runtime = options.server.instanceManager.getInstanceById(consumed.registration.serverInstanceId);
  if (!runtime) {
    return createJsonResponse(200, createErrorResponse("server.instance_not_found", "Joined runtime was not found."));
  }
  const session = options.server.gameplaySessionService.createSession({
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
  return options.toFunctionResponse({
    status: response.status,
    body: {
      ...response.body,
      sessionToken
    }
  }, session.serverInstanceId);
};

const handleLogout = (
  options: GameplaySessionNetlifyHandlersOptions,
  body: unknown
): NetlifyFunctionResponse => {
  const request = (isRecord(body) ? body : {}) as unknown as LogoutGameplaySliceRequest;
  const tokenPayload = options.sessionTokenCodec.open(String(request.sessionToken ?? ""));
  if (!tokenPayload) {
    return createJsonResponse(200, createErrorResponse("SESSION_INVALID", "Gameplay session is invalid."));
  }
  options.server.gameplaySessionService.revokeSession(String(tokenPayload.sessionId), new Date().toISOString());
  return createJsonResponse(200, {
    accepted: true,
    readModel: null,
    errors: [],
    sessionToken: null
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
