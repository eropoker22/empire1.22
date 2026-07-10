import type { DomainError, GameplaySliceResponse, LoadGameplaySliceRequest, SubmitGameplayCommandRequest } from "@empire/shared-types";
import { createServerApp, type ServerApp } from "../app";
import { ensureGameplaySliceSessionResult } from "../bootstrap";
import { createInstanceSnapshot } from "../runtime/persistence/mappers";
import { createSnapshotTokenCodec, type SnapshotTokenCryptoProvider } from "../runtime/persistence/services";
import { createGameplaySliceValidationResponse, validateLoadGameplaySliceRequest, validateSubmitGameplayCommandRequest } from "../transport/gameplay-slice-request-validation";
import { publicServerRegistry } from "@empire/game-config";
import { validateCommandPlayerIdentity } from "../transport/player-identity-guard";
import { createGameplaySessionTokenCodec } from "../transport/gameplay-session-token-codec";
import { readRequiredGameplaySessionSecret, readRequiredSnapshotSecret } from "./snapshot-secret";
import { ensureDefaultLobbyServers } from "./gameplay-slice-function-default-servers";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";
import { resolveGameplaySliceFunctionRoute } from "./gameplay-slice-function-routes";
import { parseNetlifyJsonBody } from "./netlify-request-body";
import { handlePublicServerMatchmakingReserve } from "./public-server-matchmaking-netlify";
import { handleAdminMonitoringNetlifyRequest } from "./admin-monitoring-netlify";
import { createGameplaySessionNetlifyHandlers } from "./gameplay-session-netlify";
import { readGameplaySessionCookie } from "./gameplay-session-cookie";
import { validateStateChangingOrigin } from "./csrf-origin-guard";

interface NetlifyFunctionEvent {
  httpMethod: string;
  path: string;
  body: string | null;
  headers?: Record<string, string | string[] | undefined>;
}

interface GameplaySliceFunctionHandlerOptions {
  cryptoProvider?: SnapshotTokenCryptoProvider;
  environment?: Record<string, string | undefined>;
  allowImplicitInstanceCreation?: boolean;
  server?: ServerApp;
}

export const createGameplaySliceFunctionHandler = (
  options: GameplaySliceFunctionHandlerOptions = {}
) => {
  const environment = options.environment ?? readProcessEnvironment();
  const snapshotSecret = readRequiredSnapshotSecret(environment);
  const gameplaySessionSecret = readRequiredGameplaySessionSecret(environment, snapshotSecret.secret);
  const server = options.server ?? createServerApp({
    gameplaySessionTokenSecret: gameplaySessionSecret.secret ?? undefined,
    environment
  });
  ensureDefaultLobbyServers(server);
  const allowImplicitInstanceCreation =
    options.allowImplicitInstanceCreation ?? environment.NODE_ENV !== "production";
  const snapshotTokenCodec = snapshotSecret.secret
    ? createSnapshotTokenCodec({
        secret: snapshotSecret.secret,
        cryptoProvider: options.cryptoProvider
      })
    : null;
  const sessionTokenCodec = snapshotSecret.secret
    ? createGameplaySessionTokenCodec({
        secret: gameplaySessionSecret.secret ?? snapshotSecret.secret
      })
    : null;
  const sessionHandlers = sessionTokenCodec && snapshotTokenCodec
    ? createGameplaySessionNetlifyHandlers({
        server,
        sessionTokenCodec,
        snapshotTokenCodec,
        allowImplicitInstanceCreation,
        environment,
        toFunctionResponse
      })
    : null;

  return async (event: NetlifyFunctionEvent): Promise<NetlifyFunctionResponse> => {
    if (event.httpMethod.toUpperCase() === "OPTIONS") {
      return createJsonResponse(204, null);
    }

    const route = resolveGameplaySliceFunctionRoute(event.path);

    if (!route) {
      return createJsonResponse(
        404,
        createErrorResponse("transport.not_found", "Gameplay slice endpoint was not found.")
      );
    }

    if (route === "admin-monitoring") {
      return handleAdminMonitoringNetlifyRequest(server, { headers: event.headers }, environment);
    }

    if (!snapshotSecret.accepted || !snapshotTokenCodec) {
      return createJsonResponse(500, createErrorResponseFromErrors(snapshotSecret.errors));
    }

    if (!gameplaySessionSecret.accepted || !sessionTokenCodec) {
      return createJsonResponse(500, createErrorResponseFromErrors(gameplaySessionSecret.errors));
    }

    if (route === "servers") {
      const publicServerIds = new Set(
        publicServerRegistry
          .filter((serverEntry) => serverEntry.isPublic)
          .map((serverEntry) => serverEntry.serverInstanceId)
      );
      return createJsonResponse(200, {
        accepted: true,
        servers: server.adminMonitoring
          .listServerSummaries()
          .filter((summary) => publicServerIds.has(summary.serverInstanceId)),
        errors: []
      });
    }

    const productionGuardError = sessionHandlers?.validateProductionSessionRuntime() ?? null;
    if (productionGuardError) {
      return createJsonResponse(500, createErrorResponseFromErrors([productionGuardError]));
    }

    if (isStateChangingRoute(route)) {
      const originError = validateStateChangingOrigin(event.headers, environment);
      if (originError) {
        return createJsonResponse(200, createErrorResponseFromErrors([originError]));
      }
    }

    const parsedBody = parseNetlifyJsonBody(event.body);

    if (!parsedBody.accepted) {
      return createJsonResponse(
        parsedBody.statusCode,
        createErrorResponseFromErrors([parsedBody.error])
      );
    }

    if (route === "matchmaking-reserve") {
      return await handlePublicServerMatchmakingReserve(server, event.httpMethod, parsedBody.body, event.headers);
    }

    const requestPath = `/api/gameplay-slice/${route}`;

    if (route === "load") {
      const validation = validateLoadGameplaySliceRequest(parsedBody.body);
      if (!validation.accepted) {
        return createJsonResponse(200, createGameplaySliceValidationResponse(validation.errors));
      }

      const request: LoadGameplaySliceRequest = {
        ...validation.request,
        sessionToken: resolveGameplaySessionToken(event.headers, validation.request.sessionToken)
      };
      const snapshotTokenError = await validateSnapshotTokenForInstance(
        request.snapshotToken,
        request.serverInstanceId
      );
      if (snapshotTokenError) {
        return createJsonResponse(200, createErrorResponseFromErrors([snapshotTokenError]));
      }

      return await toFunctionResponse(await server.gameplaySliceJsonHandler.handle({
        method: event.httpMethod,
        path: requestPath,
        body: request
      }), request.serverInstanceId);
    }

    if (route === "join") {
      return sessionHandlers!.handleJoin(parsedBody.body, event.headers);
    }

    if (route === "logout") {
      return await sessionHandlers!.handleLogout(parsedBody.body, event.headers);
    }

    const validation = validateSubmitGameplayCommandRequest(parsedBody.body);
    if (!validation.accepted) {
      return createJsonResponse(200, createGameplaySliceValidationResponse(validation.errors));
    }

    const request: SubmitGameplayCommandRequest = {
      ...validation.request,
      sessionToken: resolveGameplaySessionToken(event.headers, validation.request.sessionToken)
    };
    const snapshotTokenError = await validateSnapshotTokenForInstance(
      request.snapshotToken,
      request.command.serverInstanceId
    );
    if (snapshotTokenError) {
      return createJsonResponse(200, createErrorResponseFromErrors([snapshotTokenError]));
    }

    const identityErrors = validateCommandPlayerIdentity(request.command, null, {
      sessionToken: request.sessionToken,
      sessionTokenCodec
    });
    if (identityErrors.length > 0) {
      return createJsonResponse(200, createErrorResponseFromErrors(identityErrors));
    }

    const ensureResult = await ensureGameplaySliceSessionResult(server.instanceManager, request, {
      snapshotToken: request.snapshotToken,
      snapshotTokenCodec,
      allowImplicitInstanceCreation
    });
    if (!ensureResult.accepted) {
      return createJsonResponse(200, createErrorResponseFromErrors(ensureResult.errors));
    }
    return await toFunctionResponse(await server.gameplaySliceJsonHandler.handle({
      method: event.httpMethod,
      path: requestPath,
      body: request
    }), request.command.serverInstanceId);
  };

  function toFunctionResponse(response: {
    status: number;
    body: GameplaySliceResponse;
  }, instanceId: string): Promise<NetlifyFunctionResponse> {
    const runtime = server.instanceManager.getInstanceById(instanceId);

    return Promise.resolve(runtime
      ? snapshotTokenCodec!.seal(createInstanceSnapshot(runtime))
      : response.body.snapshotToken ?? null
    ).then((snapshotToken) => createJsonResponse(response.status, {
      ...response.body,
      snapshotToken
    }));
  }

  async function validateSnapshotTokenForInstance(
    snapshotToken: string | null | undefined,
    serverInstanceId: string
  ): Promise<DomainError | null> {
    const token = String(snapshotToken ?? "").trim();
    if (!token) {
      return null;
    }

    const snapshot = await snapshotTokenCodec!.open(token);
    return snapshot?.instanceId === serverInstanceId
      ? null
      : {
          code: "transport.snapshot_token_invalid",
          message: "Snapshot token is invalid."
        };
  }

  function resolveGameplaySessionToken(
    headers: Record<string, string | string[] | undefined> | undefined,
    bodySessionToken: string | null | undefined
  ): string | null {
    const cookieToken = String(readGameplaySessionCookie(headers) ?? "").trim();
    if (cookieToken) return cookieToken;
    if (environment.NODE_ENV === "production") return null;
    return String(bodySessionToken ?? "").trim() || null;
  }
};

const readProcessEnvironment = (): Record<string, string | undefined> => (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
export const handler = createGameplaySliceFunctionHandler();

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

const isStateChangingRoute = (
  route: ReturnType<typeof resolveGameplaySliceFunctionRoute>
): boolean => route === "matchmaking-reserve" || route === "join" || route === "logout" || route === "submit";
