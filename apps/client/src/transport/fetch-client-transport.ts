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

    const requestWithSnapshotToken = attachSnapshotToken(request, storage);
    const response = await fetchJson(`${endpointBase}/${route}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(requestWithSnapshotToken)
    });

    if (!response.ok) {
      throw new Error(`Gameplay slice request failed with HTTP ${response.status}.`);
    }

    const payload = await response.json() as GameplaySliceResponse;
    persistSnapshotToken(requestWithSnapshotToken, payload, storage);
    return payload;
  };

  return {
    load: (request: LoadGameplaySliceRequest) => post("load", request),
    send: (request: SubmitGameplayCommandRequest) => post("submit", request)
  };
};

const attachSnapshotToken = <TRequest>(
  request: TRequest,
  storage: Storage | null
): TRequest => {
  const key = createSnapshotTokenStorageKey(request);
  const snapshotToken = key ? readSnapshotToken(storage, key) : null;

  return snapshotToken
    ? {
        ...(request as Record<string, unknown>),
        snapshotToken
      } as TRequest
    : request;
};

const persistSnapshotToken = (
  request: unknown,
  response: GameplaySliceResponse,
  storage: Storage | null
): void => {
  const key = createSnapshotTokenStorageKey(request);
  const snapshotToken = String(response.snapshotToken ?? "").trim();

  if (key && snapshotToken) {
    writeSnapshotToken(storage, key, snapshotToken);
  }
};

const readSnapshotToken = (storage: Storage | null, key: string): string | null => {
  try {
    return storage?.getItem(key) ?? null;
  } catch (_error) {
    return null;
  }
};

const writeSnapshotToken = (
  storage: Storage | null,
  key: string,
  snapshotToken: string
): void => {
  try {
    storage?.setItem(key, snapshotToken);
  } catch (_error) {
    // Storage may be unavailable or full; the server can bootstrap a fresh slice.
  }
};

const createSnapshotTokenStorageKey = (request: unknown): string | null => {
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
    ? `empire:gameplay-slice:snapshot:${serverInstanceId}:${playerId}`
    : null;
};

const resolveBrowserStorage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch (_error) {
    return null;
  }
};
