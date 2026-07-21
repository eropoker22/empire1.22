import { SERVER_ASSIGNED_FOCUS_DISTRICT_ID, type LoadGameplaySliceRequest } from "@empire/shared-types";

export const DEFAULT_SESSION_STORAGE_KEY = "empireStreets.session.v1";
export { SERVER_ASSIGNED_FOCUS_DISTRICT_ID };

export interface GameplaySliceBootstrapDataset {
  serverInstanceId?: string;
  playerId?: string;
  accountId?: string;
  districtId?: string;
  factionId?: string;
  sessionStorageKey?: string;
}

/**
 * Responsibility: Resolve the first gameplay slice request from account-backed
 * membership data published onto the page by the live entrypoint.
 * Belongs here: validation and normalization of server-confirmed DTO IDs.
 * Does not belong here: server bootstrapping or gameplay state creation.
 */
export const resolveGameplaySliceBootstrapRequest = (
  dataset: GameplaySliceBootstrapDataset,
  _storage: unknown = null
): LoadGameplaySliceRequest | null => createExplicitRequest(dataset);

const createExplicitRequest = (
  dataset: GameplaySliceBootstrapDataset
): LoadGameplaySliceRequest | null => {
  const serverInstanceId = normalizeServerInstanceId(dataset.serverInstanceId);
  const playerId = normalizeToken(dataset.playerId);
  const accountId = normalizeToken(dataset.accountId);
  const districtId = normalizeDistrictId(dataset.districtId);
  const factionId = normalizeFactionId(dataset.factionId);

  return serverInstanceId && playerId
    ? {
        serverInstanceId,
        playerId,
        ...(accountId ? { accountId } : {}),
        ...(districtId ? { districtId } : {}),
        factionId
      }
    : null;
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

  return normalized.startsWith("instance:") ? normalized : null;
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

const normalizeFactionId = (value: unknown): string | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};
