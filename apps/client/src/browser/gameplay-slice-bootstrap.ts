import type { LoadGameplaySliceRequest } from "@empire/shared-types";

export const DEFAULT_SESSION_STORAGE_KEY = "empireStreets.session.v1";
export const SERVER_ASSIGNED_FOCUS_DISTRICT_ID = "district:server-assigned";

export interface GameplaySliceBootstrapDataset {
  serverInstanceId?: string;
  playerId?: string;
  districtId?: string;
  factionId?: string;
  sessionStorageKey?: string;
}

export interface BrowserStorageReader {
  getItem(key: string): string | null;
}

interface LegacyGameplaySession {
  registration?: {
    identity?: unknown;
    gangName?: unknown;
    serverInstanceId?: unknown;
    activeServerInstanceId?: unknown;
    serverId?: unknown;
    activeServerId?: unknown;
    startDistrictId?: unknown;
    preferredStartDistrictId?: unknown;
    assignedHomeDistrictId?: unknown;
    lastServerConfirmedDistrictId?: unknown;
    factionId?: unknown;
    selectedFaction?: unknown;
  };
}

/**
 * Responsibility: Resolve the first gameplay slice request from page data or
 * the legacy onboarding session.
 * Belongs here: compatibility mapping from browser session IDs to shared DTO IDs.
 * Does not belong here: server bootstrapping or gameplay state creation.
 */
export const resolveGameplaySliceBootstrapRequest = (
  dataset: GameplaySliceBootstrapDataset,
  storage: BrowserStorageReader | null
): LoadGameplaySliceRequest | null => {
  const explicit = createExplicitRequest(dataset);

  if (explicit) {
    return explicit;
  }

  const session = readLegacySession(storage, dataset.sessionStorageKey);
  const registration = session?.registration;
  const serverInstanceId = normalizeServerInstanceId(
    registration?.activeServerInstanceId ||
    registration?.serverInstanceId ||
    registration?.activeServerId ||
    registration?.serverId
  );
  const preferredStartDistrictId = normalizeDistrictId(
    registration?.preferredStartDistrictId || registration?.startDistrictId
  );
  const districtId = normalizeDistrictId(
    registration?.assignedHomeDistrictId || registration?.lastServerConfirmedDistrictId
  ) ?? SERVER_ASSIGNED_FOCUS_DISTRICT_ID;
  const playerId = normalizePlayerId(registration?.identity || registration?.gangName);
  const factionId = normalizeFactionId(registration?.factionId || registration?.selectedFaction);

  if (!serverInstanceId || !playerId) {
    return null;
  }

  return {
    serverInstanceId,
    playerId,
    districtId,
    ...(preferredStartDistrictId ? { preferredStartDistrictId } : {}),
    factionId
  };
};

const createExplicitRequest = (
  dataset: GameplaySliceBootstrapDataset
): LoadGameplaySliceRequest | null => {
  const serverInstanceId = normalizeToken(dataset.serverInstanceId);
  const playerId = normalizeToken(dataset.playerId);
  const districtId = normalizeDistrictId(dataset.districtId) ?? SERVER_ASSIGNED_FOCUS_DISTRICT_ID;
  const factionId = normalizeFactionId(dataset.factionId);

  return serverInstanceId && playerId
    ? {
        serverInstanceId,
        playerId,
        districtId,
        factionId
      }
    : null;
};

const readLegacySession = (
  storage: BrowserStorageReader | null,
  storageKey = DEFAULT_SESSION_STORAGE_KEY
): LegacyGameplaySession | null => {
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(storageKey || DEFAULT_SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
};

const normalizeToken = (value: unknown): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeServerInstanceId = (value: unknown): string | null => {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return null;
  }

  return normalized.startsWith("instance:") ? normalized : `instance:${normalized}`;
};

const normalizeDistrictId = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  if (raw.startsWith("district:")) {
    return raw;
  }

  const numericId = Number.parseInt(raw, 10);
  return numericId > 0 ? `district:${numericId}` : null;
};

const normalizePlayerId = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  if (raw.startsWith("player:")) {
    return raw;
  }

  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return slug ? `player:${slug}` : null;
};

const normalizeFactionId = (value: unknown): string | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};
