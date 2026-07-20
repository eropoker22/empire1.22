import type {
  GameplayCommandResultLookupResponse,
  GameplaySliceResponse,
  LoadGameplaySliceRequest,
  LookupGameplayCommandResultRequest,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import { createServerApp, type ServerApp } from "../app";
import { ensureGameplaySliceSessionResult } from "../bootstrap";
import { createInstanceSnapshot } from "../runtime/persistence/mappers";
import { createSnapshotTokenCodec, type SnapshotTokenCryptoProvider } from "../runtime/persistence/services";
import {
  createGameplaySliceValidationResponse,
  validateLoadGameplaySliceRequest,
  validateSubmitGameplayCommandRequest
} from "../transport/gameplay-slice-request-validation";
import { validateLookupGameplayCommandResultRequest } from "../transport/gameplay-command-result-lookup-validation";
import { validateCommandPlayerIdentity } from "../transport/player-identity-guard";
import { createGameplaySessionTokenCodec } from "../transport/gameplay-session-token-codec";
import { readRequiredGameplaySessionSecret, readRequiredSnapshotSecret } from "./snapshot-secret";
import { ensureDefaultLobbyServers } from "./gameplay-slice-function-default-servers";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";
import { resolveGameplaySliceFunctionRoute } from "./gameplay-slice-function-routes";
import { parseNetlifyJsonBody } from "./netlify-request-body";
import { handlePublicServerMatchmakingReserve } from "./public-server-matchmaking-netlify";
import { createGameplaySessionNetlifyHandlers } from "./gameplay-session-netlify";
import { validateStateChangingOrigin } from "./csrf-origin-guard";
import { resolveAdminDurableRepositories, type AdminDurableRepositories } from "../admin/read-only";
import { createAdminGameplaySliceBoundary } from "./admin-gameplay-slice-boundary";
import { createPublicServerListResponse } from "./public-server-list-netlify";
import { createPlayerEntryNetlifyBoundary } from "../player-entry/player-entry-netlify";
import { createPostgresPlayerEntryRepository } from "../player-entry/postgres-player-entry-repository";
import type { PostgresDatabase } from "../runtime/persistence/postgres";
import { normalizeNetlifyFunctionEnvironment } from "./netlify-runtime-environment";
import {
  createNetlifyPostgresDatabase,
  type NetlifyPostgresDatabaseFactory
} from "./netlify-postgres-database";
import { createGameplayFunctionErrorResponse } from "./gameplay-function-error-response";
import { rejectInvalidGameplayRequestSession } from "./gameplay-request-session-guard";
import { validateSnapshotTokenForInstance } from "./snapshot-token-instance-guard";
import { createHostedRuntimeRequestGuard } from "./hosted-runtime-request-guard";
import {
  parseGameplaySliceBoundaryBody,
  readGameplaySliceProcessEnvironment,
  resolveGameplaySessionToken,
  type GameplaySliceFunctionEvent
} from "./gameplay-slice-function-request";
import {
  createGameplaySliceRouteError,
  isGameplaySliceStateChangingRoute
} from "./gameplay-slice-function-routing";

export interface GameplaySliceFunctionHandlerOptions {
  cryptoProvider?: SnapshotTokenCryptoProvider;
  environment?: Record<string, string | undefined>;
  allowImplicitInstanceCreation?: boolean;
  server?: ServerApp;
  adminRepositories?: AdminDurableRepositories;
  database?: PostgresDatabase;
  databaseFactory?: NetlifyPostgresDatabaseFactory;
}

export const createGameplaySliceFunctionHandler = (
  options: GameplaySliceFunctionHandlerOptions = {}
) => {
  const environment = normalizeNetlifyFunctionEnvironment(options.environment ?? readGameplaySliceProcessEnvironment());
  const snapshotSecret = readRequiredSnapshotSecret(environment);
  const gameplaySessionSecret = readRequiredGameplaySessionSecret(environment, snapshotSecret.secret);
  const sharedDatabase = options.database ?? (options.server
    ? null
    : createNetlifyPostgresDatabase(environment, options.databaseFactory));
  const server = options.server ?? createServerApp({
    gameplaySessionTokenSecret: gameplaySessionSecret.secret ?? undefined,
    environment,
    database: sharedDatabase ?? undefined
  });
  const adminResolution = resolveAdminDurableRepositories(
    environment,
    options.adminRepositories,
    sharedDatabase ?? undefined
  );
  const adminRepositories = adminResolution.accepted ? adminResolution.repositories : null;
  const hostedRuntimeGuard = createHostedRuntimeRequestGuard({ server, repositories: adminRepositories, environment });
  const handleAdminRequest = createAdminGameplaySliceBoundary({ environment, repositories: adminRepositories ?? undefined });
  const handlePlayerEntryRequest = createPlayerEntryNetlifyBoundary({ environment,
    repository: sharedDatabase ? createPostgresPlayerEntryRepository(sharedDatabase) : undefined,
    gameplaySessionService: server.gameplaySessionService });
  const allowImplicitInstanceCreation = environment.NODE_ENV === "production"
    ? false
    : options.allowImplicitInstanceCreation ?? true;
  const snapshotTokenCodec = snapshotSecret.secret
    ? createSnapshotTokenCodec({
        secret: snapshotSecret.secret,
        cryptoProvider: options.cryptoProvider
      })
    : null;
  const sessionTokenCodec = gameplaySessionSecret.secret
    ? createGameplaySessionTokenCodec({
        secret: gameplaySessionSecret.secret
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
  return async (event: GameplaySliceFunctionEvent): Promise<NetlifyFunctionResponse> => {
    const adminResponse = await handleAdminRequest(event);
    if (adminResponse) return adminResponse;
    const playerEntryResponse = await handlePlayerEntryRequest({
      ...event,
      body: parseGameplaySliceBoundaryBody(event.body)
    });
    if (playerEntryResponse) return playerEntryResponse;
    if (event.httpMethod.toUpperCase() === "OPTIONS") {
      return createJsonResponse(204, null);
    }
    const route = resolveGameplaySliceFunctionRoute(event.path);
    if (!route) {
      return createJsonResponse(
        404,
        createGameplaySliceRouteError("transport.not_found", "Gameplay slice endpoint was not found.")
      );
    }
    if (environment.NODE_ENV !== "production" && server.instanceManager.listInstances().length === 0) {
      ensureDefaultLobbyServers(server);
    }
    if (!snapshotSecret.accepted || !snapshotTokenCodec) {
      return createJsonResponse(500, createGameplayFunctionErrorResponse(snapshotSecret.errors));
    }
    if (!gameplaySessionSecret.accepted || !sessionTokenCodec) {
      return createJsonResponse(500, createGameplayFunctionErrorResponse(gameplaySessionSecret.errors));
    }
    if (route === "servers") {
      return await createPublicServerListResponse(server, environment, adminRepositories);
    }
    const productionGuardError = sessionHandlers?.validateProductionSessionRuntime() ?? null;
    if (productionGuardError) {
      return createJsonResponse(500, createGameplayFunctionErrorResponse([productionGuardError]));
    }
    if (isGameplaySliceStateChangingRoute(route)) {
      const originError = validateStateChangingOrigin(event.headers, environment);
      if (originError) {
        return createJsonResponse(200, createGameplayFunctionErrorResponse([originError]));
      }
    }
    const parsedBody = parseNetlifyJsonBody(event.body);
    if (!parsedBody.accepted) {
      return createJsonResponse(
        parsedBody.statusCode,
        createGameplayFunctionErrorResponse([parsedBody.error])
      );
    }
    if (route === "matchmaking-reserve") {
      if (environment.NODE_ENV === "production" && environment.EMPIRE_LEGACY_MATCHMAKING_ENABLED !== "true") {
        return createJsonResponse(410, createGameplaySliceRouteError(
          "MATCHMAKING_ENTRY_REPLACED",
          "Production player entry requires account session and lobby spawn confirmation."
        ));
      }
      return await handlePublicServerMatchmakingReserve(
        server, event.httpMethod, parsedBody.body, event.headers, environment, adminRepositories
      );
    }
    const requestPath = `/api/gameplay-slice/${route}`;
    if (route === "load") {
      const validation = validateLoadGameplaySliceRequest(parsedBody.body);
      if (!validation.accepted) {
        return createJsonResponse(200, createGameplaySliceValidationResponse(validation.errors));
      }
      const request: LoadGameplaySliceRequest = {
        ...validation.request,
        sessionToken: resolveGameplaySessionToken(event.headers, validation.request.sessionToken, environment)
      };
      const sessionError = await rejectInvalidGameplayRequestSession(sessionHandlers!, request.sessionToken, request.serverInstanceId);
      if (sessionError) return sessionError;
      const hostedRuntimeError = await hostedRuntimeGuard.prepare(request.serverInstanceId);
      if (hostedRuntimeError) return hostedRuntimeError;
      const snapshotTokenError = environment.NODE_ENV === "production" ? null : await validateSnapshotTokenForInstance(
        snapshotTokenCodec!,
        request.snapshotToken,
        request.serverInstanceId
      );
      if (snapshotTokenError) {
        return createJsonResponse(200, createGameplayFunctionErrorResponse([snapshotTokenError]));
      }
      return await toFunctionResponse(await server.gameplaySliceJsonHandler.handle({
        method: event.httpMethod,
        path: requestPath,
        body: request
      }), request.serverInstanceId);
    }
    if (route === "join") {
      const hostedRuntimeError = await hostedRuntimeGuard.prepareJoin(parsedBody.body);
      if (hostedRuntimeError) return hostedRuntimeError;
      return sessionHandlers!.handleJoin(parsedBody.body, event.headers);
    }
    if (route === "logout") {
      return await sessionHandlers!.handleLogout(parsedBody.body, event.headers);
    }
    if (route === "command-result") {
      const validation = validateLookupGameplayCommandResultRequest(parsedBody.body);
      if (!validation.accepted) {
        return createJsonResponse(200, {
          accepted: false,
          status: "not_found",
          readModel: null,
          errors: validation.errors
        });
      }
      const request: LookupGameplayCommandResultRequest = {
        ...validation.request,
        sessionToken: resolveGameplaySessionToken(event.headers, validation.request.sessionToken, environment)
      };
      const sessionError = await rejectInvalidGameplayRequestSession(sessionHandlers!, request.sessionToken,
        request.serverInstanceId, "command-result");
      if (sessionError) return sessionError;
      const hostedRuntimeError = await hostedRuntimeGuard.prepare(request.serverInstanceId);
      if (hostedRuntimeError) return hostedRuntimeError;
      return await toFunctionResponse(await server.gameplaySliceJsonHandler.handle({
        method: event.httpMethod,
        path: requestPath,
        body: request
      }), request.serverInstanceId);
    }
    const validation = validateSubmitGameplayCommandRequest(parsedBody.body);
    if (!validation.accepted) {
      return createJsonResponse(200, createGameplaySliceValidationResponse(validation.errors));
    }
    const request: SubmitGameplayCommandRequest = {
      ...validation.request,
      sessionToken: resolveGameplaySessionToken(event.headers, validation.request.sessionToken, environment)
    };
    const sessionError = await rejectInvalidGameplayRequestSession(sessionHandlers!, request.sessionToken,
      request.command.serverInstanceId);
    if (sessionError) return sessionError;
    const hostedRuntimeError = await hostedRuntimeGuard.prepareSubmit(request.command.serverInstanceId);
    if (hostedRuntimeError) return hostedRuntimeError;
    const snapshotTokenError = environment.NODE_ENV === "production" ? null : await validateSnapshotTokenForInstance(
      snapshotTokenCodec!,
      request.snapshotToken,
      request.command.serverInstanceId
    );
    if (snapshotTokenError) {
      return createJsonResponse(200, createGameplayFunctionErrorResponse([snapshotTokenError]));
    }
    const identityErrors = validateCommandPlayerIdentity(request.command, null, {
      sessionToken: request.sessionToken,
      sessionTokenCodec
    });
    if (identityErrors.length > 0) {
      return createJsonResponse(200, createGameplayFunctionErrorResponse(identityErrors));
    }
    const ensureResult = await ensureGameplaySliceSessionResult(server.instanceManager, request, {
      snapshotToken: request.snapshotToken,
      snapshotTokenCodec,
      allowImplicitInstanceCreation
    });
    if (!ensureResult.accepted) {
      return createJsonResponse(200, createGameplayFunctionErrorResponse(ensureResult.errors));
    }
    return await toFunctionResponse(await server.gameplaySliceJsonHandler.handle({
      method: event.httpMethod,
      path: requestPath,
      body: request
    }), request.command.serverInstanceId);
  };
  function toFunctionResponse(response: {
    status: number;
    body: GameplaySliceResponse | GameplayCommandResultLookupResponse;
  }, instanceId: string): Promise<NetlifyFunctionResponse> {
    const runtime = server.instanceManager.getInstanceById(instanceId);
    return Promise.resolve(environment.NODE_ENV === "production" ? null : runtime
      ? snapshotTokenCodec!.seal(createInstanceSnapshot(runtime))
      : ("snapshotToken" in response.body ? response.body.snapshotToken ?? null : null)
    ).then((snapshotToken) => createJsonResponse(response.status, {
      ...response.body,
      snapshotToken
    }));
  }
};
export const handler = createGameplaySliceFunctionHandler();
