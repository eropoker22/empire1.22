import type { LoadGameplaySliceRequest } from "@empire/shared-types";

const DEFAULT_SESSION_STORAGE_KEY = "empireStreets.session.v1";

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
    serverId?: unknown;
    startDistrictId?: unknown;
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
  const serverId = normalizeToken(registration?.serverId);
  const districtId = normalizeDistrictId(registration?.startDistrictId);
  const playerId = normalizePlayerId(registration?.identity || registration?.gangName);
  const factionId = normalizeFactionId(registration?.factionId || registration?.selectedFaction);

  if (!serverId || !districtId || !playerId) {
    return null;
  }

  return {
    serverInstanceId: `instance:${serverId}`,
    playerId,
    districtId,
    factionId
  };
};

const createExplicitRequest = (
  dataset: GameplaySliceBootstrapDataset
): LoadGameplaySliceRequest | null => {
  const serverInstanceId = normalizeToken(dataset.serverInstanceId);
  const playerId = normalizeToken(dataset.playerId);
  const districtId = normalizeDistrictId(dataset.districtId);
  const factionId = normalizeFactionId(dataset.factionId);

  return serverInstanceId && playerId && districtId
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
