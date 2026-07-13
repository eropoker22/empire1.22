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
  const legacySessionStorage = options.storage ?? resolveBrowserLegacySessionStorage();
  let consumedJoinTicket: string | null = null;

  const post = async <TRequest>(
    route: "load" | "submit",
    request: TRequest
  ): Promise<GameplaySliceResponse> => {
    if (!fetchJson) {
      throw new Error("Fetch transport is unavailable in this runtime.");
    }

    const requestWithTokens = attachStoredGameplaySliceTokens(route, request, storage);
    const requestJoinTicket = readJoinTicket(requestWithTokens);
    const shouldStripConsumedJoinTicket = Boolean(
      consumedJoinTicket && requestJoinTicket === consumedJoinTicket
    );
    const requestForEndpoint = shouldStripConsumedJoinTicket
      ? omitJoinTicket(requestWithTokens)
      : requestWithTokens;
    const endpointRoute = resolveEndpointRoute(route, requestForEndpoint);
    const endpoint = `${endpointBase}/${endpointRoute}`;
    const response = await fetchJson(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(requestForEndpoint)
    });

    if (!response.ok) {
      throw new Error(`Gameplay slice request failed: POST ${endpoint} returned HTTP ${response.status}.`);
    }

    const payload = await response.json() as GameplaySliceResponse;
    persistGameplaySliceTokens(requestForEndpoint, payload, storage);
    if (endpointRoute === "join" && payload.accepted && requestJoinTicket) {
      consumedJoinTicket = requestJoinTicket;
      clearConsumedLegacyJoinTicket(legacySessionStorage, requestJoinTicket);
    }
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
  const snapshotToken = snapshotKey ? readToken(storage, snapshotKey) : null;

  return snapshotToken
    ? {
        ...(request as Record<string, unknown>),
        snapshotToken
      } as TRequest
    : request;
};

const resolveEndpointRoute = <TRequest>(
  route: "load" | "submit",
  request: TRequest
): "load" | "submit" | "join" => {
  if (route !== "load") {
    return route;
  }
  const record = request as { joinTicket?: unknown };
  return String(record.joinTicket ?? "").trim()
    ? "join"
    : "load";
};

const readJoinTicket = (request: unknown): string | null => {
  const ticket = String((request as { joinTicket?: unknown })?.joinTicket ?? "").trim();
  return ticket || null;
};

const omitJoinTicket = <TRequest>(request: TRequest): TRequest => {
  const { joinTicket: _joinTicket, ...rest } = request as TRequest & { joinTicket?: unknown };
  return rest as TRequest;
};

const clearConsumedLegacyJoinTicket = (storage: Storage | null, consumedTicket: string): void => {
  const sessionKey = "empireStreets.session.v1";
  try {
    const rawSession = storage?.getItem(sessionKey);
    if (!rawSession) return;
    const session = JSON.parse(rawSession) as { registration?: Record<string, unknown> };
    if (readJoinTicket(session.registration) !== consumedTicket) return;
    const registration = { ...(session.registration ?? {}) };
    delete registration.joinTicket;
    storage?.setItem(sessionKey, JSON.stringify({ ...session, registration }));
  } catch (_error) {
    // A malformed compatibility session must not invalidate the server response.
  }
};

const persistGameplaySliceTokens = (
  request: unknown,
  response: GameplaySliceResponse,
  storage: Storage | null
): void => {
  const snapshotKey = createGameplaySliceTokenStorageKey("snapshot", request);
  const snapshotToken = String(response.snapshotToken ?? "").trim();

  if (snapshotKey && snapshotToken) {
    writeToken(storage, snapshotKey, snapshotToken);
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
  kind: "snapshot",
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
    return globalThis.sessionStorage ?? null;
  } catch (_error) {
    return null;
  }
};

const resolveBrowserLegacySessionStorage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch (_error) {
    return null;
  }
};
