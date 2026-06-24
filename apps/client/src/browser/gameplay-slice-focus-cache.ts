import type { GameplaySliceView } from "@empire/shared-types";
import { DEFAULT_SESSION_STORAGE_KEY } from "./gameplay-slice-bootstrap";

export const persistServerConfirmedGameplaySliceFocus = (
  storage: Storage | null,
  storageKey: string | undefined,
  gameplaySlice: GameplaySliceView | null
): void => {
  const assignedHomeDistrictId = normalizeStorageToken(gameplaySlice?.player.homeDistrictId);
  const lastServerConfirmedDistrictId = normalizeStorageToken(
    gameplaySlice?.district?.districtId || assignedHomeDistrictId
  );
  const serverConfirmedFactionId = normalizeStorageToken(gameplaySlice?.player.factionId);

  if (!storage || !lastServerConfirmedDistrictId) {
    return;
  }

  try {
    const key = storageKey || DEFAULT_SESSION_STORAGE_KEY;
    const parsed = JSON.parse(storage.getItem(key) || "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return;
    }
    const registration = parsed.registration && typeof parsed.registration === "object" && !Array.isArray(parsed.registration)
      ? parsed.registration
      : {};

    storage.setItem(key, JSON.stringify({
      ...parsed,
      registration: {
        ...registration,
        ...(assignedHomeDistrictId ? { assignedHomeDistrictId } : {}),
        ...(serverConfirmedFactionId ? {
          factionId: serverConfirmedFactionId,
          selectedFaction: serverConfirmedFactionId,
          serverConfirmedFactionId
        } : {}),
        lastServerConfirmedDistrictId
      }
    }));
  } catch (_error) {
    // Browser storage is a cache only; failed persistence must not affect server authority.
  }
};

const normalizeStorageToken = (value: unknown): string | null => {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};
