import type {
  DomainError,
  GameplaySliceResponse,
  LoadGameplaySliceRequest,
  ServerInstanceSummary,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import { createServerApp } from "../app";
import { ensureGameplaySliceSessionResult } from "../bootstrap";
import { createInstanceSnapshot } from "../runtime/persistence/mappers";
import { createSnapshotTokenCodec, type SnapshotTokenCryptoProvider } from "../runtime/persistence/services";
import {
  createGameplaySliceValidationResponse,
  validateLoadGameplaySliceRequest,
  validateSubmitGameplayCommandRequest
} from "../transport/gameplay-slice-request-validation";
import { validateCommandPlayerIdentity } from "../transport/player-identity-guard";
import { createGameplaySessionTokenCodec } from "../transport/gameplay-session-token-codec";
import { readRequiredSnapshotSecret } from "./snapshot-secret";
import { ensureDefaultLobbyServers } from "./gameplay-slice-function-default-servers";

interface NetlifyFunctionEvent {
  httpMethod: string;
  path: string;
  body: string | null;
}

interface NetlifyFunctionResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

interface ServerListResponse {
  accepted: boolean;
  servers: ServerInstanceSummary[];
  errors: DomainError[];
}

interface GameplaySliceFunctionHandlerOptions {
  cryptoProvider?: SnapshotTokenCryptoProvider;
  environment?: Record<string, string | undefined>;
  allowImplicitInstanceCreation?: boolean;
}

/**
 * Responsibility: Netlify HTTP adapter for the server-fed gameplay slice.
 * Belongs here: serverless event parsing and response formatting.
 * Does not belong here: gameplay rules or client rendering.
 */
export const createGameplaySliceFunctionHandler = (
  options: GameplaySliceFunctionHandlerOptions = {}
) => {
  const snapshotSecret = readRequiredSnapshotSecret(options.environment);
  const server = createServerApp({
    gameplaySessionTokenSecret: snapshotSecret.secret ?? undefined
  });
  ensureDefaultLobbyServers(server);
  const allowImplicitInstanceCreation =
    options.allowImplicitInstanceCreation ?? options.environment?.NODE_ENV !== "production";
  const snapshotTokenCodec = snapshotSecret.secret
    ? createSnapshotTokenCodec({
        secret: snapshotSecret.secret,
        cryptoProvider: options.cryptoProvider
      })
    : null;
  const sessionTokenCodec = snapshotSecret.secret
    ? createGameplaySessionTokenCodec({
        secret: snapshotSecret.secret
      })
    : null;

  return async (event: NetlifyFunctionEvent): Promise<NetlifyFunctionResponse> => {
    if (event.httpMethod.toUpperCase() === "OPTIONS") {
      return createJsonResponse(204, null);
    }

    if (!snapshotSecret.accepted || !snapshotTokenCodec) {
      return createJsonResponse(500, createErrorResponseFromErrors(snapshotSecret.errors));
    }

    const route = resolveRoute(event.path);

    if (!route) {
      return createJsonResponse(
        404,
        createErrorResponse("transport.not_found", "Gameplay slice endpoint was not found.")
      );
    }

    if (route === "servers") {
      return createJsonResponse(200, {
        accepted: true,
        servers: server.adminMonitoring.listServerSummaries(),
        errors: []
      });
    }

    const parsedBody = parseBody(event.body);

    if (!parsedBody) {
      return createJsonResponse(
        400,
        createErrorResponse("transport.invalid_json", "Request body must be valid JSON.")
      );
    }

    const requestPath = `/api/gameplay-slice/${route}`;

    if (route === "load") {
      const validation = validateLoadGameplaySliceRequest(parsedBody);
      if (!validation.accepted) {
        return createJsonResponse(200, createGameplaySliceValidationResponse(validation.errors));
      }

      const request: LoadGameplaySliceRequest = validation.request;

      const ensureResult = await ensureGameplaySliceSessionResult(server.instanceManager, request, {
        snapshotToken: request.snapshotToken,
        snapshotTokenCodec,
        allowImplicitInstanceCreation
      });
      if (!ensureResult.accepted) {
        return createJsonResponse(200, createErrorResponseFromErrors(ensureResult.errors));
      }
      return await toFunctionResponse(server.gameplaySliceJsonHandler.handle({
        method: event.httpMethod,
        path: requestPath,
        body: request
      }), request.serverInstanceId);
    }

    const validation = validateSubmitGameplayCommandRequest(parsedBody);
    if (!validation.accepted) {
      return createJsonResponse(200, createGameplaySliceValidationResponse(validation.errors));
    }

    const request: SubmitGameplayCommandRequest = validation.request;
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
    return await toFunctionResponse(server.gameplaySliceJsonHandler.handle({
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
};

export const handler = createGameplaySliceFunctionHandler();

const resolveRoute = (path: string): "load" | "submit" | "servers" | null => {
  const lastSegment = String(path || "").split("/").filter(Boolean).at(-1);
  return lastSegment === "load" || lastSegment === "submit" || lastSegment === "servers"
    ? lastSegment
    : null;
};

const parseBody = (body: string | null): unknown | null => {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch (_error) {
    return null;
  }
};

const createErrorResponse = (
  code: string,
  message: string
): GameplaySliceResponse => ({
  accepted: false,
  readModel: null,
  errors: [
    {
      code,
      message
    }
  ]
});

const createErrorResponseFromErrors = (
  errors: DomainError[]
): GameplaySliceResponse => ({
  accepted: false,
  readModel: null,
  errors
});

const createJsonResponse = (
  statusCode: number,
  body: GameplaySliceResponse | ServerListResponse | null
): NetlifyFunctionResponse => ({
  statusCode,
  headers: {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "content-type": "application/json; charset=utf-8"
  },
  body: body ? JSON.stringify(body) : ""
});
