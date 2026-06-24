import type {
  GameplaySliceResponse,
  LoadGameplaySliceRequest,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import type { ClientTransport } from "./client-transport";

export interface FetchClientTransportOptions {
  endpointBase: string;
  fetchImpl?: typeof fetch;
  storage?: Storage | null;
}

/**
 * Responsibility: Browser transport adapter for the server-fed gameplay slice.
 * Belongs here: JSON request/response wiring over fetch.
 * Does not belong here: gameplay decisions or DOM rendering.
 */
export const createFetchClientTransport = (
  options: FetchClientTransportOptions
): ClientTransport => {
  const fetchJson = options.fetchImpl ?? globalThis.fetch;
  const endpointBase = options.endpointBase.replace(/\/+$/u, "");
  const storage = options.storage ?? resolveBrowserStorage();

  const post = async <TRequest>(
    route: "load" | "submit",
    request: TRequest
  ): Promise<GameplaySliceResponse> => {
    if (!fetchJson) {
      throw new Error("Fetch transport is unavailable in this runtime.");
    }

    const requestWithTokens = attachStoredGameplaySliceTokens(route, request, storage);
    const endpoint = `${endpointBase}/${route}`;
    const response = await fetchJson(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(requestWithTokens)
    });

    if (!response.ok) {
      throw new Error(`Gameplay slice request failed: POST ${endpoint} returned HTTP ${response.status}.`);
    }

    const payload = await response.json() as GameplaySliceResponse;
    persistGameplaySliceTokens(requestWithTokens, payload, storage);
    return payload;
  };

  return {
    load: (request: LoadGameplaySliceRequest) => post("load", request),
    send: (request: SubmitGameplayCommandRequest) => post("submit", request)
  };
};

const attachStoredGameplaySliceTokens = <TRequest>(
  route: "load" | "submit",
  request: TRequest,
  storage: Storage | null
): TRequest => {
  const snapshotKey = createGameplaySliceTokenStorageKey("snapshot", request);
  const sessionKey = createGameplaySliceTokenStorageKey("session", request);
  const snapshotToken = snapshotKey ? readToken(storage, snapshotKey) : null;
  const sessionToken = route === "submit" && sessionKey ? readToken(storage, sessionKey) : null;

  return snapshotToken || sessionToken
    ? {
        ...(request as Record<string, unknown>),
        ...(snapshotToken ? { snapshotToken } : {}),
        ...(sessionToken ? { sessionToken } : {})
      } as TRequest
    : request;
};

const persistGameplaySliceTokens = (
  request: unknown,
  response: GameplaySliceResponse,
  storage: Storage | null
): void => {
  const snapshotKey = createGameplaySliceTokenStorageKey("snapshot", request);
  const sessionKey = createGameplaySliceTokenStorageKey("session", request);
  const snapshotToken = String(response.snapshotToken ?? "").trim();
  const sessionToken = String(response.sessionToken ?? "").trim();

  if (snapshotKey && snapshotToken) {
    writeToken(storage, snapshotKey, snapshotToken);
  }

  if (sessionKey && sessionToken) {
    writeToken(storage, sessionKey, sessionToken);
  }
};

const readToken = (storage: Storage | null, key: string): string | null => {
  try {
    return storage?.getItem(key) ?? null;
  } catch (_error) {
    return null;
  }
};

const writeToken = (
  storage: Storage | null,
  key: string,
  token: string
): void => {
  try {
    storage?.setItem(key, token);
  } catch (_error) {
    // Storage may be unavailable or full; the server can bootstrap a fresh slice.
  }
};

const createGameplaySliceTokenStorageKey = (
  kind: "snapshot" | "session",
  request: unknown
): string | null => {
  const record = request as {
    serverInstanceId?: unknown;
    playerId?: unknown;
    command?: {
      serverInstanceId?: unknown;
      playerId?: unknown;
    };
  };
  const serverInstanceId = String(record.serverInstanceId ?? record.command?.serverInstanceId ?? "").trim();
  const playerId = String(record.playerId ?? record.command?.playerId ?? "").trim();

  return serverInstanceId && playerId
    ? `empire:gameplay-slice:${kind}:${serverInstanceId}:${playerId}`
    : null;
};

const resolveBrowserStorage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch (_error) {
    return null;
  }
};
