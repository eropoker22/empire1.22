import type {
  GameplaySliceResponse,
  LoadGameplaySliceRequest,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import { createServerApp } from "../app";
import { ensureGameplaySliceSession } from "../bootstrap";
import { createInstanceSnapshot } from "../runtime/persistence/mappers";
import { createSnapshotTokenCodec, type SnapshotTokenCryptoProvider } from "../runtime/persistence/services";

const DEFAULT_SNAPSHOT_SECRET = "empire-streets-local-gameplay-slice-dev-secret";

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

interface GameplaySliceFunctionHandlerOptions {
  cryptoProvider?: SnapshotTokenCryptoProvider;
}

/**
 * Responsibility: Netlify HTTP adapter for the server-fed gameplay slice.
 * Belongs here: serverless event parsing and response formatting.
 * Does not belong here: gameplay rules or client rendering.
 */
export const createGameplaySliceFunctionHandler = (
  options: GameplaySliceFunctionHandlerOptions = {}
) => {
  const server = createServerApp();
  const snapshotTokenCodec = createSnapshotTokenCodec({
    secret: readSnapshotSecret(),
    cryptoProvider: options.cryptoProvider
  });

  return async (event: NetlifyFunctionEvent): Promise<NetlifyFunctionResponse> => {
    if (event.httpMethod.toUpperCase() === "OPTIONS") {
      return createJsonResponse(204, null);
    }

    const route = resolveRoute(event.path);

    if (!route) {
      return createJsonResponse(
        404,
        createErrorResponse("transport.not_found", "Gameplay slice endpoint was not found.")
      );
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
      const request = parsedBody as LoadGameplaySliceRequest;

      await ensureGameplaySliceSession(server.instanceManager, request, {
        snapshotToken: request.snapshotToken,
        snapshotTokenCodec
      });
      return await toFunctionResponse(server.gameplaySliceJsonHandler.handle({
        method: event.httpMethod,
        path: requestPath,
        body: request
      }), request.serverInstanceId);
    }

    const request = parsedBody as SubmitGameplayCommandRequest;

    await ensureGameplaySliceSession(server.instanceManager, request, {
      snapshotToken: request.snapshotToken,
      snapshotTokenCodec
    });
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
      ? snapshotTokenCodec.seal(createInstanceSnapshot(runtime))
      : response.body.snapshotToken ?? null
    ).then((snapshotToken) => createJsonResponse(response.status, {
      ...response.body,
      snapshotToken
    }));
  }
};

export const handler = createGameplaySliceFunctionHandler();

const resolveRoute = (path: string): "load" | "submit" | null => {
  const lastSegment = String(path || "").split("/").filter(Boolean).at(-1);
  return lastSegment === "load" || lastSegment === "submit" ? lastSegment : null;
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

function readSnapshotSecret(): string {
  const environment = (globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  }).process?.env;

  return environment?.GAMEPLAY_SLICE_SNAPSHOT_SECRET ?? DEFAULT_SNAPSHOT_SECRET;
}

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

const createJsonResponse = (
  statusCode: number,
  body: GameplaySliceResponse | null
): NetlifyFunctionResponse => ({
  statusCode,
  headers: {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "content-type": "application/json; charset=utf-8"
  },
  body: body ? JSON.stringify(body) : ""
});
